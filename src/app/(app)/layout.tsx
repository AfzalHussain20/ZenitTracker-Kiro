"use client";

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/toaster';
import FloatingNotesWidget from '@/components/notes/FloatingNotesWidget';
import GlobalAIChat from '@/components/GlobalAIChat';
import AgentChat from '@/components/ai/AgentChat';

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullScreenApp = ['/dashboard/vision', '/automation', '/dashboard/session', '/dashboard/new-session'].some(r => pathname?.startsWith(r));

  if (isFullScreenApp) {
    return (
      <div className="w-full h-screen">
        {children}
        <Toaster />
        <FloatingNotesWidget />
        <GlobalAIChat />
        <AgentChat />
      </div>
    );
  }

  return (
    <>
      <AppShell>{children}</AppShell>
      <Toaster />
      <FloatingNotesWidget />
      <GlobalAIChat />
      <AgentChat />
    </>
  );
}
