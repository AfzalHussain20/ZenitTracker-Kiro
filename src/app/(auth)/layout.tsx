import type { ReactNode } from 'react';
import { LogoIcon } from '@/components/ui/Logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex flex-col items-center gap-2">
            <LogoIcon className="h-12 w-12" />
            <div className="text-center">
              <h2 className="text-2xl font-bold">Zenit Tracker</h2>
              <p className="text-sm text-muted-foreground">Precision in Every Test</p>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
