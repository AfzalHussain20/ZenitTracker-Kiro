"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { StickyNote, X, Send, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FloatingNotesWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
      // Generate AI title + tags
      const aiRes = await fetch('/api/notes/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const aiData = await aiRes.json();

      // Save note
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiData.title || content.substring(0, 50),
          content,
          plainText: content.replace(/[#*`_~\[\]]/g, '').trim(),
          tags: aiData.tags || [],
          category: aiData.category || 'general',
          userId: user.uid,
          userName: user.displayName || 'Unknown',
        }),
      });

      setSaved(true);
      setTimeout(() => {
        setContent('');
        setSaved(false);
        setOpen(false);
      }, 1200);
    } catch (err) {
      console.error('Failed to save quick note:', err);
    } finally {
      setSaving(false);
    }
  }, [content, user, saving]);

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
      {/* Floating Button */}
      <motion.button
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'fixed bottom-6 right-6 z-[100] w-12 h-12 rounded-full shadow-lg',
          'flex items-center justify-center transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'border border-primary/20'
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Quick Note"
      >
        {open ? <X className="w-5 h-5" /> : <StickyNote className="w-5 h-5" />}
      </motion.button>

      {/* Quick Note Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 right-6 z-[100] w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <StickyNote className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">Quick Note</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Ctrl+Enter to save</span>
              </div>
            </div>

            {/* Body */}
            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What's on your mind? Markdown supported..."
                className="w-full h-32 resize-none text-sm bg-muted/30 border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                AI will generate title & tags
              </div>
              <button
                onClick={handleSave}
                disabled={!content.trim() || saving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  saved
                    ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
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
