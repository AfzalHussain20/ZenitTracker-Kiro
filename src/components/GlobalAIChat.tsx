'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Globe, X, Send, FileText, Copy, Check,
  RotateCcw, Search, ExternalLink, Sparkles,
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
  "Subscription flow?",
  "Auth flow?",
  "Analytics events?",
  "Payment integrations?",
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

  // Only show on Confluence-related pages and dashboard
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

  // Don't render on Jira/analytics pages — no PRD context needed there
  // Don't render on Confluence page — ChatPanel handles it there
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
      setMessages(p => [...p, { role: 'assistant', content: "Connection error. Try again." }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Pill button — sits left of "Ask AI" PRD button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Ask All PRDs (Ctrl+Shift+G)"
          className="fixed bottom-6 right-[156px] z-[88] flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg hover:shadow-violet-500/25 hover:scale-105 transition-all"
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold">All PRDs</span>
        </button>
      )}

      {/* Slide-in panel from right */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-[95] w-[400px] flex flex-col shadow-2xl border-l border-violet-500/20 bg-[#0d0d1a]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-violet-500/20 bg-gradient-to-r from-violet-900/60 to-indigo-900/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Globe className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">PRD Search</p>
                <p className="text-[10px] text-violet-300/70">
                  {prdCount ? `${prdCount} PRDs indexed` : 'All Confluence PRDs'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setPrdCount(null); }}
                  className="p-1.5 rounded-lg text-violet-400/60 hover:text-violet-300 hover:bg-violet-500/10 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-violet-400/60 hover:text-white hover:bg-violet-500/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-5">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Search className="w-7 h-7 text-violet-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white mb-1">Search all PRDs</p>
                  <p className="text-xs text-zinc-500 max-w-[260px]">Ask anything — I search every Confluence PRD to find the answer.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-[11px] text-left px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/60 hover:border-violet-500/40 hover:bg-violet-500/5 text-zinc-400 hover:text-violet-300 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[90%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-zinc-900 text-zinc-100 border border-zinc-700/50 rounded-bl-sm'
                )}>
                  <div className="whitespace-pre-wrap">{msg.role === 'assistant' ? fmt(msg.content) : msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-zinc-700/40 space-y-1">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Sources</p>
                      {msg.sources.map((src, si) => (
                        <a key={si} href={`/confluence?pageId=${src.pageId}`}
                          className="flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300 hover:underline">
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-40" />
                        </a>
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' && (
                    <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }}
                      className="flex items-center gap-1 mt-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
                      {copiedIdx === i ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedIdx === i ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                  </div>
                  <span className="text-xs text-zinc-500">Searching PRDs…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask across all PRDs…"
              disabled={loading}
              className="flex-1 h-9 px-3 text-sm bg-zinc-900 border border-zinc-700/60 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="h-9 w-9 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 flex items-center justify-center text-white transition-colors shrink-0">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
