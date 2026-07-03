'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check, Clock } from 'lucide-react';

interface TestGenProgressProps {
  currentPass: number;    // 1, 2, or 3
  passName: string;       // "Functional & Sanity", "Negative & Edge Case", "Exploratory & More"
  totalGenerated: number; // running count
  isComplete: boolean;
  countdown?: number;     // seconds remaining before next batch (0 = not waiting)
}

const PASSES = [
  { number: 1, label: 'Functional & Sanity' },
  { number: 2, label: 'Negative & Edge' },
  { number: 3, label: 'Exploratory & More' },
];

export default function TestGenProgress({
  currentPass,
  passName,
  totalGenerated,
  isComplete,
  countdown = 0,
}: TestGenProgressProps) {
  const progress = isComplete ? 100 : ((currentPass - 1) / 3) * 100 + (1 / 3) * (countdown > 0 ? 80 : 50);

  return (
    <div className="w-full rounded-lg border border-border/50 bg-card/80 px-4 py-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Status */}
        <div className="flex items-center gap-2 min-w-0">
          {isComplete ? (
            <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
          ) : countdown > 0 ? (
            <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-foreground truncate">
            {isComplete
              ? `Done — ${totalGenerated} test cases generated`
              : countdown > 0
                ? `Waiting ${countdown}s for rate limit... (batch ${currentPass}/3 complete)`
                : `Generating batch ${currentPass}/3 — ${passName}...`}
          </span>
        </div>

        {/* Center: Pass indicators */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {PASSES.map((pass) => {
            const isDone = isComplete || currentPass > pass.number;
            const isActive = !isComplete && currentPass === pass.number;
            const isWaiting = isActive && countdown > 0;
            return (
              <div key={pass.number} className="flex items-center gap-1">
                <div
                  className={`h-1.5 w-8 rounded-full transition-all duration-500 ${
                    isDone
                      ? 'bg-green-500'
                      : isWaiting
                        ? 'bg-amber-500'
                        : isActive
                          ? 'bg-primary animate-pulse'
                          : 'bg-muted'
                  }`}
                />
                <span
                  className={`text-[10px] font-medium ${
                    isDone ? 'text-green-600 dark:text-green-400' : isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {pass.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right: Count */}
        <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
          {totalGenerated} cases
        </span>
      </div>

      {/* Thin progress bar */}
      <div className="mt-1.5 h-0.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
