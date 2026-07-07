'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import {
  Clock, Shield, Library, Wand2, Users, Bug, FileText,
  BarChart3, ArrowRight, Zap, TestTube, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

const apps = [
  { id: 'sessions', name: 'Test Sessions', desc: 'Execute & track manual testing sessions', icon: TestTube, href: '/dashboard/sessions', color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20' },
  { id: 'team', name: 'Team Performance', desc: 'Track team metrics & member activity', icon: Users, href: '/team', color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20', leadOnly: true },
  { id: 'bug-tracker', name: 'Bug Tracker', desc: 'Jira-synced bug dashboard & analytics', icon: Bug, href: '/bugs', color: 'text-red-600 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' },
  { id: 'jira-kpi', name: 'Jira KPI', desc: 'Advanced Jira analytics & team metrics', icon: BarChart3, href: '/analytics/bugs', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
  { id: 'wrklog', name: 'Wrklog', desc: 'Track testing time & productivity', icon: Clock, href: '/wrklog', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20' },
  { id: 'keepr', name: 'Keepr', desc: 'Device check-in & check-out management', icon: Shield, href: '/keepr', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20' },
  { id: 'repository', name: 'Test Repository', desc: 'Managed test case library', icon: Library, href: '/dashboard/repository', color: 'text-green-600 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20' },
  { id: 'clevertap', name: 'CleverTap Tracker', desc: 'Analytics event validation', icon: Wand2, href: '/dashboard/clevertap-tracker', color: 'text-pink-600 bg-pink-50 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/20' },
  { id: 'performance', name: 'Performance Lab', desc: 'Device performance monitoring', icon: Zap, href: '/performance', color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
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
