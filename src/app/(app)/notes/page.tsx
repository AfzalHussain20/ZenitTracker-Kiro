"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Search, StickyNote, Pin, Trash2, Loader2,
  Calendar, Tag, Sparkles, Clock, ChevronDown,
  Bold, Italic, Code, Table, CheckSquare, Heading1, Heading2,
  List, Quote, Minus, X, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Note, NoteCategory } from '@/types';

const CATEGORIES: { value: NoteCategory | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'bg-muted' },
  { value: 'meeting', label: 'Meeting', color: 'bg-blue-100 dark:bg-blue-500/15' },
  { value: 'todo', label: 'To-Do', color: 'bg-amber-100 dark:bg-amber-500/15' },
  { value: 'idea', label: 'Idea', color: 'bg-purple-100 dark:bg-purple-500/15' },
  { value: 'reference', label: 'Reference', color: 'bg-emerald-100 dark:bg-emerald-500/15' },
  { value: 'bug', label: 'Bug', color: 'bg-red-100 dark:bg-red-500/15' },
  { value: 'general', label: 'General', color: 'bg-muted' },
];

export default function NotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | 'all'>('all');
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [savingAI, setSavingAI] = useState(false);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: user.uid });
      if (searchQuery) params.set('search', searchQuery);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);

      const res = await fetch(`/api/notes?${params}`);
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery, selectedCategory]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Create new note
  const handleCreate = () => {
    setEditingNote({
      id: null,
      title: '',
      content: '',
      tags: [],
      category: 'general',
      pinned: false,
    });
    setIsCreating(true);
  };

  // Auto-save with debounce
  const autoSave = useCallback(async (note: any) => {
    if (!user || !note.content?.trim()) return;

    try {
      if (note.id) {
        // Update existing
        await fetch(`/api/notes/${note.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: note.content,
            plainText: note.content.replace(/[#*`_~\[\]]/g, '').trim(),
            title: note.title,
            tags: note.tags,
            category: note.category,
          }),
        });
      } else {
        // Create new
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: note.title || '',
            content: note.content,
            plainText: note.content.replace(/[#*`_~\[\]]/g, '').trim(),
            tags: note.tags || [],
            category: note.category || 'general',
            userId: user.uid,
            userName: user.displayName || 'Unknown',
          }),
        });
        const data = await res.json();
        if (data.id) {
          setEditingNote((prev: any) => prev ? { ...prev, id: data.id } : null);
          setIsCreating(false);
        }
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [user]);

  // Debounced save (2s)
  const debouncedSave = useCallback((note: any) => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => autoSave(note), 2000);
  }, [autoSave]);

  // Handle content change
  const handleContentChange = (value: string) => {
    const updated = { ...editingNote, content: value };
    setEditingNote(updated);
    debouncedSave(updated);
  };

  // AI title generation
  const generateAITitle = async () => {
    if (!editingNote?.content || editingNote.content.length < 30) return;
    setSavingAI(true);
    try {
      const res = await fetch('/api/notes/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingNote.content }),
      });
      const data = await res.json();
      const updated = {
        ...editingNote,
        title: data.title || editingNote.title,
        tags: data.tags?.length ? data.tags : editingNote.tags,
        category: data.category || editingNote.category,
      };
      setEditingNote(updated);
      autoSave(updated);
      toast({ title: 'AI generated title & tags' });
    } catch (err) {
      toast({ title: 'AI generation failed', variant: 'destructive' });
    } finally {
      setSavingAI(false);
    }
  };

  // Delete note
  const handleDelete = async (noteId: string) => {
    try {
      await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (editingNote?.id === noteId) setEditingNote(null);
      toast({ title: 'Note archived' });
    } catch (err) {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  // Toggle pin
  const togglePin = async (note: any) => {
    try {
      await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n));
    } catch (err) {
      toast({ title: 'Failed to pin', variant: 'destructive' });
    }
  };

  // Insert markdown formatting
  const insertMarkdown = (prefix: string, suffix?: string) => {
    if (!editorRef.current) return;
    const ta = editorRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);
    const replacement = `${prefix}${selected}${suffix || prefix}`;
    const newContent = ta.value.substring(0, start) + replacement + ta.value.substring(end);
    handleContentChange(newContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  // Insert table
  const insertTable = () => {
    const table = '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Data     | Data     | Data     |\n';
    handleContentChange((editingNote?.content || '') + table);
  };

  // Insert code block
  const insertCodeBlock = () => {
    const code = '\n```javascript\n// your code here\n```\n';
    handleContentChange((editingNote?.content || '') + code);
  };

  // Insert checkbox
  const insertCheckbox = () => {
    const checkbox = '\n- [ ] ';
    handleContentChange((editingNote?.content || '') + checkbox);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        editorRef.current.setSelectionRange(editorRef.current.value.length, editorRef.current.value.length);
      }
    }, 0);
  };

  // Slash command handler
  const handleSlashCommand = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && editingNote?.content) {
      const lines = editingNote.content.split('\n');
      const lastLine = lines[lines.length - 1]?.trim();
      if (lastLine === '/table') {
        e.preventDefault();
        const content = lines.slice(0, -1).join('\n') + '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Data     | Data     | Data     |\n';
        handleContentChange(content);
      } else if (lastLine === '/code') {
        e.preventDefault();
        const content = lines.slice(0, -1).join('\n') + '\n```javascript\n\n```\n';
        handleContentChange(content);
      } else if (lastLine === '/todo') {
        e.preventDefault();
        const content = lines.slice(0, -1).join('\n') + '\n- [ ] ';
        handleContentChange(content);
      } else if (lastLine === '/date') {
        e.preventDefault();
        const content = lines.slice(0, -1).join('\n') + `\n📅 ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n`;
        handleContentChange(content);
      } else if (lastLine === '/divider') {
        e.preventDefault();
        const content = lines.slice(0, -1).join('\n') + '\n---\n';
        handleContentChange(content);
      }
    }
  };

  // Group notes by date
  const groupedNotes = notes.reduce((groups: Record<string, any[]>, note) => {
    const date = new Date(note.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(note);
    return groups;
  }, {});

  // Sort pinned first within each group
  Object.keys(groupedNotes).forEach(date => {
    groupedNotes[date].sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <StickyNote className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Daily Notes</h1>
            <p className="text-sm text-muted-foreground">Your searchable knowledge base</p>
          </div>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Note
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notes by keyword, tag, or content..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                selectedCategory === cat.value
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notes List */}
        <div className={cn('space-y-4', editingNote ? 'lg:col-span-1' : 'lg:col-span-3')}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
                <StickyNote className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground">No notes yet. Create your first note!</p>
              <Button variant="outline" onClick={handleCreate} className="gap-2">
                <Plus className="w-4 h-4" /> Create Note
              </Button>
            </div>
          ) : (
            Object.entries(groupedNotes).map(([date, dateNotes]) => (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{date}</span>
                </div>
                <div className="space-y-2">
                  {dateNotes.map((note: any) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'group relative p-4 rounded-xl border cursor-pointer transition-all',
                        editingNote?.id === note.id
                          ? 'border-primary/30 bg-primary/5 shadow-sm'
                          : 'border-border bg-card hover:border-primary/20 hover:shadow-sm'
                      )}
                      onClick={() => { setEditingNote(note); setIsCreating(false); }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {note.pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                            <h3 className="text-sm font-semibold text-foreground truncate">
                              {note.title || 'Untitled Note'}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {note.plainText?.substring(0, 120) || note.content?.substring(0, 120)}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {note.tags?.slice(0, 3).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                                #{tag}
                              </Badge>
                            ))}
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(note.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); togglePin(note); }}
                            className="p-1 rounded hover:bg-muted">
                            <Pin className={cn('w-3.5 h-3.5', note.pinned ? 'text-primary' : 'text-muted-foreground')} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10">
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Editor Panel */}
        <AnimatePresence>
          {editingNote && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-2 sticky top-24"
            >
              <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
                {/* Editor Header */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      value={editingNote.title || ''}
                      onChange={e => {
                        const updated = { ...editingNote, title: e.target.value };
                        setEditingNote(updated);
                        debouncedSave(updated);
                      }}
                      placeholder="Note title (AI will generate if empty)"
                      className="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={generateAITitle}
                      disabled={savingAI || !editingNote.content || editingNote.content.length < 30}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
                    >
                      {savingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      AI Title
                    </button>
                    <select
                      value={editingNote.category || 'general'}
                      onChange={e => {
                        const updated = { ...editingNote, category: e.target.value };
                        setEditingNote(updated);
                        debouncedSave(updated);
                      }}
                      className="text-[11px] bg-muted/50 border border-border rounded-lg px-2 py-1 text-foreground"
                    >
                      {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => { setEditingNote(null); fetchNotes(); }}
                      className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="px-4 py-2 border-b border-border flex items-center gap-1 flex-wrap">
                  <button onClick={() => insertMarkdown('**')} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Bold">
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertMarkdown('*')} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Italic">
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertMarkdown('# ', '\n')} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Heading 1">
                    <Heading1 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertMarkdown('## ', '\n')} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Heading 2">
                    <Heading2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button onClick={insertCodeBlock} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Code Block">
                    <Code className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={insertTable} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Table">
                    <Table className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={insertCheckbox} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Checkbox">
                    <CheckSquare className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertMarkdown('- ', '\n')} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="List">
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertMarkdown('> ', '\n')} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Quote">
                    <Quote className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleContentChange((editingNote.content || '') + '\n---\n')} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Divider">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="ml-auto text-[10px] text-muted-foreground">
                    Type / for commands
                  </div>
                </div>

                {/* Editor */}
                <textarea
                  ref={editorRef}
                  value={editingNote.content || ''}
                  onChange={e => handleContentChange(e.target.value)}
                  onKeyDown={handleSlashCommand}
                  placeholder="Start writing... Use markdown for rich formatting.&#10;&#10;Slash commands:&#10;/table — Insert table&#10;/code — Insert code block&#10;/todo — Insert checkbox&#10;/date — Insert current date/time&#10;/divider — Horizontal rule"
                  className="w-full min-h-[400px] p-4 text-sm font-mono bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground/40 leading-relaxed"
                  spellCheck
                />

                {/* Tags */}
                <div className="px-4 py-3 border-t border-border flex items-center gap-2 flex-wrap">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  {editingNote.tags?.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                      #{tag}
                      <button onClick={() => {
                        const newTags = editingNote.tags.filter((_: string, idx: number) => idx !== i);
                        const updated = { ...editingNote, tags: newTags };
                        setEditingNote(updated);
                        debouncedSave(updated);
                      }}>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    placeholder="Add tag..."
                    className="text-[11px] bg-transparent border-none outline-none text-muted-foreground w-20"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        const newTag = (e.target as HTMLInputElement).value.trim().toLowerCase();
                        if (!editingNote.tags?.includes(newTag)) {
                          const updated = { ...editingNote, tags: [...(editingNote.tags || []), newTag] };
                          setEditingNote(updated);
                          debouncedSave(updated);
                        }
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Auto-saving
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
