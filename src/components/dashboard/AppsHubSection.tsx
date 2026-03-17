'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Clock, Shield, ArrowRight, Library, Crosshair, ChevronRight, GraduationCap, Search, Bot, Video
} from 'lucide-react';

import { useRouter } from 'next/navigation';

interface AppsHubSectionProps {
    className?: string;
}

const apps = [
    {
        id: 'automation',
        name: 'Automation',
        description: 'Auto-pilot scripts',
        icon: Bot,
        color: '#3B82F6',
        href: '/automation',
    },
    {
        id: 'academy',
        name: 'Zenit Academy',
        description: 'Expert Training',
        icon: GraduationCap,
        color: '#8B5CF6',
        href: '/nexus',
        isNew: true,
    },
    {
        id: 'omni',
        name: 'Omni Search',
        description: 'Global Palette',
        icon: Search,
        color: '#EC4899',
        action: 'omni',
    },
    {
        id: 'vision',
        name: 'Vision Studio',
        description: 'Layout Inspector',
        icon: Video,
        color: '#9333EA',
        href: '/dashboard/vision',
    },
    {
        id: 'repository',
        name: 'Repository',
        description: 'Test library',
        icon: Library,
        color: '#10B981',
        href: '/dashboard/repository',
    },
    {
        id: 'locator',
        name: 'Locator Lab',
        description: 'Element finder',
        icon: Crosshair,
        color: '#F59E0B',
        href: '/dashboard/locator-lab',
    },
    {
        id: 'keepr',
        name: 'Keepr',
        description: 'Inventory',
        icon: Shield,
        color: '#0EA5E9',
        href: '/keepr',
    },
    {
        id: 'wrklog',
        name: 'Wrklog',
        description: 'Time track',
        icon: Clock,
        color: '#6366F1',
        href: '/wrklog',
    },
];

export function AppsHubSection({ className }: AppsHubSectionProps) {
    const router = useRouter();

    return (
        <section className={className}>
            {/* Section Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Zenit Apps</h2>
                <Link href="/apps">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1 h-8 text-xs">
                        View All <ChevronRight className="w-3 h-3" />
                    </Button>
                </Link>
            </div>

            {/* Apps Grid - Compact */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {apps.map((app, index) => {
                    const AppIcon = app.icon;

                    return (
                        <motion.div
                            key={app.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card
                                onClick={() => {
                                    if (app.action === 'omni') {
                                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true }));
                                    } else if (app.href) {
                                        router.push(app.href);
                                    }
                                }}
                                className="border-border/50 bg-card/40 backdrop-blur-sm hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-500 cursor-pointer group h-full relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-primary/5 to-transparent -mr-8 -mt-8 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
                                <CardContent className="p-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="p-2 rounded-lg transition-transform group-hover:scale-110"
                                            style={{ backgroundColor: `${app.color}15` }}
                                        >
                                            <AppIcon className="w-5 h-5" style={{ color: app.color }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                                                    {app.name}
                                                </h3>
                                                {app.isNew && (
                                                    <Badge className="bg-primary/10 text-primary border-0 text-[8px] px-1 py-0">NEW</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {app.description}
                                            </p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>
        </section>
    );
}
