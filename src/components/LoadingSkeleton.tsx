import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  /** Number of table rows to show as skeleton */
  rows?: number;
  /** Columns widths for table skeleton — e.g. ['w-24', 'w-32', 'w-48'] */
  columns?: string[];
}

/** Single skeleton block */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

/** Table loading skeleton — shows placeholder rows */
export function TableSkeleton({ rows = 5, columns = ['w-20', 'w-32', 'w-48', 'w-24', 'w-20'] }: SkeletonProps) {
  return (
    <div className="space-y-3 p-4">
      {/* Header skeleton */}
      <div className="flex gap-4 pb-3 border-b border-line">
        {columns.map((w, i) => (
          <div key={`h-${i}`} className={clsx('skeleton h-4', w)} />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-4 py-2">
          {columns.map((w, ci) => (
            <div key={`r${ri}-c${ci}`} className={clsx('skeleton h-4', w)} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card loading skeleton */
export function CardSkeleton() {
  return (
    <div className="rounded-card border border-line bg-panel p-5 space-y-3">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-7 w-32" />
      <div className="skeleton h-3 w-20" />
    </div>
  );
}
