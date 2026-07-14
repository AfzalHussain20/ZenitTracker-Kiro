import type { AIProvider, AskAIParams, AskAIResult } from './types';
import { keyPool } from './key-pool';

const MODEL = 'llama-3.3-70b-versatile';

export const groqProvider: AIProvider = {
  name: 'groq',

  async askAI({ systemPrompt, history, question }: AskAIParams): Promise<AskAIResult> {
    const apiKey = keyPool.getGroqKey();
    if (!apiKey) throw new Error('All Groq API keys exhausted');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: question },
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        keyPool.markGroqExhausted();
      }
      throw new Error(`Groq API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate an answer.";

    // Extract token usage from Groq response (OpenAI-compatible format)
    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined;

    return { answer, usage };
  },
};
