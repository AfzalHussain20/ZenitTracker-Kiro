'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, Copy, Check, RotateCcw, BarChart2,
  Database, Loader2, Users, AtSign, Search,
  ChevronRight, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  issueCount?: number;
}

interface JiraUser {
  accountId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

interface MentionOption {
  id: string;
  label: string;
  sublabel?: string;
  avatar?: string;
  category: 'alias' | 'team' | 'platform' | 'priority' | 'status';
  query: string; // The text inserted after selection
}

// ─── Static options that don't require API calls ──────────────────────────────
const PLATFORM_OPTIONS: MentionOption[] = [
  { id: 'p-atv', label: 'Android TV', category: 'platform', query: 'platform Android TV' },
  { id: 'p-ftv', label: 'Fire TV', category: 'platform', query: 'platform Fire TV' },
  { id: 'p-atv2', label: 'Apple TV', category: 'platform', query: 'platform Apple TV' },
  { id: 'p-sam', label: 'Samsung TV', category: 'platform', query: 'platform Samsung TV' },
  { id: 'p-lg', label: 'LG TV', category: 'platform', query: 'platform LG TV' },
  { id: 'p-roku', label: 'Roku', category: 'platform', query: 'platform Roku' },
  { id: 'p-web', label: 'Web', category: 'platform', query: 'platform Web' },
  { id: 'p-and', label: 'Android Mobile', category: 'platform', query: 'platform Android' },
  { id: 'p-ios', label: 'iOS Mobile', category: 'platform', query: 'platform iOS' },
];

const PRIORITY_OPTIONS: MentionOption[] = [
  { id: 'pr-p0', label: 'P0 / Highest', sublabel: 'Critical blockers', category: 'priority', query: 'priority Highest (P0)' },
  { id: 'pr-p1', label: 'P1 / High', sublabel: 'Major issues', category: 'priority', query: 'priority High (P1)' },
  { id: 'pr-p2', label: 'P2 / Medium', sublabel: 'Normal priority', category: 'priority', query: 'priority Medium (P2)' },
  { id: 'pr-p3', label: 'P3 / Low', sublabel: 'Minor issues', category: 'priority', query: 'priority Low (P3)' },
];

const STATUS_OPTIONS: MentionOption[] = [
  { id: 'st-open', label: 'Open', category: 'status', query: 'status Open' },
  { id: 'st-inprog', label: 'In Progress', category: 'status', query: 'status In Progress' },
  { id: 'st-done', label: 'Done / Resolved', category: 'status', query: 'status Done' },
  { id: 'st-closed', label: 'Closed', category: 'status', query: 'status Closed' },
];

const INVESTIGATIONS = [
  {
    q: 'Full postmortem — duplicate bugs, same-day multi-platform filings, velocity spikes, all suspicious patterns, verdict and next steps',
    icon: '🔬',
    label: 'Full Postmortem',
    tip: 'Type @ to select a person first',
  },
  {
    q: 'Who filed the most bugs this month? Show count, daily rate, platform spread. Flag anyone above 2x team average.',
    icon: '🏆',
    label: 'Top Filers',
    tip: null,
  },
  {
    q: 'Show all duplicate and repeat bug filings this month — same title filed multiple times by the same person, list ticket IDs',
    icon: '♻️',
    label: 'Duplicate Bugs',
    tip: null,
  },
  {
    q: 'Who has the lowest resolution rate this month? Show filed vs resolved per person. Flag suspicious patterns.',
    icon: '⚠️',
    label: 'Low Resolve Rate',
    tip: null,
  },
  {
    q: 'P1 and Highest priority bugs still unresolved — list all with reporter name, date filed, and current status',
    icon: '🔥',
    label: 'P1 Unresolved',
    tip: null,
  },
  {
    q: 'Show velocity spikes this month — anyone who filed 5+ bugs in a single day? List dates, person, and count.',
    icon: '⚡',
    label: 'Velocity Spikes',
    tip: null,
  },
];

function fmt(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .trim();
}

function detectSectionType(header: string): string {
  const h = header.toLowerCase();
  if (h.includes('verdict')) return 'verdict';
  if (h.includes('next step')) return 'nextsteps';
  if (h.includes('duplicate') || h.includes('repeat')) return 'duplicate';
  if (h.includes('same-day') || h.includes('multi-platform')) return 'multiplatform';
  if (h.includes('spike') || h.includes('velocity')) return 'spike';
  if (h.includes('suspicious')) return 'suspicious';
  if (h.includes('overview')) return 'overview';
  return 'default';
}

function getSectionColors(type: string) {
  switch (type) {
    case 'verdict': return { border: 'border-red-500/40', headerBg: 'bg-red-500/15', headerText: 'text-red-400' };
    case 'nextsteps': return { border: 'border-blue-500/30', headerBg: 'bg-blue-500/10', headerText: 'text-blue-400' };
    case 'duplicate': return { border: 'border-amber-500/40', headerBg: 'bg-amber-500/15', headerText: 'text-amber-400' };
    case 'multiplatform': return { border: 'border-orange-500/40', headerBg: 'bg-orange-500/15', headerText: 'text-orange-400' };
    case 'spike': return { border: 'border-rose-500/40', headerBg: 'bg-rose-500/15', headerText: 'text-rose-400' };
    case 'suspicious': return { border: 'border-yellow-500/40', headerBg: 'bg-yellow-500/15', headerText: 'text-yellow-400' };
    case 'overview': return { border: 'border-cyan-500/30', headerBg: 'bg-cyan-500/10', headerText: 'text-cyan-400' };
    default: return { border: 'border-emerald-900/50', headerBg: 'bg-emerald-950/50', headerText: 'text-emerald-500' };
  }
}

function getVerdictColor(line: string): string {
  const l = line.toLowerCase();
  if (l.includes('critical')) return 'text-red-400 font-bold';
  if (l.includes('high')) return 'text-orange-400 font-bold';
  if (l.includes('medium')) return 'text-yellow-400 font-bold';
  if (l.includes('low')) return 'text-emerald-400 font-bold';
  return 'text-emerald-200';
}

// Renders structured ┌ │ └ box output from the AI into styled section cards
function renderOutput(text: string): React.ReactNode {
  const lines = fmt(text).split('\n');
  const sections: { header: string; body: string[]; type: string }[] = [];
  let current: { header: string; body: string[]; type: string } | null = null;

  for (const line of lines) {
    if (line.startsWith('═══') || line.startsWith('===')) {
      sections.push({ header: line.replace(/[═=]/g, '').trim(), body: [], type: 'title' });
    } else if (line.startsWith('┌') || line.startsWith('+--')) {
      const header = line.replace(/^[┌+\-\s]+/, '').trim();
      current = { header, body: [], type: detectSectionType(header) };
    } else if ((line.startsWith('│') || line.startsWith('|')) && current) {
      const content = line.replace(/^[│|]\s?/, '').trim();
      if (content) current.body.push(content);
    } else if ((line.startsWith('└') || line.startsWith('+')) && current) {
      sections.push(current);
      current = null;
    } else if (line.trim()) {
      if (current) {
        current.body.push(line.trim());
      } else {
        sections.push({ header: '', body: [line.trim()], type: 'text' });
      }
    }
  }
  if (current) sections.push(current);

  // If no structured sections found, render plain
  if (sections.length === 0 || sections.every(s => s.type === 'text')) {
    return (
      <pre className="text-[11px] text-emerald-200 font-mono leading-relaxed whitespace-pre-wrap break-words">
        {fmt(text)}
      </pre>
    );
  }

  return (
    <div className="space-y-2.5">
      {sections.map((s, i) => {
        if (s.type === 'title') {
          return (
            <p key={i} className="text-emerald-400 font-mono font-bold text-[12px] border-b border-emerald-800/60 pb-1.5 pt-0.5">
              {s.header}
            </p>
          );
        }
        if (s.type === 'text') {
          return (
            <p key={i} className="text-[11px] text-emerald-300/80 font-mono leading-relaxed">
              {s.body.join(' ')}
            </p>
          );
        }
        const colors = getSectionColors(s.type);
        return (
          <div key={i} className={`rounded-lg border overflow-hidden ${colors.border}`}>
            {s.header && (
              <div className={`px-3 py-1.5 border-b ${colors.border} ${colors.headerBg}`}>
                <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${colors.headerText}`}>
                  {s.header}
                </span>
              </div>
            )}
            <div className="px-3 py-2 space-y-0.5 bg-black/30">
              {s.body.map((line, li) => (
                <p key={li} className={`text-[11px] font-mono leading-relaxed ${
                  line.startsWith('⚠') || line.startsWith('!') ? 'text-amber-400 font-semibold' :
                  s.type === 'verdict' ? getVerdictColor(line) :
                  s.type === 'nextsteps' ? 'text-blue-300' :
                  /SUN-\d+/.test(line) ? 'text-cyan-300' :
                  'text-emerald-200'
                }`}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  alias: 'text-cyan-400',
  team: 'text-violet-400',
  platform: 'text-amber-400',
  priority: 'text-red-400',
  status: 'text-emerald-400',
};

const CATEGORY_BG: Record<string, string> = {
  alias: 'bg-cyan-500/10 border-cyan-500/20',
  team: 'bg-violet-500/10 border-violet-500/20',
  platform: 'bg-amber-500/10 border-amber-500/20',
  priority: 'bg-red-500/10 border-red-500/20',
  status: 'bg-emerald-500/10 border-emerald-500/20',
};

export default function JiraInsightsChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Mention picker state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionOptions, setMentionOptions] = useState<MentionOption[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [allUsers, setAllUsers] = useState<JiraUser[]>([]);
  const [allTeams, setAllTeams] = useState<{ id: string; name: string }[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);

  // Load users + teams once when chat opens
  useEffect(() => {
    if (!open || allUsers.length > 0) return;
    setLoadingUsers(true);
    Promise.all([
      fetch('/api/jira/users').then(r => r.json()).catch(() => ({ users: [] })),
      fetch('/api/jira/teams').then(r => r.json()).catch(() => ({ teams: [] })),
    ]).then(([userData, teamData]) => {
      setAllUsers(userData.users || []);
      setAllTeams((teamData.teams || []).map((t: any) => ({ id: t.id, name: t.name })));
    }).finally(() => setLoadingUsers(false));
  }, [open, allUsers.length]);

  // Build mention options whenever query changes
  useEffect(() => {
    if (!mentionOpen) return;
    const q = mentionQuery.toLowerCase();

    const userOptions: MentionOption[] = allUsers
      .filter(u => !q || u.displayName.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      .slice(0, 8)
      .map(u => ({
        id: `u-${u.accountId}`,
        label: u.displayName,
        sublabel: u.email,
        avatar: u.avatarUrl,
        category: 'alias' as const,
        query: `full postmortem on "${u.displayName}" — duplicate bugs, same-day multi-platform filings, velocity spikes, suspicious patterns, verdict and next steps`,
      }));

    const teamOptions: MentionOption[] = allTeams
      .filter(t => !q || t.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map(t => ({
        id: `t-${t.id}`,
        label: t.name,
        sublabel: 'Team',
        category: 'team' as const,
        query: `analyze team "${t.name}" — bugs filed, resolution rates, member breakdown`,
      }));

    const platformOpts = PLATFORM_OPTIONS.filter(p => !q || p.label.toLowerCase().includes(q));
    const priorityOpts = PRIORITY_OPTIONS.filter(p => !q || p.label.toLowerCase().includes(q));
    const statusOpts = STATUS_OPTIONS.filter(p => !q || p.label.toLowerCase().includes(q));

    const all = [...userOptions, ...teamOptions, ...platformOpts, ...priorityOpts, ...statusOpts].slice(0, 20);
    setMentionOptions(all);
    setMentionIdx(0);
  }, [mentionQuery, mentionOpen, allUsers, allTeams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart || 0;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');

    if (atIdx !== -1 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))) {
      const query = before.slice(atIdx + 1);
      if (!/\s/.test(query)) {
        setMentionOpen(true);
        setMentionQuery(query);
        setMentionStart(atIdx);
        return;
      }
    }
    setMentionOpen(false);
  };

  const selectMention = useCallback((opt: MentionOption) => {
    if (mentionStart === -1) return;
    const before = input.slice(0, mentionStart);
    const after = input.slice(mentionStart + 1 + mentionQuery.length);
    setInput(before + opt.query + after + ' ');
    setMentionOpen(false);
    setMentionQuery('');
    inputRef.current?.focus();
  }, [input, mentionStart, mentionQuery]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionOptions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (mentionOptions[mentionIdx]) selectMention(mentionOptions[mentionIdx]); return; }
      if (e.key === 'Escape') { setMentionOpen(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) { e.preventDefault(); send(); }
  };

  const send = async (q?: string) => {
    const text = (q || input).trim();
    if (!text || loading) return;
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(p => [...p, { role: 'user', content: text }]);
    setInput('');
    setMentionOpen(false);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/jira-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: 'assistant', content: data.answer || 'No response.', issueCount: data.issueCount }]);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('zenit:ai-call-completed'));
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: '⚠ Connection error.' }]);
    } finally { setLoading(false); }
  };

  // Group mention options by category
  const grouped = mentionOptions.reduce<Record<string, MentionOption[]>>((acc, opt) => {
    (acc[opt.category] = acc[opt.category] || []).push(opt);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    alias: '👤 People',
    team: '👥 Teams',
    platform: '📱 Platforms',
    priority: '🔴 Priority',
    status: '✅ Status',
  };

  return (
    <>
      {/* FAB */}
      {!open && (
        <button onClick={() => setOpen(true)} title="Jira Intelligence"
          className="fixed bottom-6 right-6 z-[88] w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:scale-110 hover:shadow-emerald-500/50 transition-all flex items-center justify-center">
          <BarChart2 className="w-5 h-5" />
        </button>
      )}

      {/* Terminal panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-[92] w-[500px] rounded-2xl overflow-hidden shadow-2xl shadow-black/60 flex flex-col"
          style={{ height: 'min(700px, calc(100vh - 2rem))', background: '#080e08' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-900/50"
            style={{ background: 'linear-gradient(135deg, #0a1a0a 0%, #081208 100%)' }}>
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              </div>
              <div className="h-3 w-px bg-emerald-900 mx-1" />
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-mono font-bold text-emerald-400">jira.intelligence</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={() => setMessages([])}
                  className="p-1.5 rounded text-emerald-800 hover:text-emerald-400 hover:bg-emerald-900/30 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded text-emerald-800 hover:text-white hover:bg-emerald-900/30 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="text-[11px] font-mono space-y-0.5">
                  <p className="text-emerald-500">{'>'} Jira Intelligence Terminal ready</p>
                  <p className="text-emerald-800">{'>'} Type <span className="text-amber-400">@</span> to select a person, team, platform or filter</p>
                  <p className="text-emerald-800">{'>'} Or pick a quick investigation below</p>
                  <p className="text-emerald-500 animate-pulse">{'>'} _</p>
                </div>
                <div className="h-px bg-emerald-900/40" />
                <p className="text-[9px] text-emerald-800 uppercase tracking-widest font-bold">Quick Investigations</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {INVESTIGATIONS.map(inv => (
                    <button key={inv.label} onClick={() => send(inv.q)}
                      className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-950/50 border border-emerald-900/40 hover:border-emerald-700/60 hover:bg-emerald-950 text-left transition-all group">
                      <span className="text-sm shrink-0 mt-0.5">{inv.icon}</span>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-emerald-600 group-hover:text-emerald-400 block">{inv.label}</span>
                        {inv.tip && <span className="text-[9px] text-emerald-800 block mt-0.5">{inv.tip}</span>}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/30">
                  <p className="text-[10px] text-emerald-700 font-mono">
                    <span className="text-amber-400 font-bold">Tip:</span> Type <span className="text-amber-400">@</span> then start typing a name, team or platform — press <span className="text-amber-400">↑↓</span> to navigate, <span className="text-amber-400">Enter</span> to select
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' ? (
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-500 text-[11px] font-mono shrink-0 mt-0.5">{'>'}</span>
                    <p className="text-[12px] text-emerald-300 font-mono leading-relaxed">{msg.content}</p>
                  </div>
                ) : (
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[9px] text-emerald-700 font-mono uppercase tracking-widest">output</span>
                      </div>
                      {msg.issueCount !== undefined && msg.issueCount > 0 && (
                        <span className="text-[9px] text-emerald-800 font-mono">{msg.issueCount.toLocaleString()} issues</span>
                      )}
                    </div>
                    <div className="bg-black/50 border border-emerald-900/50 rounded-xl p-3 overflow-x-auto">
                      {renderOutput(msg.content)}
                      {/* Verdict highlight badge — shown inside the output box */}
                      {/verdict:/i.test(msg.content) && (
                        <div className={cn('mt-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono font-bold inline-flex items-center gap-1.5',
                          /critical/i.test(msg.content) ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                          /high/i.test(msg.content) ? 'border-orange-500/40 bg-orange-500/10 text-orange-400' :
                          /medium/i.test(msg.content) ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' :
                          'border-emerald-500/40 bg-emerald-500/10 text-emerald-400')}>
                          {msg.content.match(/Verdict:.*/i)?.[0]}
                        </div>
                      )}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }}
                      className="flex items-center gap-1 text-[10px] text-emerald-900 hover:text-emerald-600 transition-colors font-mono">
                      {copiedIdx === i ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedIdx === i ? 'copied' : 'copy'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-mono py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                <span>Querying Jira + analyzing<span className="animate-pulse">...</span></span>
              </div>
            )}
          </div>

          {/* @ Mention Picker */}
          {mentionOpen && (
            <div ref={pickerRef}
              className="absolute bottom-[60px] left-3 right-3 z-50 rounded-2xl border border-emerald-700/40 bg-[#0d1a0d] shadow-2xl shadow-black/80 overflow-hidden max-h-[320px] flex flex-col">

              {/* Picker header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-900/40 bg-emerald-950/50">
                <AtSign className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] text-emerald-500 font-mono font-bold">Mention</span>
                {mentionQuery && (
                  <span className="px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400 text-[10px] font-mono">
                    "{mentionQuery}"
                  </span>
                )}
                {loadingUsers && <Loader2 className="w-3 h-3 animate-spin text-emerald-700 ml-auto" />}
                <span className="text-[9px] text-emerald-800 font-mono ml-auto">↑↓ navigate · Enter select · Esc close</span>
              </div>

              <div className="overflow-y-auto">
                {mentionOptions.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px] text-emerald-800 font-mono">
                    {loadingUsers ? 'Loading users...' : 'No matches found'}
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, opts]) => {
                    const flatIdx = mentionOptions.findIndex(o => o.id === opts[0].id);
                    return (
                      <div key={category}>
                        <div className="px-3 py-1.5 bg-emerald-950/30">
                          <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest font-mono">
                            {categoryLabels[category] || category}
                          </span>
                        </div>
                        {opts.map((opt, localIdx) => {
                          const globalIdx = mentionOptions.findIndex(o => o.id === opt.id);
                          const isActive = mentionIdx === globalIdx;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => selectMention(opt)}
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                isActive ? 'bg-emerald-900/40' : 'hover:bg-emerald-950/60'
                              )}
                            >
                              {/* Avatar or icon */}
                              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border', CATEGORY_BG[opt.category])}>
                                {opt.avatar
                                  ? <img src={opt.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                                  : <span className={CATEGORY_COLORS[opt.category]}>
                                      {opt.category === 'alias' ? opt.label[0] :
                                       opt.category === 'team' ? '👥' :
                                       opt.category === 'platform' ? '📱' :
                                       opt.category === 'priority' ? '🎯' : '✓'}
                                    </span>
                                }
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={cn('text-[12px] font-semibold font-mono truncate', CATEGORY_COLORS[opt.category])}>{opt.label}</p>
                                {opt.sublabel && (
                                  <p className="text-[10px] text-emerald-800 font-mono truncate">{opt.sublabel}</p>
                                )}
                              </div>
                              {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-emerald-900/40 bg-black/30 flex items-center gap-2">
            <span className="text-emerald-500 text-sm font-mono shrink-0 select-none">$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type @ to select a person / team / platform…"
              disabled={loading}
              className="flex-1 h-8 text-[12px] bg-transparent border-none text-emerald-200 placeholder:text-emerald-900 font-mono focus:outline-none"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="w-7 h-7 rounded-lg bg-emerald-700/30 hover:bg-emerald-700/60 border border-emerald-700/40 disabled:opacity-30 flex items-center justify-center transition-colors shrink-0">
              <Send className="w-3 h-3 text-emerald-400" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
