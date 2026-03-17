"use client";

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { GraduationCap, ArrowRight } from 'lucide-react';

export default function ZenitAcademyPreview() {
    return (
        <Card className="glass-panel group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-purple-500/50 cursor-pointer">
            <Link href="/nexus" className="absolute inset-0 z-20" aria-label="Enter Zenit Academy" />

            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <GraduationCap className="h-16 w-16 text-purple-500 rotate-12" />
            </div>

            <CardHeader className="pb-2 relative z-10">
                <CardTitle className="flex items-center gap-3 text-base group-hover:text-purple-500 transition-colors">
                    <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                        <GraduationCap className="text-purple-500 h-4 w-4" />
                    </div>
                    Zenit Academy
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Step-by-step automation lectures & labs.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 relative z-10">
                <div className="flex items-center justify-between text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors group-hover:translate-x-1 duration-300">
                    Enter Academy <ArrowRight className="h-4 w-4" />
                </div>
            </CardContent>
        </Card>
    );
}
