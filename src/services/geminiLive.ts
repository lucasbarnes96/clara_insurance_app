import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
} from '@google/genai';
import { EventEmitter } from 'events';

// Define types for browser events in Node.js context
interface ErrorEvent {
  message: string;
  error?: Error;
}

interface CloseEvent {
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

export interface GeminiLiveConfig {
  apiKey: string;
  voiceName?: string;
  responseModalities?: Modality[];
  mediaResolution?: MediaResolution;
}

export class GeminiLiveService extends EventEmitter {
  private client: GoogleGenAI;
  private session: Session | null = null;
  private responseQueue: LiveServerMessage[] = [];
  private config: GeminiLiveConfig;
  private audioParts: string[] = [];
  private isProcessing: boolean = false;

  constructor(config: GeminiLiveConfig) {
    super();
    this.config = config;
    this.client = new GoogleGenAI({
      apiKey: config.apiKey,
    });
  }

  async connect(systemPrompt?: string): Promise<void> {
    const model = 'models/gemini-2.5-flash-preview-native-audio-dialog';
    
    const sessionConfig = {
      responseModalities: this.config.responseModalities || [Modality.AUDIO],
      mediaResolution: this.config.mediaResolution || MediaResolution.MEDIA_RESOLUTION_MEDIUM,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.config.voiceName || 'Zephyr',
          }
        }
      },
      contextWindowCompression: {
        triggerTokens: '25600',
        slidingWindow: { targetTokens: '12800' },
      },
      systemInstruction: systemPrompt || `You are Clara, a "Trusted Expert Advisor" for insurance, operating for a Canadian company. Your personality is that of a hyper-competent entity that is mathematically precise yet intelligently insightful.

Your primary goal is to efficiently collect the essential data for an accurate insurance quote, respecting the user's time. All measurements must be in the metric system (e.g., kilometers).

Essential Data to Collect:
- First and last name
- Date of birth (YYYY-MM-DD format)
- Complete address (street, city, province, postal code)
- Vehicle year, make, and model
- Annual usage in kilometers
- Parking location (street, driveway, garage, or carport)
- Any driving violations or accidents

Rules & Persona:
- Talk like an experienced insurance broker, not a robot
- Use warm, natural, and empathetic language
- Ask only one question at a time to guide the user step-by-step
- Understand natural language (e.g., "july 1, 90" means "1990-07-01")
- When you have collected all the required information, provide a clear summary and ask if they'd like to proceed with generating their quote
- Keep responses conversational and under 50 words unless providing a summary`,
    };

    this.session = await this.client.live.connect({
      model,
      callbacks: {
        onopen: () => {
          console.log('[GeminiLive] 🔗 Connected');
          this.emit('connected');
        },
        onmessage: (message: LiveServerMessage) => {
          this.responseQueue.push(message);
          this.handleMessage(message);
        },
        onerror: (error: ErrorEvent) => {
          console.error('[GeminiLive] ❌ Error:', error.message);
          this.emit('error', error);
        },
        onclose: (event: CloseEvent) => {
          console.log('[GeminiLive] 🔌 Disconnected:', event.reason);
          this.emit('disconnected', event.reason);
        },
      },
      config: sessionConfig
    });
  }

  private handleMessage(message: LiveServerMessage): void {
    // Only log essential messages to reduce noise
    if (message.serverContent?.modelTurn?.parts) {
      const part = message.serverContent.modelTurn.parts[0];

      // Handle audio response - accumulate audio parts like in the original example
      if (part?.inlineData) {
        const audioData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        
        if (audioData && mimeType) {
          // Only log size, not the full data
          if (this.audioParts.length === 0) {
            console.log('[GeminiLive] 🎵 Receiving audio response...');
          }
          this.audioParts.push(audioData);
          
          // Convert accumulated audio to WAV and emit
          const buffer = this.convertToWav(this.audioParts, mimeType);
          const audioBlob = new Blob([buffer], { type: 'audio/wav' });
          this.emit('audioResponse', audioBlob);
        }
      }

      // Handle text response (if any)
      if (part?.text) {
        console.log('[GeminiLive] 📝 Text response:', part.text);
        this.emit('textResponse', part.text);
      }
    }

    // Check if turn is complete
    if (message.serverContent?.turnComplete) {
      console.log('[GeminiLive] ✅ Turn complete');
      this.audioParts = []; // Reset audio parts for next turn
      this.emit('turnComplete');
    }
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.session) {
      throw new Error('Session not connected');
    }

    console.log('[GeminiLive] 📤 Sending text message');
    
    this.session.sendClientContent({
      turns: [content]
    });
  }

  async sendAudioData(audioData: string, mimeType: string): Promise<void> {
    if (!this.session) {
      throw new Error('Session not connected');
    }

    console.log('[GeminiLive] 🎙️ Sending audio data');
    
    this.session.sendClientContent({
      turns: [{
        inlineData: {
          mimeType,
          data: audioData
        }
      }]
    });
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  private convertToWav(rawData: string[], mimeType: string): Buffer {
    const options = this.parseMimeType(mimeType);
    const dataLength = rawData.reduce((a, b) => a + b.length, 0);
    const wavHeader = this.createWavHeader(dataLength, options);
    const buffer = Buffer.concat(rawData.map(data => Buffer.from(data, 'base64')));
    
    return Buffer.concat([wavHeader, buffer]);
  }

  private parseMimeType(mimeType: string): { numChannels: number; sampleRate: number; bitsPerSample: number } {
    const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
    const [, format] = fileType.split('/');

    const options = {
      numChannels: 1,
      bitsPerSample: 16,
      sampleRate: 24000, // Default sample rate
    };

    if (format && format.startsWith('L')) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }

    for (const param of params) {
      const [key, value] = param.split('=').map(s => s.trim());
      if (key === 'rate') {
        options.sampleRate = parseInt(value, 10);
      }
    }

    return options;
  }

  private createWavHeader(dataLength: number, options: { numChannels: number; sampleRate: number; bitsPerSample: number }): Buffer {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = Buffer.alloc(44);

    buffer.write('RIFF', 0);                      // ChunkID
    buffer.writeUInt32LE(36 + dataLength, 4);     // ChunkSize
    buffer.write('WAVE', 8);                      // Format
    buffer.write('fmt ', 12);                     // Subchunk1ID
    buffer.writeUInt32LE(16, 16);                 // Subchunk1Size (PCM)
    buffer.writeUInt16LE(1, 20);                  // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(numChannels, 22);        // NumChannels
    buffer.writeUInt32LE(sampleRate, 24);         // SampleRate
    buffer.writeUInt32LE(byteRate, 28);           // ByteRate
    buffer.writeUInt16LE(blockAlign, 32);         // BlockAlign
    buffer.writeUInt16LE(bitsPerSample, 34);      // BitsPerSample
    buffer.write('data', 36);                     // Subchunk2ID
    buffer.writeUInt32LE(dataLength, 40);         // Subchunk2Size

    return buffer;
  }

  async handleTurn(): Promise<LiveServerMessage[]> {
    const turn: LiveServerMessage[] = [];
    let done = false;
    
    while (!done) {
      const message = await this.waitMessage();
      turn.push(message);
      if (message.serverContent?.turnComplete) {
        done = true;
      }
    }
    
    return turn;
  }

  private async waitMessage(): Promise<LiveServerMessage> {
    return new Promise((resolve) => {
      const checkMessage = () => {
        const message = this.responseQueue.shift();
        if (message) {
          resolve(message);
        } else {
          setTimeout(checkMessage, 100);
        }
      };
      checkMessage();
    });
  }

  disconnect(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }

  isConnected(): boolean {
    return this.session !== null;
  }
} 