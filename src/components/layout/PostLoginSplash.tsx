'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogoIcon } from '@/components/ui/Logo';

const KEY = 'zenit:welcome-shown';

/**
 * Brief post-login welcome overlay.
 *
 * Plays once per browser session (guarded by sessionStorage) so the first
 * dashboard load feels intentional instead of a hard cut from the login form.
 * Purely presentational — it never blocks interaction longer than ~1.4s and is
 * skipped entirely for non-fresh visits.
 */
export default function PostLoginSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let fresh = false;
    try {
      fresh = sessionStorage.getItem(KEY) !== '1';
    } catch {
      fresh = false;
    }
    if (!fresh) return;

    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="relative flex h-20 w-20 items-center justify-center">
              <motion.span
                className="absolute inset-0 rounded-2xl bg-primary/20 blur-2xl"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-xl">
                <LogoIcon className="h-11 w-11" />
              </div>
            </div>

            <div className="text-center">
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="font-headline text-2xl font-bold tracking-tight"
              >
                Zenit Tracker
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-1 text-sm text-muted-foreground"
              >
                Preparing your command center…
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-muted"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.1, ease: 'easeInOut' }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
