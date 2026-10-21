'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Globe, X, Send, FileText, Copy, Check,
  RotateCcw, Search, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { pageId: string; title: string }[];
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
  'Subscription flow?',
  'Auth flow?',
  'Analytics events?',
  'Payment integrations?',
];

export default function GlobalAIChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [prdCount, setPrdCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isJiraPage = pathname?.includes('/analytics') || pathname?.includes('/bugs');
  const isConfluencePage = pathname?.includes('/confluence');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'G') { e.preventDefault(); setOpen(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (isJiraPage || isConfluencePage) return null;

  const send = async (q?: string) => {
    const text = (q || input).trim();
    if (!text || loading) return;
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(p => [...p, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/ask-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history }),
      });
      const data = await res.json();
      if (data.prdCount) setPrdCount(data.prdCount);
      setMessages(p => [...p, {
        role: 'assistant',
        content: data.answer || 'Something went wrong.',
        sources: data.sources || [],
      }]);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('zenit:ai-call-completed'));
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: 'Connection error. Try again.' }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Ask All PRDs (Ctrl+Shift+G)"
          aria-label="Open PRD search"
          className="fixed bottom-40 right-6 z-[88] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-105 hover:shadow-violet-500/50"
        >
          <Globe className="h-5 w-5" />
        </button>
      )}

      {/* Slide-in panel */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-[95] flex w-[min(420px,100vw)] flex-col border-l border-border bg-card text-card-foreground shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-violet-500/10 to-indigo-500/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-inset ring-violet-500/25">
                <Globe className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">PRD Search</p>
                <p className="text-[10px] text-muted-foreground">
                  {prdCount ? `${prdCount} PRDs indexed` : 'All Confluence PRDs'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setPrdCount(null); }}
                  title="Clear"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 ring-1 ring-inset ring-violet-500/20">
                  <Search className="h-7 w-7 text-violet-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Search all PRDs</p>
                  <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
                    Ask anything — I search every Confluence PRD to find the answer.
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground transition-all hover:border-violet-500/40 hover:bg-violet-500/5 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[90%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
                    msg.role === 'user'
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md border border-border bg-muted/40 text-foreground'
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.role === 'assistant' ? fmt(msg.content) : msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2.5 space-y-1 border-t border-border pt-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Sources</p>
                      {msg.sources.map((src, si) => (
                        <a
                          key={si}
                          href={`/confluence?pageId=${src.pageId}`}
                          className="flex items-center gap-1.5 text-[11px] text-violet-500 hover:text-violet-400 hover:underline"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-40" />
                        </a>
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }}
                      className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copiedIdx === i ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">Searching PRDs…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border bg-muted/30 p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask across all PRDs…"
              disabled={loading}
              className="h-9 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500/50"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
