import type { AIProvider, AskAIParams, AskAIResult } from './types';

const MODEL = 'gemini-2.0-flash-lite';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Models known to support the `systemInstruction` field.
 * gemini-2.0-flash-lite may not support it in all regions/versions,
 * so we attempt with systemInstruction first and fall back to prepending
 * the system prompt as the first user message if the call fails.
 */
const MODELS_WITH_SYSTEM_INSTRUCTION = new Set([
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
]);

/**
 * Gemini AI provider using Google AI Studio free tier.
 * Supports configurable token limits via environment variables:
 *   GEMINI_MAX_TOKENS (default: 8192) — max output tokens per request
 *   GEMINI_TEMPERATURE (default: 0.4) — generation temperature
 *
 * For test case generation, higher token limits are needed (8192).
 * For Q&A chatbot, the default is sufficient.
 *
 * NOTE: gemini-2.0-flash-lite may not support systemInstruction in all
 * configurations. This provider prepends the system prompt to the first
 * user message for models not in the known-safe list, ensuring the system
 * prompt is always respected.
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

    // Determine if this model reliably supports systemInstruction
    const supportsSystemInstruction = MODELS_WITH_SYSTEM_INSTRUCTION.has(MODEL);

    // Gemini uses "model" instead of "assistant" for the AI role
    // If model doesn't support systemInstruction, prepend it to the first user message
    const historyContents = history.map((h) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    }));

    let contents;
    if (supportsSystemInstruction) {
      contents = [
        ...historyContents,
        { role: 'user', parts: [{ text: question }] },
      ];
    } else {
      // Prepend system prompt as part of the first user message content
      const systemPrefixedQuestion = `[System Instructions]\n${systemPrompt}\n\n[User Request]\n${question}`;
      contents = [
        ...historyContents,
        { role: 'user', parts: [{ text: systemPrefixedQuestion }] },
      ];
    }

    // Build request body — only include systemInstruction for supported models
    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: { maxOutputTokens, temperature },
    };
    if (supportsSystemInstruction) {
      requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const response = await fetch(
      `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
