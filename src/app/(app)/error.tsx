'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, LayoutDashboard, Home } from 'lucide-react';

/**
 * In-shell error boundary for the authenticated app.
 *
 * Renders inside AppShell (sidebar + topbar stay visible) so a crash in one
 * page does not take over the whole window. Errors thrown in the shell itself
 * bubble to the root `src/app/error.tsx` instead.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Zenit app error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-10">
      <Card className="w-full max-w-lg border-destructive/30">
        <CardContent className="space-y-6 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 ring-4 ring-destructive/15">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              This page hit an unexpected error. You can retry, or head back to a safe place.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground/70">
                Reference: <span className="font-mono">{error.digest}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => reset()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
