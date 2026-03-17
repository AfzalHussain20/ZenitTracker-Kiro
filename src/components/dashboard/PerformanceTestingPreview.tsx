"use client";

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Gauge, ArrowRight } from 'lucide-react';

export default function PerformanceTestingPreview() {
    return (
        <Card className="glass-panel group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50 cursor-pointer">
            <Link href="/performance" className="absolute inset-0 z-20" aria-label="Launch Performance Testing" />

            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Gauge className="h-16 w-16 text-blue-500 rotate-12" />
            </div>

            <CardHeader className="pb-2 relative z-10">
                <CardTitle className="flex items-center gap-3 text-base group-hover:text-primary transition-colors">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 group-hover:from-blue-500/20 group-hover:to-purple-500/20 transition-colors">
                        <Gauge className="text-blue-500 h-4 w-4" />
                    </div>
                    Performance Testing
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Multi-platform performance analysis & device testing.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 relative z-10">
                <div className="flex items-center justify-between text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors group-hover:translate-x-1 duration-300">
                    Launch Tool <ArrowRight className="h-4 w-4" />
                </div>
            </CardContent>
        </Card>
    );
}
