export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskAIParams {
  systemPrompt: string;
  history: ChatTurn[];
  question: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AskAIResult {
  answer: string;
  usage?: TokenUsage;
}

export interface AIProvider {
  name: string;
  askAI(params: AskAIParams): Promise<AskAIResult>;
}
