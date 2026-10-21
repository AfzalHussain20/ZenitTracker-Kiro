'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, Copy, Check, RotateCcw, Sparkles,
  Brain, Loader2, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  agentId?: string;
  confidence?: number;
  toolCalls?: { toolName: string; durationMs?: number; error?: string }[];
  thoughtProcess?: { type: string; content: string }[];
  suggestions?: string[];
  durationMs?: number;
}

const AGENT_META: Record<string, { dot: string; label: string }> = {
  'jira-agent': { dot: 'bg-emerald-500', label: 'Jira Intelligence' },
  'prd-agent': { dot: 'bg-violet-500', label: 'PRD Knowledge' },
  'analytics-agent': { dot: 'bg-amber-500', label: 'Analytics' },
  'devops-agent': { dot: 'bg-blue-500', label: 'DevOps' },
  'qa-agent': { dot: 'bg-rose-500', label: 'QA Strategy' },
};

const QUICK_ACTIONS = [
  { label: 'Sprint health', query: 'How is the current sprint looking? Show velocity and bug count.' },
  { label: 'Top bugs today', query: 'What are the highest priority unresolved bugs right now?' },
  { label: 'Team workload', query: 'Show team health — who is overloaded?' },
  { label: 'Coverage gaps', query: 'What are the biggest test coverage gaps?' },
];

export default function AgentChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); setOpen(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const send = useCallback(async (q?: string) => {
    const text = (q || input).trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    const userMsg: AgentMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, sessionId }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'agent', content: `⚠ ${data.error}`, confidence: 0 }]);
      } else {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'agent',
          content: data.answer || 'No response.',
          agentId: data.agentId,
          confidence: data.confidence,
          toolCalls: data.toolCalls,
          thoughtProcess: data.thoughtProcess,
          suggestions: data.suggestions,
          durationMs: data.durationMs,
        }]);
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('zenit:ai-call-completed'));
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'agent', content: '⚠ Connection error. Try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId]);

  const confidenceColor = (c: number) =>
    c >= 0.8 ? 'text-emerald-500' : c >= 0.5 ? 'text-amber-500' : 'text-red-500';

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="AI Agent (Ctrl+Shift+A)"
          aria-label="Open AI Agent"
          className="fixed bottom-24 right-6 z-[88] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-indigo-500/50"
        >
          <Brain className="h-5 w-5" />
        </button>
      )}

      {/* Agent Panel */}
      {open && (
        <div
          className="fixed bottom-4 right-4 z-[92] flex w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
          style={{ height: 'min(720px, calc(100vh - 2rem))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-indigo-500/10 to-violet-500/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-inset ring-indigo-500/25">
                <Brain className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Zenit Agent</p>
                <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Multi-agent AI · ReAct
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setShowThinking(p => !p)}
                title="Toggle reasoning trace"
                className={cn(
                  'rounded-lg p-1.5 transition-colors',
                  showThinking ? 'bg-indigo-500/15 text-indigo-500' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {showThinking ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  title="Clear conversation"
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
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 ring-1 ring-inset ring-indigo-500/20">
                  <Sparkles className="h-7 w-7 text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Ask the Zenit Agent</p>
                  <p className="mt-1 max-w-[280px] text-xs text-muted-foreground">
                    It routes your question to the right specialist — Jira, PRDs, Analytics, DevOps or QA.
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map(a => (
                    <button
                      key={a.label}
                      onClick={() => send(a.query)}
                      className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground transition-all hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-foreground"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[13px] text-primary-foreground">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {msg.agentId && AGENT_META[msg.agentId] && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium">
                          <span className={cn('h-1.5 w-1.5 rounded-full', AGENT_META[msg.agentId].dot)} />
                          {AGENT_META[msg.agentId].label}
                        </span>
                      )}
                      {msg.confidence !== undefined && (
                        <span className={cn('font-mono text-[10px]', confidenceColor(msg.confidence))}>
                          {Math.round(msg.confidence * 100)}% conf
                        </span>
                      )}
                      {msg.durationMs && (
                        <span className="font-mono text-[10px] text-muted-foreground">{(msg.durationMs / 1000).toFixed(1)}s</span>
                      )}
                    </div>

                    {/* Thought process */}
                    {showThinking && msg.thoughtProcess && msg.thoughtProcess.length > 0 && (
                      <div className="space-y-1 rounded-xl border border-border bg-muted/30 px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Reasoning</p>
                        {msg.thoughtProcess.map((t, ti) => (
                          <p key={ti} className="font-mono text-[10px] text-muted-foreground">
                            <span className="opacity-60">[{t.type}]</span> {t.content.substring(0, 120)}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Tool calls */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.toolCalls.map((tc, ti) => (
                          <span
                            key={ti}
                            className={cn(
                              'rounded-full border px-2 py-0.5 font-mono text-[10px]',
                              tc.error
                                ? 'border-red-500/30 bg-red-500/5 text-red-500'
                                : 'border-indigo-500/30 bg-indigo-500/5 text-indigo-500'
                            )}
                          >
                            ⚙ {tc.toolName} {tc.durationMs ? `(${(tc.durationMs / 1000).toFixed(1)}s)` : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Answer */}
                    <div className="rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-3">
                      <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground">
                        {msg.content}
                      </pre>
                    </div>

                    {/* Suggestions */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {msg.suggestions.map((s, si) => (
                          <button
                            key={si}
                            onClick={() => send(s)}
                            className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1 text-[10px] text-indigo-500 transition-colors hover:bg-indigo-500/10"
                          >
                            {s.length > 50 ? s.substring(0, 50) + '…' : s}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Copy */}
                    <button
                      onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedIdx(msg.id); setTimeout(() => setCopiedIdx(null), 2000); }}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {copiedIdx === msg.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copiedIdx === msg.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 py-1 text-[11px] text-indigo-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Agent reasoning<span className="animate-pulse">…</span></span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-3">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything — I'll route to the right agent…"
              disabled={loading}
              className="h-9 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-indigo-500/50"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
