'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, X, Send, Copy, Check, RotateCcw, Sparkles,
  Brain, Loader2, ChevronRight, Zap, Eye, EyeOff,
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

const AGENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'jira-agent': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Jira Intelligence' },
  'prd-agent': { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'PRD Knowledge' },
  'analytics-agent': { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Analytics' },
  'devops-agent': { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'DevOps' },
  'qa-agent': { bg: 'bg-rose-500/10', text: 'text-rose-400', label: 'QA Strategy' },
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

  // Keyboard shortcut: Ctrl+Shift+A
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
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'agent',
          content: `⚠ ${data.error}`, confidence: 0,
        }]);
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
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'agent', content: '⚠ Connection error. Try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId]);

  const confidenceColor = (c: number) =>
    c >= 0.8 ? 'text-emerald-400' : c >= 0.5 ? 'text-amber-400' : 'text-red-400';

  return (
    <>
      {/* FAB */}
      {!open && (
        <button onClick={() => setOpen(true)} title="AI Agent (Ctrl+Shift+A)"
          className="fixed bottom-6 left-6 z-[88] w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg shadow-indigo-500/30 hover:scale-110 hover:shadow-indigo-500/50 transition-all flex items-center justify-center">
          <Brain className="w-5 h-5" />
        </button>
      )}

      {/* Agent Panel */}
      {open && (
        <div className="fixed bottom-4 left-4 z-[92] w-[460px] rounded-2xl overflow-hidden shadow-2xl shadow-black/60 flex flex-col border border-indigo-500/20"
          style={{ height: 'min(720px, calc(100vh - 2rem))', background: '#0a0a1a' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-500/20 bg-gradient-to-r from-indigo-950/80 to-purple-950/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Brain className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Zenit Agent</p>
                <p className="text-[10px] text-indigo-300/60">Multi-agent AI · ReAct pattern</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowThinking(p => !p)} title="Toggle thinking"
                className={cn('p-1.5 rounded-lg transition-colors', showThinking ? 'text-indigo-400 bg-indigo-500/10' : 'text-indigo-700 hover:text-indigo-400')}>
                {showThinking ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])}
                  className="p-1.5 rounded-lg text-indigo-700 hover:text-indigo-400 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-indigo-700 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-indigo-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white mb-1">Zenit AI Agent</p>
                  <p className="text-xs text-zinc-500 max-w-[280px]">Ask anything — I route to the right specialist agent (Jira, PRDs, Analytics, DevOps, QA).</p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {QUICK_ACTIONS.map(a => (
                    <button key={a.label} onClick={() => send(a.query)}
                      className="text-[11px] text-left px-3 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-700/50 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-zinc-400 hover:text-indigo-300 transition-all">
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
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 bg-indigo-600 text-white text-[13px]">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Agent badge */}
                    <div className="flex items-center gap-2">
                      {msg.agentId && AGENT_COLORS[msg.agentId] && (
                        <span className={cn('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', AGENT_COLORS[msg.agentId].bg, AGENT_COLORS[msg.agentId].text)}>
                          {AGENT_COLORS[msg.agentId].label}
                        </span>
                      )}
                      {msg.confidence !== undefined && (
                        <span className={cn('text-[9px] font-mono', confidenceColor(msg.confidence))}>
                          {Math.round(msg.confidence * 100)}% conf
                        </span>
                      )}
                      {msg.durationMs && (
                        <span className="text-[9px] text-zinc-600 font-mono">{(msg.durationMs / 1000).toFixed(1)}s</span>
                      )}
                    </div>

                    {/* Thought process (collapsible) */}
                    {showThinking && msg.thoughtProcess && msg.thoughtProcess.length > 0 && (
                      <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 px-3 py-2 space-y-1">
                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Thinking</p>
                        {msg.thoughtProcess.map((t, ti) => (
                          <p key={ti} className="text-[10px] text-zinc-500 font-mono">
                            <span className="text-zinc-600">[{t.type}]</span> {t.content.substring(0, 120)}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Tool calls */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.toolCalls.map((tc, ti) => (
                          <span key={ti} className={cn('text-[9px] px-2 py-0.5 rounded-full font-mono border',
                            tc.error ? 'border-red-500/30 text-red-400 bg-red-500/5' : 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5')}>
                            ⚙ {tc.toolName} {tc.durationMs ? `(${(tc.durationMs/1000).toFixed(1)}s)` : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Main answer */}
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3">
                      <pre className="text-[13px] text-zinc-100 whitespace-pre-wrap break-words font-sans leading-relaxed">
                        {msg.content}
                      </pre>
                    </div>

                    {/* Suggestions */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.suggestions.map((s, si) => (
                          <button key={si} onClick={() => send(s)}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                            {s.length > 50 ? s.substring(0, 50) + '…' : s}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Copy button */}
                    <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedIdx(msg.id); setTimeout(() => setCopiedIdx(null), 2000); }}
                      className="flex items-center gap-1 text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors">
                      {copiedIdx === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedIdx === msg.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-[11px] text-indigo-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Agent reasoning<span className="animate-pulse">...</span></span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-indigo-900/30 bg-zinc-950/80 flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything — I'll route to the right agent…"
              disabled={loading}
              className="flex-1 h-9 px-3 text-sm bg-zinc-900 border border-zinc-700/60 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center text-white transition-colors shrink-0">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
