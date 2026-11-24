import { roleMeta, type RbacRole } from '@/lib/rbac';

interface RoleBadgeProps {
  role: RbacRole;
  size?: 'xs' | 'sm' | 'md';
}

export function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  const meta = roleMeta[role];
  if (!meta) return null;

  const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0.5 gap-0.5',
    sm: 'text-[11px] px-2.5 py-1 gap-1.5',
    md: 'text-xs px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={`role-badge ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${meta.color}20`,
        color: meta.color,
        border: `1px solid ${meta.color}40`,
        ['--badge-glow' as string]: meta.glow,
      }}
    >
      <span className="leading-none">{meta.emoji}</span>
      <span className="whitespace-nowrap">{meta.label}</span>
    </span>
  );
}

interface RoleBadgesProps {
  primaryRole: RbacRole;
  secondaryRole?: RbacRole | null;
  size?: 'xs' | 'sm' | 'md';
}

export function RoleBadges({ primaryRole, secondaryRole, size = 'sm' }: RoleBadgesProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <RoleBadge role={primaryRole} size={size} />
      {secondaryRole && <RoleBadge role={secondaryRole} size={size} />}
    </span>
  );
}

interface RoleNameProps {
  role: RbacRole;
  children: React.ReactNode;
  className?: string;
}

const titleClassMap: Partial<Record<RbacRole, string>> = {
  'Server Owner': 'title-owner',
  Administrator: 'title-admin',
  'Project Team': 'title-project',
};

export function RoleName({ role, children, className = '' }: RoleNameProps) {
  const titleClass = titleClassMap[role];
  if (titleClass) {
    return <span className={`${titleClass} ${className}`}>{children}</span>;
  }
  const meta = roleMeta[role];
  return (
    <span className={`font-display font-bold ${className}`} style={{ color: meta?.color }}>
      {children}
    </span>
  );
}

interface ProfileFrameProps {
  role: RbacRole;
  size?: number;
  children: React.ReactNode;
}

export function ProfileFrame({ role, size = 48, children }: ProfileFrameProps) {
  const meta = roleMeta[role];
  if (!meta) return <div style={{ width: size, height: size }}>{children}</div>;

  return (
    <div
      className="profile-frame"
      style={{
        width: size,
        height: size,
        color: meta.color,
      }}
    >
      <div className="profile-frame-inner" style={{ width: size - 6, height: size - 6, overflow: 'hidden', borderRadius: '50%' }}>
        {children}
      </div>
    </div>
  );
}
