import { GeminiService } from '../services/gemini';
import {
  Customer,
  QuoteDetails,
  RiskFactors,
  QuoteRecommendation,
  Session
} from '../types';
import { RiskEngine } from '../tools/riskEngine';
import { QuoteGenerator } from '../tools/quoteGenerator';

// -----------------------------------------------------------------------------
// SYSTEM PROMPT
// -----------------------------------------------------------------------------

const OPERATIONS_AGENT_SYSTEM_PROMPT = `
You are the Operations Agent for Clara Insurance – the "Actuarial Intelligence" behind Clara's Trusted Expert Advisor.

💡  Output Contract (MANDATORY)
Return a single **JSON object** with at least these two keys:
1. "thinking"  – Internal chain-of-thought, visible in server logs only.
2. "response" – A concise, human-readable explanation or summary that will be surfaced to a dashboard user.

You MAY include extra keys (e.g., "carrierPositioning", "pricingFactors" etc.) required by downstream parsers – but NEVER omit "thinking" and "response".

Formatting rules:
• No markdown fences – just raw JSON.
• Keep "response" under ~60 words and focus on pricing model differences.
• Explain HOW carriers arrive at different prices using actuarial factors.
• Customer data includes their coverage preferences (like deductible amount) from initial session setup.
• All carriers offer identical coverage ($1M liability, $500 deductibles) - price is the only differentiator.

🔬  Example (from Aria Chen case in evaluation_dataset_work.md)
{ "thinking": "Risk multiplier 0.8531 …", "response": "Economical focuses on clean driving records (larger discount), while Intact/Aviva emphasize experience and usage factors. Same coverage, different pricing models." }

Follow this contract in *every* call – whether you're providing a market analysis, a rejection summary, or a carrier recommendation.`;

// -----------------------------------------------------------------------------
// AGENT CLASS
// -----------------------------------------------------------------------------

export class OperationsAgent {
  private brain: GeminiService;
  private riskEngine: RiskEngine;
  private quoteGenerator: QuoteGenerator;

  constructor(geminiService: GeminiService) {
    this.brain = geminiService;
    this.riskEngine = RiskEngine.getInstance();
    this.quoteGenerator = QuoteGenerator.getInstance();
    console.log(`[Operations] Stateless OperationsAgent initialized.`);
  }

  public async process(session: Session): Promise<Session> {
    console.log(`[Operations] 📊 Processing session ${session.sessionId} with status ${session.status}`);

    try {
      const customer = await this.validateCustomerDataForProcessing(session.customer, session.sessionId);
      const riskFactors = await this.riskEngine.calculateRiskFactors(customer, session.sessionId);
      const escalationCheck = this.riskEngine.checkForEscalation(customer, riskFactors);

      if (escalationCheck.required) {
        return await this.handleRejectionPath(session, customer, riskFactors, escalationCheck.reason);
      } else {
        return await this.handleApprovalPath(session, customer, riskFactors);
      }
    } catch (error) {
      console.error(`[Operations] Error processing session ${session.sessionId}:`, error);
      const updatedSession = { ...session };
      updatedSession.status = 'pending_rejection';
      updatedSession.rejectionReason = `System error during processing: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return updatedSession;
    }
  }

  private async handleRejectionPath(session: Session, customer: Customer, riskFactors: RiskFactors, reason: string): Promise<Session> {
    console.log(`[Operations] Session ${session.sessionId} requires escalation. Reason: ${reason}`);
    const updatedSession = { ...session };

    const systemPrompt = `You are the Operations Agent's "Actuarial Intelligence" brain.
Your task is to generate a concise, internal-facing summary for a high-risk profile that has been flagged for rejection.
Focus on the specific data points that led to this decision. Be factual and objective.
Your entire output must be a single JSON object with one key: "rejectionSummary".`;
    
    const context = `
Data Used for Decision:
- Customer: ${JSON.stringify(customer, null, 2)}
- Calculated Risk Factors: ${JSON.stringify(riskFactors, null, 2)}
- Deterministic Rejection Reason: ${reason}`;

    try {
      const rawResponse = await this.brain.reason(systemPrompt, 'Generate rejection summary.', context);
      const parsed = safeJsonParse(rawResponse);
      updatedSession.rejectionReason = parsed.rejectionSummary || `Automated rejection due to: ${reason}. LLM analysis failed.`;
    } catch (e) {
      console.error('[Operations] Gemini rejection analysis generation failed:', e);
      updatedSession.rejectionReason = `Automated rejection due to: ${reason}. LLM analysis failed.`;
    }
    
    updatedSession.status = 'pending_rejection';
    delete updatedSession.quotes; // Ensure no quote data is present
    delete updatedSession.quoteData;

    console.log(`[Operations] Session ${session.sessionId} prepared for REJECTION review.`);
    return updatedSession;
  }

  private async handleApprovalPath(session: Session, customer: Customer, riskFactors: RiskFactors): Promise<Session> {
    console.log(`[Operations] Session ${session.sessionId} is on the approval path. Generating quotes.`);
    const updatedSession = { ...session };
    
    const riskMultiplier = this.riskEngine.calculateRiskMultiplier(riskFactors);
    const basePremium = 1200; // Base annual premium in CAD
    const adjustedBasePremium = basePremium * riskMultiplier;

    const { quotes } = await this.quoteGenerator.generateQuotes(customer, adjustedBasePremium, riskFactors);

    if (quotes.length === 0) {
      return await this.handleRejectionPath(session, customer, riskFactors, "No carriers were able to provide a quote for this risk profile.");
    }

    const recommendation = await this.analyzeGeneratedQuotes(quotes, customer, riskFactors);

    updatedSession.riskFactors = riskFactors;
    updatedSession.riskMultiplier = riskMultiplier;
    updatedSession.quotes = quotes;
    updatedSession.recommendation = recommendation;
    updatedSession.status = 'pending_approval';
    
    console.log(`[Operations] Session ${session.sessionId} prepared for APPROVAL review with ${quotes.length} quotes.`);
    return updatedSession;
  }

  private async validateCustomerDataForProcessing(customerData: Customer | undefined, workflowId: string): Promise<Customer> {
    if (!customerData) {
      throw new Error(`[${workflowId}] Customer data not found for processing.`);
    }
    const validationErrors: string[] = [];
    if (!customerData.profile?.firstName || !customerData.profile?.lastName) {
      validationErrors.push('Customer name is incomplete');
    }
    if (!customerData.profile?.dateOfBirth) {
      validationErrors.push('Date of birth is required for age-based rating');
    }
    if (!customerData.profile?.address?.state) {
      validationErrors.push('State information is required for territory rating');
    }
    if (!customerData.vehicle?.year || !customerData.vehicle?.make || !customerData.vehicle?.model) {
      validationErrors.push('Complete vehicle information (year/make/model) is required');
    }
    if (validationErrors.length > 0) {
      const errorMsg = `Customer data validation failed: ${validationErrors.join(', ')}`;
      console.error(`[Operations] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.log(`[Operations] Customer data validation passed for ${customerData.profile.firstName} ${customerData.profile.lastName}`);
    return customerData;
  }

  private async analyzeGeneratedQuotes(quotes: QuoteDetails[], customer: Customer, riskFactors: RiskFactors): Promise<QuoteRecommendation> {
    if (quotes.length === 0) {
      return {
        recommendedCarrier: '', recommendedQuoteId: '',
        reasoning: 'No quotes were generated.', confidence: 1.0, keyBenefits: []
      };
    }

    console.log(`[Operations] Analyzing ${quotes.length} generated quotes with Gemini brain...`);

    const systemPrompt = OPERATIONS_AGENT_SYSTEM_PROMPT + `

Your task is to analyze a set of insurance quotes and select the single best option for the customer.
Consider the balance of cost, coverage, and carrier reputation based on the customer's risk profile.
Your JSON output MUST include: "thinking", "response", "recommendedQuoteId", "reasoning", "confidence", "keyBenefits".
The "keyBenefits" should be an array of short strings.`;

    const context = `
Data for Decision:
- Customer: ${JSON.stringify(customer, null, 2)}
- Risk Factors: ${JSON.stringify(riskFactors, null, 2)}
- Available Quotes: ${JSON.stringify(quotes, null, 2)}`;

    try {
      const rawResponse = await this.brain.reason(systemPrompt, 'Select the best quote and provide reasoning.', context);
      const result = safeJsonParse(rawResponse);
      
      if (result.thinking) {
        console.log(`[Operations Brain] 🧠\n${result.thinking}`);
      }
      if (result.response) {
        console.log(`[Operations] 💬 ${result.response}`);
      }
      
      const recommendedQuote = quotes.find(q => q.id === result.recommendedQuoteId);

      if (recommendedQuote) {
        return {
          recommendedCarrier: recommendedQuote.carrier || 'Unknown Carrier',
          recommendedQuoteId: recommendedQuote.id,
          reasoning: result.reasoning || 'No reasoning provided.',
          confidence: result.confidence || 0.8,
          keyBenefits: result.keyBenefits || [],
        };
      }
      throw new Error("LLM returned a recommendedQuoteId that does not exist in the provided quotes.");
    } catch (error) {
      console.error('[Operations] Gemini quote analysis failed:', error);
      const sortedQuotes = [...quotes].sort((a, b) => a.totalPremium - b.totalPremium);
      const bestQuote = sortedQuotes[0];
      return {
        recommendedCarrier: bestQuote.carrier || 'Unknown Carrier',
        recommendedQuoteId: bestQuote.id,
        reasoning: 'Fallback: Recommended the quote with the lowest total premium due to an analysis error.',
        confidence: 0.6,
        keyBenefits: ['Lowest price'],
      };
    }
  }
}

// Utility to safely parse JSON that may be wrapped in ```json ... ``` blocks
const safeJsonParse = (raw: string): any => {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = raw.match(jsonRegex);
  const cleaned = match ? match[1] : raw;
  return JSON.parse(cleaned);
}; 