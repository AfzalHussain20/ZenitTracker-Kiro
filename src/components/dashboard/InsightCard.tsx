"use client";

import { motion } from 'framer-motion';
import { LucideIcon, Sparkles, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  title: string;
  description: string;
  type: 'success' | 'warning' | 'info' | 'danger';
  metric?: {
    label: string;
    value: string | number;
  };
  action?: {
    label: string;
    onClick: () => void;
  };
}

const typeStyles = {
  success: {
    gradient: 'from-green-500/20 via-emerald-500/10 to-transparent',
    border: 'border-green-500/30',
    icon: CheckCircle,
    iconColor: 'text-green-600',
    bg: 'bg-green-500/10',
  },
  warning: {
    gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    border: 'border-amber-500/30',
    icon: AlertCircle,
    iconColor: 'text-amber-600',
    bg: 'bg-amber-500/10',
  },
  info: {
    gradient: 'from-blue-500/20 via-cyan-500/10 to-transparent',
    border: 'border-blue-500/30',
    icon: Sparkles,
    iconColor: 'text-blue-600',
    bg: 'bg-blue-500/10',
  },
  danger: {
    gradient: 'from-red-500/20 via-rose-500/10 to-transparent',
    border: 'border-red-500/30',
    icon: AlertCircle,
    iconColor: 'text-red-600',
    bg: 'bg-red-500/10',
  },
};

export function InsightCard({ title, description, type, metric, action }: InsightCardProps) {
  const styles = typeStyles[type];
  const Icon = styles.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'relative overflow-hidden rounded-xl border-2 bg-card p-5 shadow-md',
        styles.border
      )}
    >
      {/* Gradient background */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', styles.gradient)} />
      
      {/* Animated pulse */}
      <div className={cn('absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20', styles.bg)} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn('p-2 rounded-lg shrink-0', styles.bg)}>
            <Icon className={cn('w-5 h-5', styles.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Metric */}
        {metric && (
          <div className={cn('rounded-lg p-3 mb-3', styles.bg)}>
            <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
            <div className={cn('text-2xl font-black', styles.iconColor)}>{metric.value}</div>
          </div>
        )}

        {/* Action */}
        {action && (
          <button
            onClick={action.onClick}
            className={cn(
              'w-full text-xs font-medium py-2 px-3 rounded-lg transition-all hover:scale-105 active:scale-95',
              styles.bg,
              styles.iconColor
            )}
          >
            {action.label} →
          </button>
        )}
      </div>
    </motion.div>
  );
}
