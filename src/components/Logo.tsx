import { cn } from '@/lib/utils';

export function Logo({ size = 'md', showText = true }: { size?: 'sm' | 'md' | 'lg'; showText?: boolean }) {
  const logoSize =
    size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const titleSize = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base';
  const subtitleSize = size === 'lg' ? 'text-[11px]' : 'text-[10px]';

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-xl border border-gold-500/30 bg-gradient-to-br from-ink-800 to-ink-900 shadow-gold transition-transform duration-300 hover:scale-[1.03]',
          logoSize,
        )}
      >
        <div className="absolute inset-0 bg-gold-sheen opacity-30" />
        <img
          src="/assets/live-russia-logo.png"
          alt="LIVE RUSSIA"
          className="relative h-full w-full object-cover"
          width={size === 'lg' ? 56 : size === 'sm' ? 36 : 44}
          height={size === 'lg' ? 56 : size === 'sm' ? 36 : 44}
        />
      </div>
      {showText && (
        <div className="leading-tight">
          <p className={cn('font-display font-bold uppercase tracking-wide text-white', titleSize)}>
            Live <span className="gold-text">Russia</span> Gaming
          </p>
          <p className={cn('font-medium uppercase tracking-[0.2em] text-ink-300', subtitleSize)}>
            LR Community Portal
          </p>
        </div>
      )}
    </div>
  );
}
