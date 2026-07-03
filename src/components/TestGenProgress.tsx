'use client';

import { Check, Loader2, FlaskConical } from 'lucide-react';

interface TestGenProgressProps {
  currentPass: number;    // 1, 2, or 3
  passName: string;       // "Functional", "Negative", "Exploratory"
  totalGenerated: number; // running count
  isComplete: boolean;
}

const PASSES = [
  { number: 1, label: 'Functional' },
  { number: 2, label: 'Negative' },
  { number: 3, label: 'Exploratory' },
];

export default function TestGenProgress({
  currentPass,
  passName,
  totalGenerated,
  isComplete,
}: TestGenProgressProps) {
  return (
    <div className="w-full rounded-xl border border-border/50 bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {isComplete ? 'Generation Complete' : 'Generating Test Cases…'}
          </h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {totalGenerated} test case{totalGenerated !== 1 ? 's' : ''} generated
        </span>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {PASSES.map((pass, index) => {
          const isActive = !isComplete && currentPass === pass.number;
          const isCompleted = isComplete || currentPass > pass.number;

          return (
            <div key={pass.number} className="flex items-center flex-1 last:flex-initial">
              {/* Step indicator + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full border-2 transition-all duration-300 ${
                    isCompleted
                      ? 'border-green-500 bg-green-500 text-white'
                      : isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-xs font-semibold">{pass.number}</span>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium whitespace-nowrap ${
                    isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : isActive
                        ? 'text-primary'
                        : 'text-muted-foreground'
                  }`}
                >
                  {pass.label}
                </span>
              </div>

              {/* Connector line between steps */}
              {index < PASSES.length - 1 && (
                <div className="flex-1 mx-3 mt-[-1.25rem]">
                  <div
                    className={`h-0.5 w-full rounded-full transition-colors duration-300 ${
                      isComplete || currentPass > pass.number + 1
                        ? 'bg-green-500'
                        : currentPass > pass.number
                          ? 'bg-green-500'
                          : 'bg-border'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status message */}
      <div className="mt-4 pt-3 border-t border-border/30">
        {isComplete ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500/10">
              <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              All {totalGenerated} test cases generated successfully
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Running pass {currentPass}/3 — <span className="font-medium text-foreground">{passName}</span>
          </p>
        )}
      </div>
    </div>
  );
}
