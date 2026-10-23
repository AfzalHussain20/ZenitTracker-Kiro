'use client';

import { useEffect, useState } from 'react';
import ZenitSplashAnimation from '@/components/zenit-splash-animation';

const KEY = 'zenit:play-splash';

/**
 * Post-login splash.
 *
 * Renders the exact cinematic `ZenitSplashAnimation` (the Z that draws itself,
 * the dot that flies and lands as the dot of the "i") right after the user
 * signs in.
 *
 * The login and signup flows set a one-shot `zenit:play-splash` flag in
 * sessionStorage before navigating to the dashboard. We consume (clear) it on
 * mount so the splash plays exactly once per sign-in and doesn't replay on
 * normal in-app navigation or refreshes.
 */
export default function PostLoginSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let play = false;
    try {
      play = sessionStorage.getItem(KEY) === '1';
      if (play) sessionStorage.removeItem(KEY);
    } catch {
      play = false;
    }
    if (play) setShow(true);
  }, []);

  if (!show) return null;

  return <ZenitSplashAnimation onComplete={() => setShow(false)} />;
}
