"use client";

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Camera, ArrowRight, Zap } from 'lucide-react';

export default function ZenitVisionPreview() {
    return (
        <Card className="glass-panel group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-purple-500/50 cursor-pointer">
            <Link href="/dashboard/vision" className="absolute inset-0 z-20" aria-label="Launch Zenit Vision" />

            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Camera className="h-16 w-16 text-purple-500 rotate-12" />
            </div>

            <CardHeader className="pb-2 relative z-10">
                <CardTitle className="flex items-center gap-3 text-base group-hover:text-purple-500 transition-colors">
                    <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                        <Camera className="text-purple-500 h-4 w-4" />
                    </div>
                    Zenit Vision Studio
                    <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse ml-auto" />
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Intelligent OTT Inspector & Script Recorder.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-mono text-purple-500/60 uppercase font-black">
                    <Zap className="w-3 h-3" /> Android / iOS
                </div>
                <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors group-hover:translate-x-1 duration-300">
                    Launch Studio <ArrowRight className="h-4 w-4" />
                </div>
            </CardContent>
        </Card>
    );
}
