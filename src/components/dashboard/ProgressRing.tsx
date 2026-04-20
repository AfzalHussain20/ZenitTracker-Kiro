"use client";

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple';
  label?: string;
  showPercentage?: boolean;
}

const colorStyles = {
  blue: {
    stroke: '#3b82f6',
    bg: 'text-blue-600',
  },
  green: {
    stroke: '#22c55e',
    bg: 'text-green-600',
  },
  red: {
    stroke: '#ef4444',
    bg: 'text-red-600',
  },
  amber: {
    stroke: '#f59e0b',
    bg: 'text-amber-600',
  },
  purple: {
    stroke: '#8b5cf6',
    bg: 'text-purple-600',
  },
};

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = 'blue',
  label,
  showPercentage = true,
}: ProgressRingProps) {
  const styles = colorStyles[color];
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.2}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={styles.stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className={cn('text-2xl font-black', styles.bg)}
          >
            {Math.round(progress)}%
          </motion.div>
        )}
        {label && (
          <div className="text-xs text-muted-foreground font-medium mt-1 text-center px-2">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
