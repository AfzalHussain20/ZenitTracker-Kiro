"use client";

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface EnhancedMetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  sparklineData?: number[];
  progress?: number;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'cyan';
  onClick?: () => void;
  subtitle?: string;
}

const colorStyles = {
  blue: {
    gradient: 'from-blue-500/20 via-blue-600/10 to-transparent',
    text: 'text-blue-600',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
    ring: 'ring-blue-500/30',
  },
  green: {
    gradient: 'from-green-500/20 via-green-600/10 to-transparent',
    text: 'text-green-600',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    glow: 'shadow-green-500/20',
    ring: 'ring-green-500/30',
  },
  red: {
    gradient: 'from-red-500/20 via-red-600/10 to-transparent',
    text: 'text-red-600',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    glow: 'shadow-red-500/20',
    ring: 'ring-red-500/30',
  },
  amber: {
    gradient: 'from-amber-500/20 via-amber-600/10 to-transparent',
    text: 'text-amber-600',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/20',
    ring: 'ring-amber-500/30',
  },
  purple: {
    gradient: 'from-purple-500/20 via-purple-600/10 to-transparent',
    text: 'text-purple-600',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    glow: 'shadow-purple-500/20',
    ring: 'ring-purple-500/30',
  },
  cyan: {
    gradient: 'from-cyan-500/20 via-cyan-600/10 to-transparent',
    text: 'text-cyan-600',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    glow: 'shadow-cyan-500/20',
    ring: 'ring-cyan-500/30',
  },
};

export function EnhancedMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  sparklineData,
  progress,
  color = 'blue',
  onClick,
  subtitle,
}: EnhancedMetricCardProps) {
  const styles = colorStyles[color];
  const isClickable = !!onClick;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isClickable ? { scale: 1.02, y: -4 } : {}}
      whileTap={isClickable ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 bg-card p-6 transition-all duration-300',
        styles.border,
        isClickable && `cursor-pointer hover:shadow-xl ${styles.glow} hover:ring-2 ${styles.ring}`,
        !isClickable && 'shadow-md'
      )}
    >
      {/* Gradient background */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', styles.gradient)} />
      
      {/* Animated mesh pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground/60">{subtitle}</p>}
          </div>
          <div className={cn('p-3 rounded-xl', styles.bg)}>
            <Icon className={cn('w-5 h-5', styles.text)} />
          </div>
        </div>

        {/* Value */}
        <div className="mb-4">
          <div className={cn('text-4xl font-black tracking-tight', styles.text)}>
            {value}
          </div>
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className="flex items-center gap-2 mb-3">
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold',
              trend.isPositive !== false
                ? 'bg-green-500/15 text-green-700'
                : 'bg-red-500/15 text-red-700'
            )}>
              {trend.isPositive !== false ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(trend.value)}%
            </div>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Completion</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={cn('h-full rounded-full', styles.bg.replace('/10', '/60'))}
              />
            </div>
          </div>
        )}

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="h-12 flex items-end gap-0.5">
            {sparklineData.map((value, i) => {
              const max = Math.max(...sparklineData);
              const height = (value / max) * 100;
              return (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className={cn('flex-1 rounded-t-sm', styles.bg.replace('/10', '/40'))}
                />
              );
            })}
          </div>
        )}

        {/* Click indicator */}
        {isClickable && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Click to view details</span>
            <span className="text-xs font-medium text-primary">→</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
