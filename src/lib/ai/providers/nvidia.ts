import type { AIProvider, AskAIParams, AskAIResult } from './types';
import { keyPool } from './key-pool';

const MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b';
const ENDPOINT = `${process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`;

export const nvidiaProvider: AIProvider = {
  name: 'nvidia',

  async askAI({ systemPrompt, history, question }: AskAIParams): Promise<AskAIResult> {
    const apiKey = keyPool.getNvidiaKey();
    if (!apiKey) throw new Error('All NVIDIA API keys exhausted');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: question },
    ];

    const maxTokens = parseInt(process.env.NVIDIA_MAX_TOKENS || '4096', 10);
    const temperature = parseFloat(process.env.NVIDIA_TEMPERATURE || '0.3');

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        keyPool.markNvidiaExhausted();
      }
      throw new Error(`NVIDIA API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate an answer.";

    // Extract token usage (OpenAI-compatible format)
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
