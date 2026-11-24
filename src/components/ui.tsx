import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function Panel({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={cn('panel', hover && 'panel-hover', className)}>{children}</div>;
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
      <div className="flex items-center gap-3">
        {icon && <div className="text-gold-400">{icon}</div>}
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-300">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  accent = 'gold',
}: {
  label: string;
  value: string | number | ReactNode;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  accent?: 'gold' | 'green' | 'blue' | 'red' | 'amber' | 'violet';
}) {
  const accentMap: Record<string, string> = {
    gold: 'text-gold-400 bg-gold-500/10',
    green: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    red: 'text-red-400 bg-red-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
  };
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <Panel hover className="group relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold-500/5 blur-2xl transition-opacity group-hover:bg-gold-500/10" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', accentMap[accent])}>{icon}</div>
      </div>
      {(trend || trendLabel) && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                trend === 'up' && 'text-emerald-400',
                trend === 'down' && 'text-red-400',
                trend === 'flat' && 'text-ink-300',
              )}
            >
              <TrendIcon className="h-3 w-3" />
            </span>
          )}
          {trendLabel && <span className="text-ink-300">{trendLabel}</span>}
        </div>
      )}
    </Panel>
  );
}

export function Badge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode;
  variant?: 'neutral' | 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'violet';
}) {
  const variants: Record<string, string> = {
    neutral: 'bg-white/5 text-ink-200 border-white/10',
    gold: 'bg-gold-500/10 text-gold-300 border-gold-500/30',
    green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    red: 'bg-red-500/10 text-red-300 border-red-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    blue: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  };
  return <span className={cn('chip border', variants[variant])}>{children}</span>;
}

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-ink-300">{icon}</div>
      <p className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-xs text-ink-300">{subtitle}</p>}
    </div>
  );
}
