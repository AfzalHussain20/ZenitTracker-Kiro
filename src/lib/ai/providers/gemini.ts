import type { AIProvider, AskAIParams, AskAIResult } from './types';

const MODEL = 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini AI provider using Google AI Studio free tier.
 * Supports configurable token limits via environment variables:
 *   GEMINI_MAX_TOKENS (default: 8192) — max output tokens per request
 *   GEMINI_TEMPERATURE (default: 0.4) — generation temperature
 *
 * For test case generation, higher token limits are needed (8192).
 * For Q&A chatbot, the default is sufficient.
 */
export const geminiProvider: AIProvider = {
  name: 'gemini',

  async askAI({ systemPrompt, history, question }: AskAIParams): Promise<AskAIResult> {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');

    // Use higher defaults suitable for structured generation (test cases)
    // These work fine for Q&A too — Gemini stops early if the answer is short
    const maxOutputTokens = parseInt(process.env.GEMINI_MAX_TOKENS || '8192', 10);
    const temperature = parseFloat(process.env.GEMINI_TEMPERATURE || '0.4');

    // Gemini uses "model" instead of "assistant" for the AI role
    const contents = [
      ...history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: question }] },
    ];

    const response = await fetch(
      `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens, temperature },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      let errMessage = errText;
      try {
        const errJson = JSON.parse(errText).error || {};
        errMessage = errJson.message || errText;
      } catch { /* use raw text */ }

      if (response.status === 429) {
        throw new Error(`429: Gemini rate limit exceeded. ${errMessage}`);
      }
      throw new Error(`Gemini API error (${response.status}): ${errMessage}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      const blockReason = data.promptFeedback?.blockReason;
      if (blockReason) {
        return { answer: "I can't answer that one — it was flagged by content filters. Try rephrasing." };
      }
      return { answer: "Sorry, I couldn't generate an answer." };
    }

    const answer = candidate.content?.parts?.map((p: any) => p.text).join('') ?? "Sorry, I couldn't generate an answer.";
    return { answer };
  },
};
