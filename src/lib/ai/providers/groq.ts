import type { AIProvider, AskAIParams, AskAIResult } from './types';

const MODEL = 'llama-3.3-70b-versatile';

export const groqProvider: AIProvider = {
  name: 'groq',

  async askAI({ systemPrompt, history, question }: AskAIParams): Promise<AskAIResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

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
      throw new Error(`Groq API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate an answer.";
    return { answer };
  },
};
