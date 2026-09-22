import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({ padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-card border border-line bg-panel',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-6',
        padding === 'lg' && 'p-8',
        padding === 'none' && '',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── Stat Card for Dashboard ─────────────────────────────────── */

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: 'primary' | 'positive' | 'negative' | 'warning';
  icon?: React.ReactNode;
}

export function StatCard({ title, value, subtitle, color = 'primary', icon }: StatCardProps) {
  const colorClasses = {
    primary: 'text-primary',
    positive: 'text-positive',
    negative: 'text-negative',
    warning: 'text-warning',
  };

  const bgClasses = {
    primary: 'bg-primary/8',
    positive: 'bg-positive/8',
    negative: 'bg-negative/8',
    warning: 'bg-warning/8',
  };

  return (
    <div className="rounded-card border border-line bg-panel p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-muted truncate">{title}</p>
          <p className={clsx('text-2xl font-semibold mt-1', colorClasses[color])}>{value}</p>
          {subtitle && (
            <p className="text-[12px] text-muted mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3', bgClasses[color])}>
            <span className={colorClasses[color]}>{icon}</span>
          </div>
        )}
      </div>
    </div>
  );
}
