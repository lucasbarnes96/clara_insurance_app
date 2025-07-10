import { GoogleGenAI } from '@google/genai';

export class GeminiService {
  private ai: GoogleGenAI;
  private static instance: GeminiService;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    console.log('[Gemini Service] Initialized');
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Transcribe audio to text using Gemini's audio understanding capabilities
   * @param audioBuffer The audio data as a Buffer
   * @param mimeType The MIME type of the audio
   * @param prompt Optional prompt to guide transcription
   * @returns Transcribed text
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
    prompt?: string
  ): Promise<string> {
    const maxRetries = 3;
    const baseDelay = 1000;
    const timeout = 45000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const model = 'gemini-2.0-flash-exp'; // Use experimental model for audio

        console.log(`[Gemini Service] 🎙️ Transcribing audio (attempt ${attempt}/${maxRetries})...`);

        const result = await Promise.race([
          this.ai.models.generateContent({
            model,
            contents: [{
              role: 'user',
              parts: [
                { text: prompt || 'Please transcribe this audio to text.' },
                {
                  inlineData: {
                    data: audioBuffer.toString('base64'),
                    mimeType: mimeType
                  }
                }
              ]
            }]
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Audio transcription timeout after ${timeout / 1000} seconds`)), timeout)
          ),
        ]) as any;

        const responseText = result.text;

        if (!responseText) {
          console.warn(`[Gemini Service] Transcription attempt ${attempt} yielded an empty response.`);
          throw new Error('Empty transcription response received from the model.');
        }

        console.log(`[Gemini Service] ✅ Audio transcription completed on attempt ${attempt}`);
        return responseText.trim();

      } catch (error: any) {
        console.error(`[Gemini Service] Transcription attempt ${attempt} failed:`, error.message || error);

        const isServiceUnavailable =
          error?.status === 503 ||
          (error?.message && (error.message.includes('503') || error.message.includes('overloaded') || error.message.includes('unavailable')));

        const isBlocked = error?.message && error.message.includes('blocked');

        if (isBlocked) {
          console.error('[Gemini Service] Audio transcription was blocked and will not be retried.');
          throw new Error(`Content moderation error: ${error.message}`);
        }

        if (isServiceUnavailable && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`[Gemini Service] Service unavailable, retrying transcription in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (attempt >= maxRetries) {
          console.error(`[Gemini Service] All transcription attempts failed. Final error:`, error.message || error);
          throw new Error(`Failed to transcribe audio after ${attempt} attempts.`);
        }
      }
    }
    throw new Error('Unexpected error in the audio transcription loop.');
  }

  /**
   * The foundational "mind" for all agents. This is the single, centralized method
   * for communicating with the Gemini 2.5 Flash model. It handles the core logic of
   * API calls, including robust error handling, exponential backoff for retries,
   * and timeouts to ensure system stability.
   *
   * @param systemPrompt The system-level instructions that define the agent's persona and core mandate.
   * @param userPrompt The specific user query or task for the agent to process.
   * @param context Optional additional context, such as conversation history or current data.
   * @returns A string containing the raw, complete response from the language model.
   */
  async reason(
    systemPrompt: string,
    userPrompt: string,
    context?: string
  ): Promise<string> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    const timeout = 45000; // 45 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const model = 'gemini-2.5-flash'; // The official, stable model as per CPO directive

        const fullPrompt = [
          `System Prompt: ${systemPrompt}`,
          context && `Context:\n${context}`,
          `User Query:\n${userPrompt}`
        ].filter(Boolean).join('\n\n');

        console.log(`[Gemini Service] Reasoning attempt ${attempt}/${maxRetries} with model ${model}...`);

        const result = await Promise.race([
          this.ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Gemini reasoning timeout after ${timeout / 1000} seconds`)), timeout)
          ),
        ]) as any;

        const responseText = result.text;

        if (!responseText) {
          console.warn(`[Gemini Service] Attempt ${attempt} yielded an empty response.`);
          throw new Error('Empty response received from the model.');
        }

        console.log(`[Gemini Service] Reasoning completed successfully on attempt ${attempt}.`);
        return responseText.trim();

      } catch (error: any) {
        console.error(`[Gemini Service] Reasoning attempt ${attempt} failed:`, error.message || error);

        const isServiceUnavailable =
          error?.status === 503 ||
          (error?.message && (error.message.includes('503') || error.message.includes('overloaded') || error.message.includes('unavailable')));

        const isBlocked = error?.message && error.message.includes('blocked');

        if (isBlocked) {
          console.error('[Gemini Service] Request was blocked and will not be retried.');
          throw new Error(`Content moderation error: ${error.message}`);
        }

        if (isServiceUnavailable && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[Gemini Service] Service unavailable, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (attempt >= maxRetries) {
          console.error(`[Gemini Service] All reasoning attempts failed. Final error:`, error.message || error);
          throw new Error(`Failed to get a response from Gemini after ${attempt} attempts.`);
        }
      }
    }
    throw new Error('Unexpected error in the reasoning loop. Please check the implementation.');
  }
} 