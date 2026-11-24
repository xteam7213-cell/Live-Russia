import type { DiscordStatus } from '@/types';
import { cn } from '@/lib/utils';

const statusConfig: Record<
  DiscordStatus,
  { label: string; dot: string; ring: string; text: string; bg: string }
> = {
  online: {
    label: 'Online',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-400/40',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  idle: {
    label: 'Idle',
    dot: 'bg-amber-400',
    ring: 'ring-amber-400/40',
    text: 'text-amber-300',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
  dnd: {
    label: 'Do Not Disturb',
    dot: 'bg-red-500',
    ring: 'ring-red-500/40',
    text: 'text-red-300',
    bg: 'bg-red-500/10 border-red-500/30',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-ink-400',
    ring: 'ring-ink-500/40',
    text: 'text-ink-300',
    bg: 'bg-ink-700/30 border-ink-600/40',
  },
};

export function statusConfigFor(status: DiscordStatus) {
  return statusConfig[status];
}

export function StatusDot({ status, size = 'md' }: { status: DiscordStatus; size?: 'sm' | 'md' | 'lg' }) {
  const c = statusConfig[status];
  const sz = size === 'lg' ? 'h-3.5 w-3.5' : size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  return (
    <span
      className={cn('inline-block rounded-full ring-2 ring-ink-900', sz, c.dot, status === 'online' && 'animate-pulse-ring')}
    />
  );
}

export function StatusBadge({ status, withDot = true }: { status: DiscordStatus; withDot?: boolean }) {
  const c = statusConfig[status];
  return (
    <span className={cn('chip border', c.bg, c.text)}>
      {withDot && <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />}
      {c.label}
    </span>
  );
}

export function Avatar({
  initials,
  accent,
  status,
  size = 'md',
  ring = true,
}: {
  initials: string;
  accent: string;
  status?: DiscordStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
}) {
  const sizes: Record<string, string> = {
    xs: 'h-7 w-7 text-[10px]',
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-lg',
    xl: 'h-24 w-24 text-2xl',
  };
  const dotSizes: Record<string, string> = {
    xs: 'h-2 w-2',
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
    xl: 'h-5 w-5',
  };
  return (
    <div className="relative inline-block shrink-0">
      <div
        className={cn(
          'flex items-center justify-center rounded-xl font-display font-semibold uppercase tracking-wide',
          sizes[size],
          ring && 'ring-1 ring-white/10',
        )}
        style={{
          background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
          color: accent,
          boxShadow: `inset 0 0 0 1px ${accent}30`,
        }}
      >
        {initials}
      </div>
      {status && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-ink-900',
            dotSizes[size],
            statusConfig[status].dot,
            status === 'online' && 'animate-pulse-ring',
          )}
        />
      )}
    </div>
  );
}
