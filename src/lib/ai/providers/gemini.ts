import type { AIProvider, AskAIParams, AskAIResult } from './types';

const MODEL = 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const geminiProvider: AIProvider = {
  name: 'gemini',

  async askAI({ systemPrompt, history, question }: AskAIParams): Promise<AskAIResult> {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');

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
          generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
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
