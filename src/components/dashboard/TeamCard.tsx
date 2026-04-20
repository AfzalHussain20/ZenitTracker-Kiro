"use client";

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamCardProps {
  name: string;
  memberCount: number;
  totalBugs: number;
  openBugs: number;
  closedBugs: number;
  criticalBugs: number;
  closeRate: number;
  storyPoints: number;
  liveBuilds: number;
  thisMonth: number;
  monthlyTrend: number[];
  topContributor?: string;
  onClick?: () => void;
}

const AVATAR_COLORS = [
  'bg-cyan-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
];

function getTeamColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function TeamCard({
  name,
  memberCount,
  totalBugs,
  openBugs,
  closedBugs,
  criticalBugs,
  closeRate,
  storyPoints,
  liveBuilds,
  thisMonth,
  monthlyTrend,
  topContributor,
  onClick,
}: TeamCardProps) {
  const avatarColor = getTeamColor(name);
  const initial = name.charAt(0).toUpperCase();
  const maxTrend = Math.max(...monthlyTrend, 1);
  const trendDelta = monthlyTrend.length >= 2 ? monthlyTrend[monthlyTrend.length - 1] - monthlyTrend[monthlyTrend.length - 2] : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-card border-2 border-border shadow-lg transition-all duration-300',
        onClick && 'cursor-pointer hover:shadow-2xl hover:border-primary/40'
      )}
    >
      {/* Header - Dark gradient like screenshot */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(ellipse at 80% 0%, #6366f1 0%, transparent 60%)'
        }}/>
        <div className="relative z-10 flex items-center gap-3">
          <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-xl', avatarColor)}>
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{name}</h3>
            <p className="text-sm text-white/60">{memberCount} members · {totalBugs} bugs total</p>
          </div>
          {onClick && <ChevronRight className="w-5 h-5 text-white/40 shrink-0" />}
        </div>
      </div>

      {/* Metrics Grid - Clean white background like screenshot */}
      <div className="p-4 bg-background">
        {/* Primary metrics row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900/20">
            <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{totalBugs}</div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Bugs</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-900/10">
            <div className="text-2xl font-black text-red-600">{openBugs}</div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Open</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-900/10">
            <div className="text-2xl font-black text-green-600">{closedBugs}</div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Closed</div>
          </div>
          <div className={cn(
            'text-center p-3 rounded-xl',
            criticalBugs > 0 ? 'bg-red-100 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-900/20'
          )}>
            <div className={cn('text-2xl font-black', criticalBugs > 0 ? 'text-red-700' : 'text-slate-400')}>{criticalBugs}</div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Critical</div>
          </div>
        </div>

        {/* Secondary metrics row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/10">
            <div className="text-lg font-black text-purple-600">{storyPoints}</div>
            <div className="text-[9px] text-muted-foreground font-medium">Story Pts</div>
          </div>
          <div className={cn(
            'text-center p-2.5 rounded-xl',
            liveBuilds > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-slate-50 dark:bg-slate-900/20'
          )}>
            <div className={cn('text-lg font-black', liveBuilds > 0 ? 'text-emerald-600' : 'text-slate-400')}>{liveBuilds}</div>
            <div className="text-[9px] text-muted-foreground font-medium">Live Builds</div>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10">
            <div className="text-lg font-black text-amber-600">{thisMonth}</div>
            <div className="text-[9px] text-muted-foreground font-medium">This Month</div>
          </div>
        </div>

        {/* 6-Month Bug Trend */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground font-semibold">6-Month Bug Trend</span>
            {trendDelta !== 0 && (
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                trendDelta < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/20' : 'bg-red-100 text-red-700 dark:bg-red-900/20'
              )}>
                {trendDelta < 0 ? '▼' : '▲'} {Math.abs(trendDelta)} vs prev
              </span>
            )}
          </div>
          <div className="flex items-end gap-1 h-12 bg-slate-50 dark:bg-slate-900/20 rounded-lg p-2">
            {monthlyTrend.map((value, i) => {
              const height = Math.max((value / maxTrend) * 100, 4);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div 
                    className="w-full rounded-t-sm bg-purple-400 dark:bg-purple-500 transition-all hover:bg-purple-500"
                    style={{ height: `${height}%` }}
                    title={`${value} bugs`}
                  />
                  <span className="text-[8px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Close Rate Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground font-semibold">Close Rate</span>
            <span className={cn(
              'text-xs font-black',
              closeRate >= 70 ? 'text-green-600' : closeRate >= 40 ? 'text-amber-600' : 'text-red-600'
            )}>
              {closeRate}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-900/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${closeRate}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                closeRate >= 70 ? 'bg-green-500' : closeRate >= 40 ? 'bg-amber-500' : 'bg-red-500'
              )}
            />
          </div>
        </div>

        {/* Top Contributor */}
        {topContributor && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground">Top Contributor</span>
            <span className="text-[10px] font-semibold text-foreground truncate max-w-[120px]">
              🏆 {topContributor}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
