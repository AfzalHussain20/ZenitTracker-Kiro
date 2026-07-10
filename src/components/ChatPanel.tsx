'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageCircle, X, Send, Loader2, FileText, Copy, Check,
  Sparkles, RotateCcw, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citedSection?: string | null;
}

interface ChatPanelProps {
  pageId: string;
  pageTitle: string;
  onJumpToSection?: (section: string) => void;
}

/** Format AI response — convert *bullets and **bold to proper display */
function formatResponse(text: string): string {
  return text
    // Convert "* item" to "• item"
    .replace(/^\s*\*\s+/gm, '• ')
    // Convert "- item" to "• item"
    .replace(/^\s*-\s+/gm, '• ')
    // Remove ** bold markers (display as plain — we handle emphasis via context)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove single * emphasis
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

const SUGGESTIONS = [
  'What are the key features?',
  'What edge cases are covered?',
  'Summarize the user flow',
  'What validations are needed?',
];

export default function ChatPanel({ pageId, pageTitle, onJumpToSection }: ChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => { setMessages([]); }, [pageId]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const sendQuestion = async (question?: string) => {
    const q = (question || input).trim();
    if (!q || loading) return;

    const newUserMsg: ChatMessage = { role: 'user', content: q };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, question: q, history }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || data.error || "Something went wrong. Try again?",
          citedSection: data.citedSection,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Couldn't reach the AI. Check your connection." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleClear = () => { setMessages([]); };

  return (
    <>
      {/* Floating trigger — positioned to avoid Notes widget */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-20 z-[90] flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold">Ask AI</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-[90] w-[400px] sm:w-[440px] h-[600px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">PRD Assistant</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[240px]">{pageTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={handleClear} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Clear chat">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">Ask anything about this PRD</p>
                  <p className="text-xs text-muted-foreground">Flows, validations, edge cases, business rules...</p>
                </div>
                {/* Quick suggestions */}
                <div className="grid grid-cols-2 gap-2 w-full max-w-[300px] mt-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => sendQuestion(s)}
                      className="text-[11px] text-left px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted/50 text-foreground border border-border/40 rounded-bl-md'
                )}>
                  {/* Formatted response */}
                  <div className="whitespace-pre-wrap">
                    {msg.role === 'assistant' ? formatResponse(msg.content) : msg.content}
                  </div>

                  {/* Cited section link */}
                  {msg.citedSection && (
                    <button onClick={() => onJumpToSection?.(msg.citedSection!)}
                      className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30 text-[11px] text-primary hover:underline w-full text-left">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">See: {msg.citedSection}</span>
                    </button>
                  )}

                  {/* Copy button for AI messages */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-2 pt-1">
                      <button onClick={() => handleCopy(msg.content, i)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                        {copiedIdx === i ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copiedIdx === i ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted/50 border border-border/40 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground ml-1">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-muted/10 flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }}
              placeholder="Ask about this PRD..."
              disabled={loading}
              className="flex-1 h-10 text-sm bg-card border-border/60 rounded-xl focus-visible:ring-primary/30"
            />
            <Button
              size="icon"
              onClick={() => sendQuestion()}
              disabled={loading || !input.trim()}
              className="h-10 w-10 rounded-xl shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
