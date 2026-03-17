"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Search, ArrowRight } from 'lucide-react';

export default function OmniSearchPreview() {
    const triggerOmni = () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true }));
    };

    return (
        <Card
            onClick={triggerOmni}
            className="glass-panel group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-pink-500/50 cursor-pointer"
        >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Search className="h-16 w-16 text-pink-500 rotate-12" />
            </div>

            <CardHeader className="pb-2 relative z-10">
                <CardTitle className="flex items-center gap-3 text-base group-hover:text-pink-500 transition-colors">
                    <div className="p-2 rounded-lg bg-pink-500/10 group-hover:bg-pink-500/20 transition-colors">
                        <Search className="text-pink-500 h-4 w-4" />
                    </div>
                    Omni Search
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Global palette for instant navigation.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 relative z-10">
                <div className="flex items-center justify-between text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors group-hover:translate-x-1 duration-300">
                    Launch Palette <ArrowRight className="h-4 w-4" />
                </div>
            </CardContent>
        </Card>
    );
}
