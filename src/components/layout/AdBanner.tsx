"use client";

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function AdBanner({ 
  adClient = 'ca-pub-XXXXXXXXXXXXXXXX', // REPLACE this with your real Google AdSense Publisher ID
  adSlot = 'XXXXXXXXXX'                 // REPLACE this with your real Google AdSense Slot ID
}) {

  const adRef = useRef<HTMLModElement>(null);

  // This hook instructs the live Google JS to push an ad into the `<ins>` block below.
  useEffect(() => {
    try {
      if (adRef.current && !adRef.current.hasAttribute("data-ad-status")) {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.error('AdSense Error: ', err);
    }
  }, []);

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-1 relative flex justify-center">
      {/* 
        This is the real DOM element Google AdSense targets. 
        It MUST be an `<ins>` tag.
        The layout is forced cleanly so it doesn't break your UI.
      */}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', maxWidth: '728px', height: '90px' }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <div className="absolute right-2 top-2">
        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest bg-white/50 dark:bg-black/50 px-2 py-1 rounded">Advertisement</span>
      </div>
    </div>
  );
}
