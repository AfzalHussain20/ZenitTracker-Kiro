import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PageSkeletonProps {
  /** Number of card placeholders to render in the grid. */
  cards?: number;
  /** Render a stats row (4 tiles) above the card grid. */
  stats?: boolean;
  className?: string;
}

/**
 * Route-level loading placeholder.
 *
 * Rendered by `loading.tsx` while a route's server/client chunk resolves so
 * in-app navigation shows a structured skeleton instead of a blank frame.
 */
export function PageSkeleton({ cards = 6, stats = false, className }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Optional stats row */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default PageSkeleton;
