"use client";

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import { Toaster } from '@/components/ui/toaster';
import TopLoader from '@/components/ui/top-loader';

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullScreenApp = ['/dashboard/vision', '/automation', '/dashboard/session', '/dashboard/new-session'].some(r => pathname?.startsWith(r));

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {!isFullScreenApp && <AppHeader />}
      <main className={`flex-1 ${!isFullScreenApp ? 'container mx-auto py-8 px-4 sm:px-6 lg:px-8' : 'w-full h-full'}`}>
        {children}
      </main>
      <Toaster />
    </div>
  );
}
