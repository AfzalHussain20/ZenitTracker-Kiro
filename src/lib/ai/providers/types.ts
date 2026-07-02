export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskAIParams {
  systemPrompt: string;
  history: ChatTurn[];
  question: string;
}

export interface AskAIResult {
  answer: string;
}

export interface AIProvider {
  name: string;
  askAI(params: AskAIParams): Promise<AskAIResult>;
}
