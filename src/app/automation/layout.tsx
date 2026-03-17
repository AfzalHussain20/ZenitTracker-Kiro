import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { ZenitOmni } from '@/components/zenit-omni';

/**
 * The Automation Hub uses AppShell which manages its own full-screen layout
 * (sidebar + header). By moving this out of the (app) group, we truly
 * bypass the global AppHeader to prevent UI overlap.
 */
export default function AutomationLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <ZenitOmni />
            <div className="flex flex-col min-h-screen bg-background">
                {children}
            </div>
            <Toaster />
        </>
    );
}
