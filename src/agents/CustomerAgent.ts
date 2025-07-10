import { GeminiService } from '../services/gemini';
import {
  Customer,
  Session,
  SessionUpdate,
  ChatMessage,
  Violation
} from '../types';
import { v4 as uuidv4 } from 'uuid';

// -----------------------------------------------------------------------------
// SYSTEM PROMPT
// -----------------------------------------------------------------------------

const CUSTOMER_AGENT_SYSTEM_PROMPT = `
You are Clara, a licensed insurance broker. Your goal is to efficiently collect the essential data for quoting.

**Strict Output Format**:
Your entire response MUST be a single JSON object. Do not include any text outside of the JSON structure.

The JSON object must contain three keys:
1. "thinking": A string explaining your step-by-step reasoning for the response you are about to generate. Analyze what information you have, what you need, and what your next question should be to get it. This is for internal review and must not be shown to the user.
2. "response": A string containing the natural, conversational response to the user.
3. "extractedData": A JSON object containing ONLY the data you have confidently extracted from the user's message.

**Data Schema for "extractedData"**:
Only include fields for which you have extracted data. Do not make up data. Do not include fields with null or empty values.
- "firstName": "string"
- "lastName": "string"
- "dateOfBirth": "string (YYYY-MM-DD)"
- "address": { "street": "string", "city": "string", "state": "string", "zipCode": "string" }
- "vehicleYear": "number"
- "vehicleMake": "string"
- "vehicleModel": "string"
- "annualUsage": "number"
- "violations": ["string"]
- "parking": "string" (accepted values: street, driveway, garage)

**Conversation Style**:
- **Keep it Short**: 1-2 sentences max. Be concise and friendly.
- **Quick Confirmation**: After the customer provides information, include it in your next response (e.g., Got it/Perfect/Sweet/Thanks/Awesome! September 1, 1990. Now, what's the year, make, and model of the vehicle you'd like to insure?")
- **Be Human**: Talk like a real person, not a textbook. Use natural, warm language.
- **Educational and Informative**: If the customer is curious about something about insurance, answer it, then gently guide them back to the conversation.
- **Be Efficient**: Don't ask questions that are already answered. Group relevant questions together (e.g., "What's your full name?" instead of "What's your first name?, "What's your full address?", "What's your vehicle year, make, and model?").

**Examples of Good Responses**:
- "Nice choice on the Tesla Model 3! What's your estimated annual usage in kilometers?"

**Other Instructions**:
- If the customer is not sure about a question/answer, ask them to provide the best guess.
- If the customer asks for a joke, tell them a joke (ONLY ABOUT INSURANCE), but only 3 jokes max. Then guide them back to the conversation.
- If the customer brings up a topic that is not related to insurance, gently guide them back to the conversation.

**Special Instruction for Final Step**:
When all required data fields have been collected, your \`response\` should be a clear, easy-to-read summary formatted **only** as a bullet-point list (use a leading hyphen and a space for each line, e.g. "- Name: Brad Marchand").

Formatting rules for this final summary:
- Start with a short, friendly sentence acknowledging the information (e.g., "Thanks for sharing those details!") that feels natural given the conversation.
- Follow that sentence with a blank line, then the bullet-point list.
- Each data point must appear on its own line preceded by "- ".
- Use plain text – do **not** wrap values in bold, italics, or other markdown.
- After the final bullet point, add a blank line followed by this exact question: "Shall I proceed to generate your tailored quote?" (include the question mark).

**Example Final Confirmation Message** (all data collected):
  \`\`\`json
  {
    "thinking": "All required data has been gathered. Summarising for user confirmation.",
    "response": "- Name: Brad Marchand\n- Date of Birth: July 1, 1990\n- Vehicle: 2023 Tesla Model 3\n- Annual Usage: 11,000 kilometers\n- Parking Location: Garage\n- Address: 1 Street, Toronto, ON, L67 3C0\n- Violations: None\n\nShall I proceed to generate your tailored quote?",
    "extractedData": {
      "firstName": "Brad",
      "lastName": "Marchand",
      "dateOfBirth": "1990-07-01",
      "address": {
        "street": "1 Street",
        "city": "Toronto",
        "state": "ON",
        "zipCode": "L67 3C0"
      },
      "vehicleYear": 2023,
      "vehicleMake": "Tesla",
      "vehicleModel": "Model 3",
      "annualUsage": 11000,
      "violations": [],
      "parking": "Garage"
    }
  }
  \`\`\`

Example Parking Extraction:
User: "It usually sits on the street overnight."
Extracted: { "parking": "street" }
`;

// -----------------------------------------------------------------------------
// AGENT CLASS
// -----------------------------------------------------------------------------

export class CustomerAgent {
  private brain: GeminiService;

  constructor(geminiService: GeminiService) {
    this.brain = geminiService;
    console.log(`[Clara] Stateless CustomerAgent initialized.`);
  }

  public async process(session: Session, message: string): Promise<SessionUpdate> {
    console.log(`[Clara] Processing session ${session.sessionId} with status: ${session.status}`);
    console.log(`[User] 👤 Message for session ${session.sessionId}: "\x1b[34m${message}\x1b[0m"`);
    
    // Initialize newSession here to have it available in the catch block
    const newSession = { 
      ...session, 
      conversationHistory: [...session.conversationHistory], // Ensure deep copy of history
      updatedAt: new Date() 
    };

    const userMessage: ChatMessage = {
      id: uuidv4(),
      type: 'user',
      content: message,
      timestamp: new Date(),
    };
    newSession.conversationHistory.push(userMessage);

    try {
      let responseText: string;

      switch (newSession.status) {
        case 'approved':
          responseText = await this.handleApprovedQuoteDiscussion(newSession, message);
          break;
        case 'rejected':
          responseText = await this.handleRejectedQuoteDiscussion(newSession, message);
          break;
        case 'confirmation':
          return await this.handleConfirmationPhase(newSession, message);
        case 'data_gathering':
        default:
          return await this.handleDataGathering(newSession, message);
      }

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        type: 'agent',
        content: responseText,
        timestamp: new Date(),
      };
      newSession.conversationHistory.push(assistantMessage);

      console.log(`[Clara] 💬 Response for session ${session.sessionId}: "\x1b[34m${responseText}\x1b[0m"`);

      return { session: newSession, response: responseText };

    } catch (error) {
      console.error('[Clara] Error in process:', error);
      const errorResponse = "I apologize for the technical difficulty. I have logged the error and our technical team will investigate. Please try again in a few moments.";
      
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        type: 'agent',
        content: errorResponse,
        timestamp: new Date(),
      };
      newSession.conversationHistory.push(errorMessage);

      return { session: newSession, response: errorResponse };
    }
  }

  private buildDataGatheringContext(session: Session): string {
    // Construct a simplified history for the prompt
    const history = session.conversationHistory.map(turn =>
      `${turn.type === 'user' ? 'User' : 'Agent'}: ${turn.content}`
    ).slice(-10).join('\n'); // Limit to last 10 turns

    const requiredFields = ["firstName", "lastName", "dateOfBirth", "address", "vehicleYear", "vehicleMake", "vehicleModel", "annualUsage", "violations", "parking"];
    const missingFields = requiredFields.filter(field => {
        switch (field) {
            case 'firstName': return !session.customer.profile.firstName;
            case 'lastName': return !session.customer.profile.lastName;
            case 'dateOfBirth': return !session.customer.profile.dateOfBirth;
            case 'address': return !session.customer.profile.address.street || !session.customer.profile.address.city;
            case 'vehicleYear': return !session.customer.vehicle.year;
            case 'vehicleMake': return !session.customer.vehicle.make;
            case 'vehicleModel': return !session.customer.vehicle.model;
            case 'annualUsage': return !session.customer.vehicle.annualUsage;
            case 'violations': return session.customer.profile.driverLicense.violations === null; // Explicitly check for null
            case 'parking': return !session.customer.vehicle.parkingLocation;
            default: return false;
        }
    });

    return `
Conversation History (last 10 turns):
${history}

---
Current Task: Collect user data for an insurance quote.
- Data already collected: ${JSON.stringify(session.customer, null, 2)}
- Data still required: [${missingFields.join(', ')}]
- Your next question should focus on collecting the first item in the 'required' list.
`;
  }

  private async handleDataGathering(session: Session, message: string): Promise<SessionUpdate> {
    const context = this.buildDataGatheringContext(session);

    const rawResponse = await this.brain.reason(
      CUSTOMER_AGENT_SYSTEM_PROMPT,
      message,
      context
    );

    const { thinking, response, extractedData } = this.parseAgentOutput(rawResponse);

    if (thinking) {
      console.log(`[Clara's Brain] 🧠\n${thinking}`);
    }

    if (extractedData) {
      const jsonString = JSON.stringify(extractedData, null, 2);
      // Regex to color values (strings, numbers, booleans) green, leaving keys and braces alone.
      const coloredJson = jsonString.replace(/: ("[^"]*"|[\d.-]+|true|false|null)/g, ': \x1b[32m$1\x1b[0m');
      console.log(`[Clara] 📊 Extracted JSON data:\n`, coloredJson);
      this.updateCustomerData(session.customer, extractedData);
    } else {
      console.log('[Clara] No JSON data was extracted from the response.');
    }

    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      type: 'agent',
      content: response,
      timestamp: new Date(),
    };
    session.conversationHistory.push(assistantMessage);

    console.log(`[Clara] 💬 Response to user: "\x1b[34m${response}\x1b[0m"`);

    if (this.isReadyForHandoff(session)) {
      session.status = 'confirmation';
      console.log(`[Clara] Session ${session.sessionId} entering CONFIRMATION PHASE.`);
    }

    return { session, response };
  }

  private async handleConfirmationPhase(session: Session, message: string): Promise<SessionUpdate> {
    const systemPrompt = `You are Clara confirming next steps after the data summary.

Strictly output a single JSON object with **exactly** two keys:
1. "thinking": your internal reasoning (why you interpret the user's reply as affirmative or not, and what the next action is). This will be logged but hidden from the user.
2. "response": the short, friendly sentence you will show the user.

Rules:
- If the user's message is affirmative (yes, ok, proceed, etc.), "response" must end with an upbeat acknowledgement (e.g., "Fantastic! I'll get started on your quote now.") and you must append the token '[PROCEED_WITH_HANDOFF]' **inside** the same JSON object (still only the two keys!).
- If the user requests changes, write a helpful follow-up question in "response" and DO NOT include the token.
- Keep "response" under 20 words.`;
    
    const context = `The user was just shown this summary and asked to proceed:\nName: ${session.customer.profile.firstName} ${session.customer.profile.lastName}, DOB: ${session.customer.profile.dateOfBirth}, etc.`;

    const rawResponse = await this.brain.reason(systemPrompt, message, context);
    let { thinking, response: cleanResponse } = this.parseAgentOutput(rawResponse);
    cleanResponse = cleanResponse.replace('[PROCEED_WITH_HANDOFF]', '').trim();
    if (thinking) {
      console.log(`[Clara's Brain] 🧠\n${thinking}`);
    }
    const proceeds = rawResponse.includes('[PROCEED_WITH_HANDOFF]');

    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      type: 'agent',
      content: cleanResponse,
      timestamp: new Date(),
    };
    session.conversationHistory.push(assistantMessage);

    if (proceeds) {
      console.log(`[Clara] User approved submission for session ${session.sessionId}`);
      session.stage = 'handoff_complete';
      session.isHandoffComplete = true;
    } else {
      session.status = 'data_gathering';
    }

    console.log(`[Clara] 💬 Confirmation response to user: "\x1b[34m${cleanResponse}\x1b[0m"`);

    return { session, response: cleanResponse };
  }

  // ---------------------------------------------------------------------------
  // APPROVED & REJECTED QUOTE HANDLERS (concise JSON style with visible thinking)
  // ---------------------------------------------------------------------------

  private async handleApprovedQuoteDiscussion(session: Session, message: string): Promise<string> {
    const systemPrompt = `You are Clara, the Trusted Expert Advisor. The user's quote package has been APPROVED.

Strict Output: Return ONE JSON object with exactly two keys:
1. "thinking" – your internal reasoning (why you chose this presentation order, how you interpret the data). Visible only in logs.
2. "response" – what the user sees.

"response" rules (follow the Manifesto for efficiency & empathy):
• Keep TOTAL length under 300 words.
• Plain text only – no **bold**, italics, or markdown asterisks.
• Start with "Hi {firstName}, here are your approved insurance quotes:" on its own line.
• Provide a concise bullet list (use "- " prefix) of each carrier in the form "- Carrier: $Premium". List all 3 carriers.
• After the list, add a blank line and ONE compact paragraph (≤ 3 sentences) focusing primarily on the recommended carrier, explaining why their pricing model best fits the customer's risk profile compared with the others.
• End with a simple question inviting next action (e.g., "Would you like to proceed with Economical Insurance?").
`;

    const context = `Quote Package: ${JSON.stringify({ quotes: session.quotes, recommendation: session.recommendation }, null, 2)}\nCustomer: ${JSON.stringify(session.customer, null, 2)}`;

    const rawResponse = await this.brain.reason(systemPrompt, message, context);
    const { thinking, response } = this.parseAgentOutput(rawResponse);

    if (thinking) {
      console.log(`[Clara's Brain] 🧠\n${thinking}`);
    }

    return response;
  }

  private async handleRejectedQuoteDiscussion(session: Session, message: string): Promise<string> {
    const systemPrompt = `You are Clara, the Trusted Expert Advisor. The user's application has been REJECTED for an automated quote.

Strict Output: ONE JSON object with "thinking" and "response" keys.

"response" rules:
• Under 60 words.
• No markdown formatting characters.
• Empathetic. Do NOT disclose internal rejection reason.
• Explain that a specialist will review and reach out.
`;

    const context = `Internal Rejection Reason (DO NOT SHARE WITH USER): ${session.rejectionReason}`;

    const rawResponse = await this.brain.reason(systemPrompt, message, context);
    const { thinking, response } = this.parseAgentOutput(rawResponse);

    if (thinking) {
      console.log(`[Clara's Brain] 🧠\n${thinking}`);
    }

    return response;
  }

  private updateCustomerData(customer: Customer, extractedData: any): void {
    if (extractedData.firstName) customer.profile.firstName = extractedData.firstName;
    if (extractedData.lastName) customer.profile.lastName = extractedData.lastName;
    if (extractedData.dateOfBirth) customer.profile.dateOfBirth = extractedData.dateOfBirth;
    if (extractedData.address) {
      customer.profile.address = { ...customer.profile.address, ...extractedData.address };
    }

    if (extractedData.vehicleYear) customer.vehicle.year = String(extractedData.vehicleYear);
    if (extractedData.vehicleMake) customer.vehicle.make = extractedData.vehicleMake;
    if (extractedData.vehicleModel) customer.vehicle.model = extractedData.vehicleModel;
    if (extractedData.annualUsage) customer.vehicle.annualUsage = this.parseAnnualUsage(extractedData.annualUsage);
    if (extractedData.parking) customer.vehicle.parkingLocation = extractedData.parking;

    if (Array.isArray(extractedData.violations)) {
      customer.profile.driverLicense.violations = extractedData.violations.map((v: string): Violation => {
        const lower = v.toLowerCase();
        let type: string = 'unknown';
        if (lower.includes('speed')) type = 'speeding_minor';
        else if (lower.includes('accident') || lower.includes('at-fault')) type = 'at_fault_accident';
        else if (lower.includes('dui') || lower.includes('impaired')) type = 'dui';

        // Attempt to extract year (4 digits)
        const yearMatch = v.match(/(20\d{2}|19\d{2})/);
        const yearStr = yearMatch ? yearMatch[1] : undefined;
        const date = yearStr ? `${yearStr}-07-01` : new Date().toISOString().split('T')[0];

        return {
          type: type as any,
          description: v,
          date
        };
      });
    }

    if (!customer.profile.lastName && customer.profile.firstName) {
      const nameParts = customer.profile.firstName.split(' ');
      if (nameParts.length > 1) {
        customer.profile.firstName = nameParts.slice(0, -1).join(' ');
        customer.profile.lastName = nameParts.slice(-1)[0];
      }
    }
  }

  private parseAgentOutput(rawResponse: string): { thinking: string | null; response: string; extractedData: object | null } {
    // The model often wraps the JSON in ```json ... ```. We need to strip this.
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = rawResponse.match(jsonRegex);
    const cleanedResponse = match ? match[1] : rawResponse;

    try {
      const parsedJson = JSON.parse(cleanedResponse);
      const thinking = parsedJson.thinking || null;
      const response = parsedJson.response || "I'm sorry, I seem to be having a technical issue. Could you say that again?";
      const extractedData = parsedJson.extractedData || null;
      return { thinking, response, extractedData };
    } catch (error) {
      console.error('[Clara] Failed to parse JSON from model response:', error);
      console.error('[Clara] Raw response was:', rawResponse);
      // If parsing fails, we assume the entire string is the response and there's no data.
      // This makes the agent resilient to malformed JSON, albeit with data loss for that turn.
      return { thinking: null, response: rawResponse, extractedData: null };
    }
  }

  private isReadyForHandoff(session: Session): boolean {
    const { profile, vehicle } = session.customer;
    const hasName = !!profile.firstName && !!profile.lastName;
    const hasDob = !!profile.dateOfBirth;
    const hasAddress = !!profile.address.street && !!profile.address.city && !!profile.address.state && !!profile.address.zipCode;
    const hasVehicle = !!vehicle.year && !!vehicle.make && !!vehicle.model;
    const hasUsage = !!vehicle.annualUsage;
    const hasParking = !!vehicle.parkingLocation && vehicle.parkingLocation.trim() !== '';
    const hasAddressedViolations = profile.driverLicense.violations !== null;

    return hasName && hasDob && hasAddress && hasVehicle && hasUsage && hasParking && hasAddressedViolations;
  }

  private parseAnnualUsage(annualUsage: any): number {
    if (typeof annualUsage === 'number') {
      return annualUsage;
    }
    if (typeof annualUsage === 'string') {
      const parsed = parseInt(annualUsage.replace(/,/g, '').replace(/km/g, '').trim(), 10);
      return isNaN(parsed) ? 15000 : parsed;
    }
    return 15000;
  }
} 