'use client';

import { useEffect, useState } from 'react';
import ZenitSplashAnimation from '@/components/zenit-splash-animation';

const KEY = 'zenit:welcome-shown';

/**
 * Post-login splash.
 *
 * Renders the exact cinematic `ZenitSplashAnimation` (the Z that draws itself,
 * the dot that flies and lands as the dot of the "i") as an overlay on the
 * first app load after signing in.
 *
 * Gated by sessionStorage so it plays once per browser session — navigating
 * between dashboard pages does not replay it. The animation dismisses itself
 * when its timeline finishes (or on click / after a 9s failsafe).
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
  }, []);

  if (!show) return null;

  return <ZenitSplashAnimation onComplete={() => setShow(false)} />;
}
