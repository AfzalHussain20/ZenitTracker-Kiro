'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  X, Send, FileText, Copy, Check, RotateCcw,
  Sparkles, BookOpen, ChevronRight,
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

function fmt(text: string) {
  return text
    .replace(/^\s*\*\s+/gm, '• ')
    .replace(/^\s*-\s+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

const SUGGESTIONS = [
  { label: 'Key features', q: 'What are the key features?' },
  { label: 'User flow', q: 'Summarize the main user flow' },
  { label: 'Edge cases', q: 'What edge cases are covered?' },
  { label: 'Validations', q: 'What validations are required?' },
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
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const send = async (q?: string) => {
    const text = (q || input).trim();
    if (!text || loading) return;
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(p => [...p, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, question: text, history }),
      });
      const data = await res.json();
      setMessages(p => [...p, {
        role: 'assistant',
        content: data.answer || 'Something went wrong.',
        citedSection: data.citedSection,
      }]);
      // Notify quota badge to refresh
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('zenit:ai-call-completed'));
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: "Connection error. Try again." }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Pill button — original Ask AI style, above Notes widget */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Ask AI about this PRD"
          className="fixed bottom-6 right-20 z-[90] flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-primary/25 hover:scale-105 transition-all"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold">Ask AI</span>
        </button>
      )}

      {/* Compact sidebar panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-[90] w-[380px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 'min(600px, calc(100vh - 2rem))' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/8 to-primary/3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">PRD Assistant</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[220px]">{pageTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <button onClick={() => setMessages([])}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="flex flex-col h-full pt-4 gap-4">
                <div className="flex items-center gap-2.5 px-1">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Ask anything about this doc</p>
                    <p className="text-[10px] text-muted-foreground">Flows, validations, edge cases…</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground px-1 uppercase tracking-wider">Quick starts</p>
                  {SUGGESTIONS.map(s => (
                    <button key={s.label} onClick={() => send(s.q)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/5 border border-border/50 hover:border-primary/20 text-left transition-all group">
                      <span className="text-xs text-foreground/70 group-hover:text-foreground">{s.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm ml-8'
                    : 'bg-muted/50 text-foreground border border-border/40 rounded-bl-sm'
                )}>
                  <div className="whitespace-pre-wrap">{msg.role === 'assistant' ? fmt(msg.content) : msg.content}</div>

                  {msg.citedSection && (
                    <button onClick={() => onJumpToSection?.(msg.citedSection!)}
                      className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30 text-[10px] text-primary hover:underline">
                      <FileText className="w-3 h-3 shrink-0" />
                      See: {msg.citedSection}
                    </button>
                  )}

                  {msg.role === 'assistant' && (
                    <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }}
                      className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                      {copiedIdx === i ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedIdx === i ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                </div>
                <div className="bg-muted/50 border border-border/40 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex gap-1 items-center">
                  {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-2.5 border-t border-border/60 flex items-center gap-2 bg-muted/5">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about this PRD…"
              disabled={loading}
              className="flex-1 h-8 px-3 text-[12px] bg-background border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center text-primary-foreground transition-colors shrink-0">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
