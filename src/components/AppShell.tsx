import { type ReactNode } from 'react';
import {
  LayoutDashboard,
  User,
  Users,
  Shield,
  Activity,
  Radio,
  Megaphone,
  Lock,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  Lightbulb,
  LifeBuoy,
  CalendarDays,
  Music,
  Flag,
  Gavel,
  HandCoins,
  Phone,
  MessageSquare,
  ScrollText,
  Mic,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Logo } from '@/components/Logo';
import { Avatar, StatusDot } from '@/components/Status';
import { cn } from '@/lib/utils';
import type { PageId } from '@/types';
import { useState } from 'react';
import { isAdminLevel, roleMeta, hasPermission } from '@/lib/rbac';
import { roleIcon } from '@/lib/roleIcons';
import { NotificationsBell } from '@/components/NotificationsBell';
import { RoleBadges } from '@/components/RoleBadge';

interface NavEntry {
  id: PageId;
  label: string;
  icon: ReactNode;
  group: 'member' | 'admin';
  badge?: string;
}

const nav: NavEntry[] = [
  { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="h-4 w-4" />, group: 'member' },
  { id: 'profile', label: 'My Profile', icon: <User className="h-4 w-4" />, group: 'member' },
  { id: 'community', label: 'Community Directory', icon: <Users className="h-4 w-4" />, group: 'member' },
  { id: 'staff', label: 'Staff Directory', icon: <Shield className="h-4 w-4" />, group: 'member' },
  { id: 'activity', label: 'Activity Center', icon: <Activity className="h-4 w-4" />, group: 'member' },
  { id: 'discord', label: 'Discord Status', icon: <Radio className="h-4 w-4" />, group: 'member', badge: 'Demo' },
  { id: 'announcements', label: 'Announcements', icon: <Megaphone className="h-4 w-4" />, group: 'member' },
  { id: 'events', label: 'Events', icon: <CalendarDays className="h-4 w-4" />, group: 'member' },
  { id: 'radio', label: 'Community Radio', icon: <Music className="h-4 w-4" />, group: 'member' },
  { id: 'suggestions', label: 'Suggestions', icon: <Lightbulb className="h-4 w-4" />, group: 'member' },
  { id: 'support', label: 'Support', icon: <LifeBuoy className="h-4 w-4" />, group: 'member' },
  { id: 'loan-offers', label: 'Loan Offers', icon: <HandCoins className="h-4 w-4" />, group: 'member' },
  { id: 'calls', label: 'Voice Rooms', icon: <Phone className="h-4 w-4" />, group: 'member' },
  { id: 'chat', label: 'General Chat', icon: <MessageSquare className="h-4 w-4" />, group: 'member' },
  { id: 'live-stage', label: 'Live Stage', icon: <Mic className="h-4 w-4" />, group: 'member' },
  { id: 'rules', label: 'Community Rules', icon: <ScrollText className="h-4 w-4" />, group: 'member' },
  { id: 'reports', label: 'Member Reports', icon: <Flag className="h-4 w-4" />, group: 'admin' },
  { id: 'complaints', label: 'Admin Complaints', icon: <Gavel className="h-4 w-4" />, group: 'admin' },
  { id: 'admin', label: 'Admin Dashboard', icon: <Lock className="h-4 w-4" />, group: 'admin' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { page, navigate, logout, rbacRole, secondaryRole, profile } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const canSeeAdmin = isAdminLevel(rbacRole) || hasPermission(rbacRole, 'reports.view') || hasPermission(rbacRole, 'complaints.view_junior') || hasPermission(rbacRole, 'complaints.view_admin') || hasPermission(rbacRole, 'loans.offers');
  const visibleNav = nav.filter((n) => {
    if (n.group === 'member') {
      if (n.id === 'loan-offers' && !hasPermission(rbacRole, 'loans.offers') && !hasPermission(rbacRole, 'loans.view')) return false;
      return true;
    }
    if (n.group === 'admin') {
      if (n.id === 'reports' && !hasPermission(rbacRole, 'reports.view') && !hasPermission(rbacRole, 'reports.file')) return false;
      if (n.id === 'complaints' && !hasPermission(rbacRole, 'complaints.file') && !hasPermission(rbacRole, 'complaints.view_junior') && !hasPermission(rbacRole, 'complaints.view_admin')) return false;
      if (n.id === 'admin' && !canSeeAdmin) return false;
      return canSeeAdmin;
    }
    return false;
  });

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-gold-500/10 px-5">
        <button onClick={() => navigate('dashboard')} className="transition-transform hover:scale-[1.02]">
          <Logo size="sm" />
        </button>
        <button
          className="rounded-lg p-1.5 text-ink-300 hover:bg-white/5 hover:text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">Community</p>
        {visibleNav
          .filter((n) => n.group === 'member')
          .map((n) => (
            <button
              key={n.id}
              onClick={() => {
                navigate(n.id);
                setMobileOpen(false);
              }}
              className={cn('nav-item w-full text-left', page === n.id && 'nav-item-active')}
            >
              <span className={cn(page === n.id ? 'text-gold-400' : 'text-ink-300')}>{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.badge && (
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                  {n.badge}
                </span>
              )}
              {page === n.id && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold-500" />}
            </button>
          ))}

        {canSeeAdmin && (
          <>
            <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
              Command Centre
            </p>
            {visibleNav
              .filter((n) => n.group === 'admin')
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    navigate(n.id);
                    setMobileOpen(false);
                  }}
                  className={cn('nav-item w-full text-left', page === n.id && 'nav-item-active')}
                >
                  <span className={cn(page === n.id ? 'text-gold-400' : 'text-ink-300')}>{n.icon}</span>
                  <span className="flex-1">{n.label}</span>
                  {page === n.id && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold-500" />
                  )}
                </button>
              ))}
          </>
        )}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="rounded-xl border border-gold-500/10 bg-ink-900/60 p-3 transition-all hover:border-gold-500/20">
          <div className="flex items-center gap-2.5">
            <Avatar initials={profile?.avatar_initials || 'LR'} accent={profile?.accent || '#d4a017'} status={(profile?.discord_status as 'online'|'idle'|'dnd'|'offline') || 'online'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{profile?.handle || 'Member'}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <RoleBadges primaryRole={rbacRole} secondaryRole={secondaryRole} size="xs" />
              </div>
            </div>
            <button onClick={logout} className="rounded-lg p-1.5 text-ink-300 transition-colors hover:bg-red-500/10 hover:text-red-400" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gold-500/10 bg-ink-900/80 backdrop-blur-md lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/5 bg-ink-900 shadow-2xl animate-fade-up">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gold-500/10 bg-ink-950/85 px-4 backdrop-blur-md lg:px-8">
          <button
            className="rounded-lg p-2 text-ink-200 hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden flex-1 items-center md:flex">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                placeholder="Search members, announcements…"
                className="w-full rounded-lg border border-white/5 bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-ink-400 focus:border-gold-500/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center rounded-lg border border-white/5 bg-ink-900/60 p-2 text-ink-300 transition-all hover:border-gold-500/30 hover:text-gold-400"
              title="Refresh page"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <NotificationsBell />
            <button
              onClick={() => navigate('profile')}
              className="flex items-center gap-2 rounded-lg border border-white/5 bg-ink-900/60 p-1 pr-2 hover:border-gold-500/30"
            >
              <Avatar initials={profile?.avatar_initials || 'LR'} accent={profile?.accent || '#d4a017'} status="online" size="xs" />
              <ChevronDown className="hidden h-3.5 w-3.5 text-ink-300 sm:block" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div key={page} className="mx-auto max-w-7xl animate-page-enter">{children}</div>
        </main>

        <footer className="border-t border-gold-500/10 px-4 py-5 text-center text-xs text-ink-400 lg:px-8">
          <p>
            <span className="font-display font-semibold uppercase tracking-wider text-gold-300">
              Live Russia Gaming
            </span>{' '}
            — One Community. One Identity. One Platform.
          </p>
          <p className="mt-1 text-ink-500">Live Russia Gaming Community Portal · Powered by Supabase.</p>
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold-500/20 bg-gold-500/5 text-gold-400">
            {icon}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-300">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
