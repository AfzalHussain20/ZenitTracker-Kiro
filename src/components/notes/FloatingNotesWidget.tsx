"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { StickyNote, X, Send, Loader2, Sparkles, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FloatingNotesWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<'note' | 'task'>('note');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  // Keyboard shortcut: Ctrl+Shift+N to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSave = useCallback(async () => {
    if (!content.trim() || !user || saving) return;
    setSaving(true);
    try {
      // Generate AI title + tags (skip for tasks — use content as title)
      let title = '';
      let tags: string[] = [];
      let category = mode === 'task' ? 'dailyTask' : 'general';

      if (mode === 'note' && content.length >= 30) {
        try {
          const aiRes = await fetch('/api/notes/generate-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          });
          const aiData = await aiRes.json();
          title = aiData.title || content.substring(0, 50);
          tags = aiData.tags || [];
          category = aiData.category || 'general';
        } catch {
          title = content.substring(0, 50).replace(/\n/g, ' ').trim();
        }
      } else {
        title = content.split('\n')[0].substring(0, 80).trim() || content.substring(0, 50);
      }

      // Save note
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          plainText: content.replace(/[#*`_~\[\]]/g, '').trim(),
          tags,
          category,
          userId: user.uid,
          userName: user.displayName || 'Unknown',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }

      setSaved(true);
      setTimeout(() => {
        setContent('');
        setSaved(false);
        setOpen(false);
        // Signal notes page to refresh
        window.dispatchEvent(new CustomEvent('note-created'));
      }, 1000);
    } catch (err) {
      console.error('Failed to save quick note:', err);
      setSaving(false);
    } finally {
      setSaving(false);
    }
  }, [content, user, saving, mode]);

  // Handle Ctrl+Enter to save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button with spin animation */}
      <motion.button
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'fixed bottom-6 right-6 z-[100] w-12 h-12 rounded-full shadow-lg',
          'flex items-center justify-center transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'border border-primary/20'
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        aria-label="Quick Note"
      >
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {open ? <X className="w-5 h-5" /> : <StickyNote className="w-5 h-5" />}
        </motion.div>
      </motion.button>

      {/* Quick Note Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="fixed bottom-20 right-6 z-[100] w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                >
                  {mode === 'task' ? <CheckSquare className="w-3.5 h-3.5 text-orange-500" /> : <StickyNote className="w-3.5 h-3.5 text-primary" />}
                </motion.div>
                <span className="text-sm font-semibold text-foreground">
                  {mode === 'task' ? 'Daily Task' : 'Quick Note'}
                </span>
              </div>
              {/* Mode toggle */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                <button
                  onClick={() => setMode('note')}
                  className={cn('px-2 py-1 rounded-md text-[10px] font-medium transition-colors',
                    mode === 'note' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Note
                </button>
                <button
                  onClick={() => setMode('task')}
                  className={cn('px-2 py-1 rounded-md text-[10px] font-medium transition-colors',
                    mode === 'task' ? 'bg-orange-100 dark:bg-orange-500/15 text-orange-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Task
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'task'
                  ? "What needs to be done today?"
                  : "What's on your mind? Markdown supported..."
                }
                className={cn(
                  "w-full h-32 resize-none text-sm border rounded-xl p-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1",
                  mode === 'task'
                    ? "bg-orange-50/30 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20 focus:border-orange-300 focus:ring-orange-200"
                    : "bg-muted/30 border-border focus:border-primary/40 focus:ring-primary/20"
                )}
              />
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {mode === 'note' ? (
                  <><Sparkles className="w-3 h-3" /> AI title on save</>
                ) : (
                  <><CheckSquare className="w-3 h-3" /> Saved as Daily Task</>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={!content.trim() || saving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  saved
                    ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : mode === 'task'
                      ? 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {saving ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                ) : saved ? (
                  '✓ Saved!'
                ) : (
                  <><Send className="w-3 h-3" /> Save</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
