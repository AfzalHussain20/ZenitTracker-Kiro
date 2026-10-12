'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import {
  Library, Users, BarChart3, ArrowRight, Play, Layers, StickyNote
} from 'lucide-react';
import { cn } from '@/lib/utils';

const apps = [
  { id: 'new-session', name: 'New Session', desc: 'Start a manual testing session', icon: Play, href: '/dashboard/new-session', color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20' },
  { id: 'repository', name: 'Test Repository', desc: 'Managed test case library', icon: Library, href: '/dashboard/repository', color: 'text-green-600 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20' },
  { id: 'jira-kpi', name: 'Jira KPI', desc: 'Advanced Jira analytics & team metrics', icon: BarChart3, href: '/analytics/bugs', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
  { id: 'notes', name: 'Daily Notes', desc: 'Quick capture notes with AI titles & tags', icon: StickyNote, href: '/notes', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20' },
  { id: 'team', name: 'Team Performance', desc: 'Track team metrics & member activity', icon: Users, href: '/team', color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20', leadOnly: true },
];

export default function AppsPage() {
  const { userRole } = useAuth();

  const visibleApps = apps.filter(a => !a.leadOnly || userRole === 'lead');

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Apps</h1>
            <p className="text-sm text-muted-foreground">{visibleApps.length} tools available</p>
          </div>
        </div>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleApps.map((app, i) => {
          const Icon = app.icon;
          return (
            <motion.div key={app.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}>
              <Link href={app.href}
                className="group flex items-start gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border', app.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{app.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{app.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
