import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import { MemoryDataStore } from './services/memoryDataStore';
import { GeminiService } from './services/gemini';
import { GeminiLiveService } from './services/geminiLive';
import { CustomerAgent } from './agents/CustomerAgent';
import { OperationsAgent } from './agents/OperationsAgent';
import { Session, SessionUpdate, Customer } from './types';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Initialize services and agents
const memoryStore = MemoryDataStore.getInstance();
const geminiService = GeminiService.getInstance();
const customerAgent = new CustomerAgent(geminiService);
const operationsAgent = new OperationsAgent(geminiService);

console.log('[Server] 🚀 Clara Insurance Platform - Simplified Stateless Architecture');
console.log('[Server] ✅ MemoryDataStore, GeminiService, GeminiLive, and Agents initialized.');

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Re-emit escalations to connected dashboard clients
memoryStore.on('session_updated', (session: Session) => {
  if (session.status === 'pending_approval' || session.status === 'pending_rejection') {
    io.emit('escalation_created', {
      workflowId: session.sessionId,
      escalationReason: session.rejectionReason || 'Quote package awaiting review',
      createdAt: session.updatedAt,
      session: session,
      quotes: session.quotes || [],
      insights: {
        riskProfile: session.riskProfileInsights || null,
        recommendation: session.recommendation || null
      },
      customerData: session.customer
    });
  }
  if (session.status === 'approved') {
    io.emit('workflow_approved', { workflowId: session.sessionId });
  }
});

async function orchestrateWorkflow(session: Session, message: string): Promise<SessionUpdate> {
    const initialStatus = session.status;
    console.log(`[Orchestrator] 🤖 Handling session ${session.sessionId} with status: ${initialStatus}`);

    switch (initialStatus) {
        case 'generating_quote':
        case 'pending_approval':
        case 'pending_rejection':
            return {
                session,
                response: "Thanks for your patience! We're currently processing your details. This can take a few moments. We'll update you here as soon as your quote is ready for review."
            };

        default:
            const { session: updatedSession, response } = await customerAgent.process(session, message);
            
            if (updatedSession.stage === 'handoff_complete' && initialStatus === 'confirmation') {
                console.log(`[Orchestrator] 🚀 Handoff confirmed for session ${updatedSession.sessionId}. Triggering background operations.`);
                updatedSession.status = 'generating_quote';
                
                operationsAgent.process(updatedSession).then(finalizedSession => {
                    memoryStore.updateSession(finalizedSession.sessionId, finalizedSession);
                    console.log(`[Orchestrator] ✅ Background processing complete for ${finalizedSession.sessionId}. Final status: ${finalizedSession.status}`);
                }).catch(err => {
                    console.error(`[Orchestrator] ❌ Background processing failed for session ${updatedSession.sessionId}:`, err);
                    const finalSession = { ...updatedSession, status: 'rejected', rejectionReason: "An unexpected error occurred during quote generation." } as Session;
                    memoryStore.updateSession(updatedSession.sessionId, finalSession);
                });
            }

            return { session: updatedSession, response };
    }
}

app.post('/api/start-session', async (req, res) => {
    const sessionId = `sess-${uuidv4()}`;
    const customerId = `cust-${uuidv4()}`;
    
    const now = new Date();
    const customer: Customer = {
        id: customerId,
        workflowId: '', // Default value
        sessionId: sessionId,
        profile: {
            id: customerId,
            firstName: '',
            lastName: '',
            dateOfBirth: '',
            address: { street: '', city: '', state: '', zipCode: '' },
            driverLicense: { violations: null },
        },
        vehicle: {
            year: '',
            make: '',
            model: '',
            // Use empty string cast to bypass strict union type so that Clara requests parking explicitly
            parkingLocation: '' as any,
            annualUsage: 0,
            primaryUse: 'commute'
        },
        coveragePreferences: {
            liability: { bodilyInjury: 0, propertyDamage: 0 },
            comprehensive: false,
            collision: false,
            uninsuredMotorist: false,
            personalInjuryProtection: false,
            rentalReimbursement: false,
            deductible: 500
        },
        ratingFactors: {
            ageRating: 0,
            experienceRating: 0,
            locationRating: 0,
            vehicleRating: 0,
            creditRating: 0,
            violationRating: 0,
            coverageRating: 0
        },
        interactions: [],
        complianceChecks: [],
        escalationHistory: [],
        status: 'new',
        createdAt: now as any, // Cast to any to satisfy Timestamp type for demo
        updatedAt: now as any, // Cast to any to satisfy Timestamp type for demo
    };
    await memoryStore.createCustomer(customer);
    
    const newSession: Session = {
        sessionId: sessionId,
        customer: customer,
        conversationHistory: [],
        stage: 'data_gathering',
        status: 'data_gathering',
        isHandoffComplete: false,
        isHumanApproved: false,
        createdAt: now,
        updatedAt: now,
    };
    memoryStore.createSession(sessionId, newSession);
    
    console.log(`[Server] ✅ New session created: ${sessionId}`);
    res.json({ success: true, sessionId: sessionId, message: 'Session started' });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeSessions: memoryStore.getAllSessions().size
    });
});

io.on('connection', (socket) => {
    console.log(`[Server] 🔌 Socket connected: ${socket.id}`);

    socket.on('customer_message', async (data) => {
        try {
            const { sessionId, message } = data;
            let session = memoryStore.getSession(sessionId);

            if (!session) {
                socket.emit('error', { message: 'Session not found.' });
                return;
            }

            const { session: updatedSession, response } = await orchestrateWorkflow(session, message);
            
            memoryStore.updateSession(sessionId, updatedSession);

            socket.emit('agent_response', {
                content: response,
                timestamp: new Date(),
                sessionId: sessionId,
                quotes: updatedSession.quotes || [],
                insights: {
                    riskProfile: updatedSession.riskProfileInsights || null,
                    recommendation: updatedSession.recommendation || null
                }
            });

        } catch (error) {
            console.error('[Server] ❌ Error processing customer message:', error);
            socket.emit('error', { message: 'Failed to process message' });
        }
    });

    socket.on('voice_message', async (data) => {
        try {
            const { sessionId, audioData, mimeType } = data;
            let session = memoryStore.getSession(sessionId);

            if (!session) {
                socket.emit('error', { message: 'Session not found.' });
                return;
            }

            console.log(`[Server] 🎤 Processing voice message for session: ${sessionId}`);

            // Use the singleton GeminiService for speech-to-text transcription
            const transcriptionService = GeminiService.getInstance();

            // Convert base64 audio to buffer
            const audioBuffer = Buffer.from(audioData, 'base64');

            // Use Gemini to transcribe the audio
            const transcriptionPrompt = `Please transcribe the following audio to text. Only return the transcribed text, nothing else.`;
            
            try {
                const transcribedText = await transcriptionService.transcribeAudio(audioBuffer, mimeType, transcriptionPrompt);
                console.log(`[Server] 🎤 Transcribed: "${transcribedText}"`);
                
                // Process the transcribed text through the same CustomerAgent workflow
                const { session: updatedSession, response } = await orchestrateWorkflow(session, transcribedText);
                memoryStore.updateSession(sessionId, updatedSession);

                console.log(`[Server] 🎤 Clara responds: "${response}"`);

                // Generate audio response using GeminiLive TTS
                try {
                    const textToSpeechService = new GeminiLiveService({
                        apiKey: process.env.GEMINI_API_KEY || '',
                        voiceName: 'Zephyr'
                    });

                    // Set up listener for audio response
                    textToSpeechService.once('audioResponse', (audioBlob: Blob) => {
                        // Convert Blob to ArrayBuffer and then to base64 for transmission
                        audioBlob.arrayBuffer().then(buffer => {
                            const base64Audio = Buffer.from(buffer).toString('base64');
                            console.log(`[Server] 🎵 Sending audio response to client`);
                            socket.emit('voice_response', {
                                sessionId: sessionId,
                                audioData: base64Audio,
                                mimeType: audioBlob.type,
                                timestamp: new Date()
                            });
                        });
                    });

                    textToSpeechService.once('error', (error: any) => {
                        console.error(`[Server] ⚠️ TTS failed:`, error);
                    });

                    // Connect and send the response text to be converted to speech
                    await textToSpeechService.connect();
                    await textToSpeechService.sendMessage(response);
                    
                    console.log(`[Server] ✅ Voice message processed with audio response`);
                } catch (ttsError) {
                    console.error(`[Server] ⚠️ TTS error, sending text only:`, ttsError);
                    console.log(`[Server] ✅ Voice message processed (text only)`);
                }

                // Also send the text response for display
                socket.emit('agent_response', {
                    content: response,
                    timestamp: new Date(),
                    sessionId: sessionId,
                    quotes: updatedSession.quotes || [],
                    insights: {
                        riskProfile: updatedSession.riskProfileInsights || null,
                        recommendation: updatedSession.recommendation || null
                    }
                });

            } catch (transcriptionError) {
                console.error(`[Server] ❌ Transcription error:`, transcriptionError);
                socket.emit('error', { message: 'Failed to transcribe audio. Please try again.' });
            }

        } catch (error) {
            console.error('[Server] ❌ Error processing voice message:', error);
            socket.emit('error', { message: 'Failed to process voice message' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Server] 🔌 Socket disconnected: ${socket.id}`);
        // Voice processing now routes through CustomerAgent - no cleanup needed
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/customer', (req, res) => res.sendFile(path.join(__dirname, '../public/customer.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));

// REST endpoint for current escalations
app.get('/api/escalations', (req, res) => {
  const escals = Array.from(memoryStore.getAllSessions().values())
    .filter(s => s.status === 'pending_approval' || s.status === 'pending_rejection')
    .map(s => ({
      workflowId: s.sessionId,
      escalationReason: s.rejectionReason || 'Quote package awaiting review',
      createdAt: s.updatedAt,
      session: s,
      quotes: s.quotes || [],
      insights: {
        riskProfile: s.riskProfileInsights || null,
        recommendation: s.recommendation || null
      },
      customerData: s.customer
    }));
  res.json({ success: true, escalations: escals });
});

// REST endpoint for approving workflows
app.post('/api/escalations/:workflowId/approve', async (req, res) => {
  try {
    const { workflowId } = req.params;
    console.log(`[Server] 🟢 Approving workflow: ${workflowId}`);
    
    const session = memoryStore.getSession(workflowId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'pending_approval') {
      return res.status(400).json({ success: false, error: 'Session is not pending approval' });
    }

    // Update session status to approved
    const updatedSession = {
      ...session,
      status: 'approved' as const,
      isHumanApproved: true,
      updatedAt: new Date()
    };

    memoryStore.updateSession(workflowId, updatedSession);
    
    // Emit socket event for real-time updates
    io.emit('workflow_approved', { workflowId });

    // After approval, proactively generate a quote presentation message for the customer.
    try {
      const { session: postAgentSession, response: agentPresentation } = await customerAgent.process(updatedSession, "");

      // Persist any updates (e.g., conversation history) made by the agent
      memoryStore.updateSession(workflowId, postAgentSession);

      // Broadcast the agent's presentation so the customer sees the quote details immediately
      io.emit('agent_response', {
        content: agentPresentation,
        timestamp: new Date(),
        sessionId: workflowId,
        quotes: postAgentSession.quotes || [],
        insights: {
          riskProfile: postAgentSession.riskProfileInsights || null,
          recommendation: postAgentSession.recommendation || null
        }
      });
    } catch (presentationError) {
      console.error('[Server] ❌ Failed to generate quote presentation for customer:', presentationError);
    }

    console.log(`[Server] ✅ Workflow approved: ${workflowId}`);
    res.json({ success: true, message: 'Workflow approved successfully' });
    
  } catch (error) {
    console.error('[Server] ❌ Error approving workflow:', error);
    res.status(500).json({ success: false, error: 'Failed to approve workflow' });
  }
});

// REST endpoint for rejecting workflows
app.post('/api/escalations/:workflowId/reject', async (req, res) => {
  try {
    const { workflowId } = req.params;
    console.log(`[Server] 🔴 Rejecting workflow: ${workflowId}`);
    
    const session = memoryStore.getSession(workflowId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'pending_approval' && session.status !== 'pending_rejection') {
      return res.status(400).json({ success: false, error: 'Session is not pending review' });
    }

    // Update session status to rejected
    const updatedSession = {
      ...session,
      status: 'rejected' as const,
      isHumanApproved: false,
      updatedAt: new Date()
    };

    memoryStore.updateSession(workflowId, updatedSession);
    
    console.log(`[Server] ❌ Workflow rejected: ${workflowId}`);
    res.json({ success: true, message: 'Workflow rejected successfully' });
    
  } catch (error) {
    console.error('[Server] ❌ Error rejecting workflow:', error);
    res.status(500).json({ success: false, error: 'Failed to reject workflow' });
  }
});

app.use((err: any, req: any, res: any, next: any) => {
    console.error('[Server] ❌ Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Server] 🌐 Server listening on port ${PORT}`);
}); 