import { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Users,
  ShieldCheck,
  Shield,
  Coins,
  Radio,
  Activity as ActivityIcon,
  CheckCircle2,
  Megaphone,
  ScrollText,
  KeyRound,
  TrendingUp,
  AlertTriangle,
  Clock,
  Search,
  Eye,
  XCircle,
  Bell,
  Building2,
  ChevronRight,
  BadgeCheck,
  UserCog,
  Ban,
  Loader2,
  Gavel,
  Timer,
  Undo2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notifyBan, notifyTimeout, notifyUnban, notifyTimeoutRemoved } from '@/lib/notifications';
import { PageHeader } from '@/components/AppShell';
import { Panel, PanelHeader, StatCard, Badge, EmptyState } from '@/components/ui';
import { Avatar, StatusBadge } from '@/components/Status';
import { useApp } from '@/store/AppContext';
import { rolePermissions, roleMeta, allRoles, usePermissions, type RbacRole, type RbacPermission } from '@/lib/rbac';
import { roleIcon } from '@/lib/roleIcons';
import { cn } from '@/lib/utils';

type AdminTab =
  | 'overview'
  | 'members'
  | 'staff'
  | 'loans'
  | 'discord'
  | 'activity'
  | 'announcements'
  | 'moderation'
  | 'audit'
  | 'access';

const tabPermissions: Record<AdminTab, RbacPermission | null> = {
  overview: 'admin.overview',
  members: 'admin.members',
  staff: 'admin.staff',
  loans: 'admin.loans',
  discord: 'admin.discord',
  activity: 'admin.activity',
  announcements: 'admin.announcements',
  moderation: 'moderation.tools',
  audit: 'admin.audit',
  access: 'admin.access',
};

const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Lock className="h-4 w-4" /> },
  { id: 'members', label: 'Member Management', icon: <Users className="h-4 w-4" /> },
  { id: 'staff', label: 'Staff Departments', icon: <Building2 className="h-4 w-4" /> },
  { id: 'loans', label: 'Loan Center', icon: <Coins className="h-4 w-4" /> },
  { id: 'discord', label: 'Discord Status', icon: <Radio className="h-4 w-4" /> },
  { id: 'activity', label: 'Activity Records', icon: <ActivityIcon className="h-4 w-4" /> },
  { id: 'announcements', label: 'Announcements', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'moderation', label: 'Moderation', icon: <Gavel className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit Logs', icon: <ScrollText className="h-4 w-4" /> },
  { id: 'access', label: 'Access Permissions', icon: <KeyRound className="h-4 w-4" /> },
];

interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_initials: string;
  accent: string;
  discord_status: string;
  verified: boolean;
  game: string;
  created_at: string;
}

interface LoanRow {
  id: string;
  member_id: string;
  amount: number;
  purpose: string;
  status: string;
  issued_date: string | null;
  due_date: string | null;
  profiles?: { handle: string } | null;
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  created_at: string;
}

interface AuditRow {
  id: string;
  action: string;
  target: string;
  severity: string;
  created_at: string;
  actor_id: string | null;
  profiles?: { handle: string } | null;
}

interface ActivityRow {
  id: string;
  type: string;
  label: string;
  detail: string;
  created_at: string;
  profiles?: { handle: string; avatar_initials: string; accent: string } | null;
}

interface DepartmentRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  display_order: number;
}

export function AdminPage() {
  const { rbacRole, logAudit } = useApp();
  const [tab, setTab] = useState<AdminTab>('overview');

  const can = (perm: RbacPermission | null) => (perm ? rolePermissions[rbacRole]?.includes(perm) ?? false : true);
  const visibleTabs = tabs.filter((t) => can(tabPermissions[t.id]));

  const handleTabChange = (t: AdminTab) => {
    if (can(tabPermissions[t])) {
      setTab(t);
      logAudit('Admin tab viewed', t, 'info');
    }
  };

  const effectiveTab = can(tabPermissions[tab]) ? tab : visibleTabs[0]?.id ?? 'overview';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Command Centre"
        subtitle="LIVE RUSSIA GAMING — administrative control panel"
        icon={<Lock className="h-5 w-5" />}
        actions={<Badge variant="gold">{rbacRole}</Badge>}
      />

      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <p className="text-xs text-emerald-200/80">
          RBAC active — your access is gated by your role ({rbacRole}). Admin tabs and actions you lack permission for
          are hidden. Direct URL access cannot bypass server-side RLS policies and permission checks.
        </p>
      </div>

      <Panel className="p-2">
        <div className="flex flex-wrap gap-1">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                effectiveTab === t.id
                  ? 'bg-gold-500/15 text-gold-200'
                  : 'text-ink-300 hover:bg-white/5 hover:text-white',
              )}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </Panel>

      {effectiveTab === 'overview' && <Overview />}
      {effectiveTab === 'members' && <MemberManagement />}
      {effectiveTab === 'staff' && <StaffManagement />}
      {effectiveTab === 'loans' && <LoanManagement />}
      {effectiveTab === 'discord' && <DiscordManagement />}
      {effectiveTab === 'activity' && <ActivityRecords />}
      {effectiveTab === 'announcements' && <AnnouncementsManagement />}
      {effectiveTab === 'moderation' && <ModerationPanel />}
      {effectiveTab === 'audit' && <AuditLogs />}
      {effectiveTab === 'access' && <AccessPermissions />}
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState({ members: 0, verified: 0, loans: 0, announcements: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [members, verif, loans, ann] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('verified', true),
        supabase.from('loans').select('*', { count: 'exact', head: true }).neq('status', 'repaid'),
        supabase.from('announcements').select('*', { count: 'exact', head: true }),
      ]);
      setStats({
        members: members.count || 0,
        verified: verif.count || 0,
        loans: loans.count || 0,
        announcements: ann.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Members" value={stats.members} icon={<Users className="h-5 w-5" />} accent="gold" />
        <StatCard label="Verified Players" value={stats.verified} icon={<ShieldCheck className="h-5 w-5" />} accent="green" />
        <StatCard label="Active Loans" value={stats.loans} icon={<Coins className="h-5 w-5" />} accent="amber" />
        <StatCard label="Announcements" value={stats.announcements} icon={<Megaphone className="h-5 w-5" />} accent="amber" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Announcements" value={stats.announcements} icon={<Megaphone className="h-5 w-5" />} accent="green" />
        <StatCard label="Staff Members" value="—" icon={<Shield className="h-5 w-5" />} accent="blue" />
        <StatCard label="Discord Members" value="—" icon={<Radio className="h-5 w-5" />} accent="violet" />
        <StatCard label="Audit Events" value="—" icon={<ScrollText className="h-5 w-5" />} accent="amber" />
      </div>

      <Panel>
        <PanelHeader title="Recent Audit Events" icon={<ScrollText className="h-4 w-4" />} />
        <RecentAudit />
      </Panel>
    </div>
  );
}

function RecentAudit() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*, profiles:audit_logs_actor_id_fkey(handle)')
        .order('created_at', { ascending: false })
        .limit(5);
      setLogs((data as AuditRow[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gold-500" /></div>;
  if (logs.length === 0) return <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No audit events" subtitle="Admin actions will be logged here." />;

  return (
    <div className="divide-y divide-white/5">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-3 px-5 py-3">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', log.severity === 'critical' ? 'bg-red-500/10 text-red-400' : log.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-ink-300')}>
            {log.severity === 'critical' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white"><span className="font-semibold">{log.action}</span> — {log.target}</p>
            <p className="text-xs text-ink-400">by {log.profiles?.handle || 'System'}</p>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-ink-400">{new Date(log.created_at).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

function MemberManagement() {
  const { logAudit, user } = useApp();
  const { canManageStaff } = usePermissions();
  const [q, setQ] = useState('');
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignTarget, setAssignTarget] = useState<ProfileRow | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setMembers((data as ProfileRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filtered = members.filter((m) => !q || `${m.handle} ${m.display_name}`.toLowerCase().includes(q.toLowerCase()));

  const grantRole = async (targetId: string, role: string) => {
    const { error } = await supabase.rpc('set_user_role', { target_user: targetId, new_role: role });
    if (error) {
      console.warn('Role grant failed:', error.message);
      return;
    }
    const m = members.find((x) => x.id === targetId);
    logAudit('Staff role granted', `${m?.handle} → ${role}`, 'warning');
    setAssignTarget(null);
    fetchMembers();
  };

  const revokeRole = async (targetId: string) => {
    const { error } = await supabase.rpc('set_user_role', { target_user: targetId, new_role: 'Normal Member' });
    if (error) {
      console.warn('Role revoke failed:', error.message);
      return;
    }
    const m = members.find((x) => x.id === targetId);
    logAudit('Staff role revoked', m?.handle ?? targetId, 'warning');
    fetchMembers();
  };

  const toggleVerified = async (targetId: string, current: boolean) => {
    const { error } = await supabase.from('profiles').update({ verified: !current }).eq('id', targetId);
    if (error) return;
    const m = members.find((x) => x.id === targetId);
    logAudit('Verification toggled', `${m?.handle} → ${!current ? 'verified' : 'unverified'}`, 'info');
    fetchMembers();
  };

  return (
    <Panel>
      <PanelHeader title="Member Management" subtitle={`${members.length} total`} icon={<Users className="h-4 w-4" />}
        action={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-40 rounded-lg border border-white/5 bg-ink-900/60 py-1.5 pl-8 pr-3 text-xs text-white focus:border-gold-500/40 focus:outline-none" />
          </div>
        }
      />
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No members found" subtitle="Adjust your search query." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-ink-400">
                <th className="px-5 py-3 font-semibold">Member</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Status</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Verified</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((m) => (
                <tr key={m.id} className="table-row-hover">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={m.avatar_initials || '??'} accent={m.accent} size="sm" />
                      <div><p className="font-semibold text-white">{m.handle}</p><p className="text-xs text-ink-400">{m.display_name}</p></div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 sm:table-cell"><StatusBadge status={(m.discord_status as 'online'|'idle'|'dnd'|'offline') || 'offline'} withDot={false} /></td>
                  <td className="hidden px-5 py-3 md:table-cell">{m.verified ? <Badge variant="green">Yes</Badge> : <Badge variant="amber">Pending</Badge>}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleVerified(m.id, m.verified)} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/5 hover:text-gold-400" title="Toggle verification"><BadgeCheck className="h-4 w-4" /></button>
                      {canManageStaff && (
                        <>
                          <button onClick={() => setAssignTarget(m)} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/5 hover:text-gold-400" title="Assign staff role"><UserCog className="h-4 w-4" /></button>
                          <button onClick={() => revokeRole(m.id)} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/5 hover:text-red-400" title="Revoke staff role"><Ban className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAssignTarget(null)} />
          <Panel className="relative w-full max-w-sm overflow-hidden p-5 animate-fade-up">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gold-400">
                <UserCog className="h-4 w-4" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">Assign Staff Role</h3>
              </div>
              <button onClick={() => setAssignTarget(null)} className="rounded-lg p-1 text-ink-300 hover:bg-white/5 hover:text-white">✕</button>
            </div>
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-white/5 bg-ink-900/60 p-3">
              <Avatar initials={assignTarget.avatar_initials || '??'} accent={assignTarget.accent} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{assignTarget.handle}</p>
                <p className="truncate text-xs text-ink-300">{assignTarget.display_name}</p>
              </div>
            </div>
            <label className="label">Select role</label>
            <div className="space-y-2">
              {allRoles.map((r) => (
                <button
                  key={r}
                  onClick={() => grantRole(assignTarget.id, r)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-ink-900/40 px-3 py-2.5 text-left text-sm text-ink-200 transition-colors hover:border-gold-500/30 hover:bg-gold-500/5"
                >
                  <span className="flex items-center gap-2">
                    <span style={{ color: roleMeta[r].color }} className="inline-flex">{roleIcon(r)}</span>
                    {r}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-ink-400" />
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[10px] text-ink-400">Role changes are enforced server-side via SECURITY DEFINER RPC.</p>
          </Panel>
        </div>
      )}
    </Panel>
  );
}

function StaffManagement() {
  const { logAudit } = useApp();
  const { canManageStaff } = usePermissions();
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('departments').select('*').order('display_order', { ascending: true });
      setDepartments((data as DepartmentRow[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>;
  if (departments.length === 0) return <Panel><EmptyState icon={<Building2 className="h-6 w-6" />} title="No departments" subtitle="Departments will appear here once configured." /></Panel>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <Panel key={d.id} hover className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div><h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">{d.name}</h3><p className="text-xs text-ink-300">{d.description}</p></div>
              </div>
            </div>
            {canManageStaff ? (
              <div className="mt-4 flex gap-2">
                <button onClick={() => logAudit('Department managed', d.name, 'info')} className="btn-ghost flex-1 py-1.5 text-xs">Manage</button>
                <button onClick={() => logAudit('Staff assigned', d.name, 'info')} className="btn-outline py-1.5 text-xs">Assign</button>
              </div>
            ) : (
              <p className="mt-4 text-[11px] text-ink-400">View only — role assignment requires elevated permissions.</p>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}

function LoanManagement() {
  const { logAudit } = useApp();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('loans')
      .select('*, profiles:loans_member_id_fkey(handle)')
      .order('created_at', { ascending: false });
    setLoans((data as LoanRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const approveLoan = async (id: string) => {
    const { error } = await supabase.from('loans').update({ status: 'approved', issued_date: new Date().toISOString().split('T')[0] }).eq('id', id);
    if (error) return;
    const l = loans.find((x) => x.id === id);
    logAudit('Loan approved', `${l?.profiles?.handle} — ${l?.amount.toLocaleString()}$`, 'info');
    fetchLoans();
  };

  const statusVariant: Record<string, 'amber' | 'green' | 'blue' | 'red'> = {
    pending: 'amber', approved: 'green', repaid: 'blue', overdue: 'red',
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Loans" value={loans.length} icon={<Coins className="h-5 w-5" />} accent="amber" />
        <StatCard label="Pending" value={loans.filter((l) => l.status === 'pending').length} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <StatCard label="Approved" value={loans.filter((l) => l.status === 'approved').length} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <StatCard label="Overdue" value={loans.filter((l) => l.status === 'overdue').length} icon={<AlertTriangle className="h-5 w-5" />} accent="red" />
      </div>

      <Panel>
        <PanelHeader title="Loan Center" subtitle={`${loans.length} records`} icon={<Coins className="h-4 w-4" />} />
        {loans.length === 0 ? (
          <EmptyState icon={<Coins className="h-6 w-6" />} title="No loan records" subtitle="Loan requests will appear here when submitted." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="hidden px-5 py-3 font-semibold sm:table-cell">Purpose</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loans.map((l) => (
                  <tr key={l.id} className="table-row-hover">
                    <td className="px-5 py-3 font-semibold text-white">{l.profiles?.handle || '—'}</td>
                    <td className="hidden px-5 py-3 text-ink-300 sm:table-cell">{l.purpose}</td>
                    <td className="px-5 py-3 font-display font-bold text-gold-300">{l.amount.toLocaleString()}$</td>
                    <td className="px-5 py-3"><Badge variant={statusVariant[l.status] || 'amber'}>{l.status}</Badge></td>
                    <td className="px-5 py-3">
                      {l.status === 'pending' ? (
                        <button onClick={() => approveLoan(l.id)} className="btn-ghost px-2.5 py-1 text-[11px] text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Approve</button>
                      ) : <span className="text-[11px] text-ink-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function DiscordManagement() {
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('*');
      setMembers((data as ProfileRow[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>;

  return (
    <div className="space-y-6">
      <Panel className="border-amber-500/20">
        <div className="flex items-start gap-3 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><Radio className="h-5 w-5" /></div>
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">Discord Status Management</h3>
            <p className="mt-1 text-xs text-ink-300">Bot integration is not yet connected. Configure an authorized Discord bot with Presence and Server Members privileged intents to enable live management.</p>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Portal Members" value={members.length} icon={<Users className="h-5 w-5" />} accent="violet" />
        <StatCard label="Discord Linked" value={members.filter((m) => m.verified).length} icon={<ShieldCheck className="h-5 w-5" />} accent="green" />
        <StatCard label="Bot Status" value="Offline" icon={<Radio className="h-5 w-5" />} accent="red" />
        <StatCard label="Sync" value="Not configured" icon={<Clock className="h-5 w-5" />} accent="amber" />
      </div>

      <Panel>
        <PanelHeader title="Presence Distribution" icon={<ActivityIcon className="h-4 w-4" />} />
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          {(['online', 'idle', 'dnd', 'offline'] as const).map((s) => {
            const count = members.filter((m) => m.discord_status === s).length;
            return (
              <div key={s} className="rounded-xl border border-white/5 bg-ink-900/40 p-4 text-center">
                <StatusBadge status={s} />
                <p className="mt-2 font-display text-2xl font-bold text-white">{count}</p>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function ActivityRecords() {
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('*, profiles:activity_logs_user_id_fkey(handle, avatar_initials, accent)')
        .order('created_at', { ascending: false })
        .limit(20);
      setActivity((data as ActivityRow[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>;

  return (
    <Panel>
      <PanelHeader title="Activity Records" subtitle={`${activity.length} entries`} icon={<ActivityIcon className="h-4 w-4" />} />
      {activity.length === 0 ? (
        <EmptyState icon={<ActivityIcon className="h-6 w-6" />} title="No activity records" subtitle="Community activity will appear here." />
      ) : (
        <div className="divide-y divide-white/5">
          {activity.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3">
              {a.profiles && <Avatar initials={a.profiles.avatar_initials} accent={a.profiles.accent} size="sm" />}
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{a.profiles?.handle || 'System'}</p><p className="truncate text-xs text-ink-300">{a.label} — {a.detail}</p></div>
              <span className="font-mono text-[11px] text-ink-400">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AnnouncementsManagement() {
  const { logAudit, user } = useApp();
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', category: 'Community' });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setItems((data as AnnouncementRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const create = async () => {
    if (!form.title || !form.body) return;
    const { error } = await supabase.from('announcements').insert({
      title: form.title,
      body: form.body,
      category: form.category,
      author_id: user?.id,
    });
    if (error) return;
    logAudit('Announcement created', form.title, 'info');
    setForm({ title: '', body: '', category: 'Community' });
    setShowForm(false);
    fetchItems();
  };

  const togglePin = async (id: string, current: boolean) => {
    await supabase.from('announcements').update({ pinned: !current }).eq('id', id);
    fetchItems();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>;

  return (
    <Panel>
      <PanelHeader title="Announcements Management" subtitle={`${items.length} published`} icon={<Megaphone className="h-4 w-4" />}
        action={<button onClick={() => setShowForm(!showForm)} className="btn-gold py-1.5 text-xs"><Megaphone className="h-3.5 w-3.5" /> New</button>}
      />
      {showForm && (
        <div className="space-y-3 border-b border-white/5 p-5">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="input-field" />
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Body" rows={3} className="input-field resize-none" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">
            {['Community', 'Event', 'Policy', 'System', 'Staff'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={create} className="btn-gold py-2 text-xs">Publish</button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements" subtitle="Create one to share with the community." />
      ) : (
        <div className="divide-y divide-white/5">
          {items.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-white">{a.title}</p>
                  {a.pinned && <Badge variant="gold">Pinned</Badge>}
                </div>
                <p className="truncate text-xs text-ink-300">{new Date(a.created_at).toLocaleDateString()} · {a.category}</p>
              </div>
              <button onClick={() => togglePin(a.id, a.pinned)} className="btn-ghost px-3 py-1.5 text-xs">{a.pinned ? 'Unpin' : 'Pin'}</button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AuditLogs() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*, profiles:audit_logs_actor_id_fkey(handle)')
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs((data as AuditRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const sevVariant = { info: 'blue', warning: 'amber', critical: 'red' } as const;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>;

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader title="Audit Logs" subtitle={`${logs.length} entries`} icon={<ScrollText className="h-4 w-4" />} />
        {logs.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No audit entries" subtitle="Admin actions will be logged here." />
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3.5">
                <Badge variant={sevVariant[log.severity as keyof typeof sevVariant] || 'blue'}>{log.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white"><span className="font-semibold">{log.action}</span> — {log.target}</p>
                  <p className="text-xs text-ink-400">by {log.profiles?.handle || 'System'}</p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-ink-400">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function AccessPermissions() {
  const { rbacRole } = useApp();
  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader title="RBAC Role Matrix" subtitle="8 access levels" icon={<KeyRound className="h-4 w-4" />} />
        <div className="space-y-3 p-5">
          {allRoles.map((r) => {
            const meta = roleMeta[r];
            const perms = rolePermissions[r] ?? [];
            const isCurrent = rbacRole === r;
            return (
              <div key={r} className={cn('rounded-xl border p-4 transition-colors', isCurrent ? 'border-gold-500/40 bg-gold-500/5' : 'border-white/5 bg-ink-900/40')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${meta.color}15`, color: meta.color, boxShadow: `inset 0 0 0 1px ${meta.color}30` }}>
                      <Shield className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-white">{meta.label}{isCurrent && <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-400">Your role</span>}</p>
                      <p className="text-xs text-ink-400">{meta.description}</p>
                    </div>
                  </div>
                  <Badge variant="neutral">Tier {meta.tier}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {perms.length === 0 ? <span className="text-[11px] text-ink-400">No admin permissions — community access only.</span> : perms.map((p) => <Badge key={p} variant="neutral">{p}</Badge>)}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Security Posture" icon={<ShieldCheck className="h-4 w-4" />} />
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
          <SecRow label="RLS on all tables" value="Active" ok />
          <SecRow label="Server-side permission checks" value="Active" ok />
          <SecRow label="Audit logging (admin actions)" value="Active" ok />
          <SecRow label="SECURITY DEFINER role RPC" value="Active" ok />
          <SecRow label="Discord bot scopes" value="Pending" ok={false} />
          <SecRow label="WebRTC TURN server" value="Pending" ok={false} />
        </div>
      </Panel>
    </div>
  );
}

function SecRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-ink-900/40 p-3">
      <span className="text-xs text-ink-200">{label}</span>
      <span className={cn('flex items-center gap-1.5 text-xs font-semibold', ok ? 'text-emerald-300' : 'text-amber-300')}>
        <span className={cn('h-1.5 w-1.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-amber-400')} /> {value}
      </span>
    </div>
  );
}
