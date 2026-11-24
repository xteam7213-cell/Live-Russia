import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Crown, Users, ArrowRight, X, ChevronRight, UserCog,
  Building2, CheckCircle2, Loader2, LifeBuoy, BadgeCheck,
  CalendarDays, MessageSquare, Loader,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/AppShell';
import { Panel, Badge, StatCard, EmptyState } from '@/components/ui';
import { Avatar, StatusBadge } from '@/components/Status';
import { allRoles, roleMeta, type RbacRole } from '@/lib/rbac';
import { roleIcon } from '@/lib/roleIcons';
import { cn } from '@/lib/utils';

interface DepartmentRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  display_order: number;
}

interface StaffAssignmentRow {
  id: string;
  user_id: string;
  department_id: string;
  role_title: string;
  profiles?: { handle: string; avatar_initials: string; accent: string; discord_status: string } | null;
}

interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_initials: string;
  accent: string;
  discord_status: string;
}

function deptIcon(iconName: string) {
  const map: Record<string, React.ReactNode> = {
    Crown: <Crown className="h-5 w-5" />,
    Shield: <Shield className="h-5 w-5" />,
    LifeBuoy: <LifeBuoy className="h-5 w-5" />,
    Building2: <Building2 className="h-5 w-5" />,
    BadgeCheck: <BadgeCheck className="h-5 w-5" />,
    MessageSquare: <MessageSquare className="h-5 w-5" />,
    CalendarDays: <CalendarDays className="h-5 w-5" />,
    Users: <Users className="h-5 w-5" />,
  };
  return map[iconName] || <Shield className="h-5 w-5" />;
}

const DEPT_COLORS: Record<string, string> = {
  'Junior Administrator': '#22d3ee',
  Moderator: '#ef4444',
  'Support Team': '#4ade80',
  'Loan Center Management': '#3b82f6',
  Events: '#06b6d4',
};

const DEPT_HIERARCHY: Record<string, string[]> = {
  'Loan Center Management': ['Loan Officer'],
};

export function StaffPage() {
  const { isAdmin, logAudit, user } = useApp();
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [assignments, setAssignments] = useState<StaffAssignmentRow[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [selectedDept, setSelectedDept] = useState<DepartmentRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: deptData }, { data: assignData }, { data: profData }] = await Promise.all([
      supabase.from('departments').select('*').order('display_order', { ascending: true }),
      supabase.from('staff_assignments').select('*, profiles:staff_assignments_user_id_fkey(handle, avatar_initials, accent, discord_status)'),
      supabase.from('profiles').select('*').order('handle'),
    ]);
    setDepartments(deptData as DepartmentRow[] || []);
    setAssignments(assignData as StaffAssignmentRow[] || []);
    setAllProfiles(profData as ProfileRow[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const deptMembers = (deptId: string) => assignments.filter((a) => a.department_id === deptId);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff HQ"
        subtitle="Departments and officers of LIVE RUSSIA GAMING"
        icon={<Shield className="h-5 w-5" />}
      />

      {/* Department cards */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-300">
          <ChevronRight className="h-3.5 w-3.5 text-gold-400" />
          Tap a department to view its members
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => {
            const count = deptMembers(d.id).length;
            const color = DEPT_COLORS[d.name] || '#d4a017';
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDept(d)}
                className="panel panel-hover group flex w-full flex-col p-5 text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ background: `${color}15`, color, boxShadow: `inset 0 0 0 1px ${color}30` }}
                    >
                      {deptIcon(d.icon)}
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">{d.name}</h3>
                      <p className="text-xs text-ink-300">{d.description}</p>
                      {DEPT_HIERARCHY[d.name] && (
                        <p className="mt-1 text-[10px] font-semibold text-blue-300/80">Includes: {DEPT_HIERARCHY[d.name].join(', ')}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="neutral">{count}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-end text-xs font-semibold text-gold-400">
                  View members <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Staff summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Staff" value={assignments.length} icon={<Shield className="h-5 w-5" />} accent="gold" />
        <StatCard label="Departments" value={departments.length} icon={<Building2 className="h-5 w-5" />} accent="blue" />
        <StatCard label="Total Members" value={allProfiles.length} icon={<Users className="h-5 w-5" />} accent="green" />
        <StatCard label="Loan Officers" value={assignments.filter((a) => a.role_title === 'Loan Officer').length} icon={<Building2 className="h-5 w-5" />} accent="amber" />
      </div>

      {/* Department detail drawer */}
      {selectedDept && (
        <DepartmentDrawer
          dept={selectedDept}
          members={deptMembers(selectedDept.id)}
          onClose={() => setSelectedDept(null)}
          isAdmin={isAdmin}
          allProfiles={allProfiles}
          onAssign={setAssignTarget}
          onRefresh={fetchData}
        />
      )}

      {/* Assign role modal */}
      {assignTarget && (
        <AssignRoleModal
          member={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => { setAssignTarget(null); fetchData(); }}
          logAudit={logAudit}
        />
      )}
    </div>
  );
}

function DepartmentDrawer({
  dept,
  members,
  onClose,
  isAdmin,
  allProfiles,
  onAssign,
  onRefresh,
}: {
  dept: DepartmentRow;
  members: StaffAssignmentRow[];
  onClose: () => void;
  isAdmin: boolean;
  allProfiles: ProfileRow[];
  onAssign: (m: ProfileRow) => void;
  onRefresh: () => void;
}) {
  const color = DEPT_COLORS[dept.name] || '#d4a017';
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const unassigned = allProfiles.filter((p) => !members.some((m) => m.user_id === p.id));

  const handleAdd = async () => {
    if (!selectedProfile) return;
    setSaving(true);
    await supabase.from('staff_assignments').insert({
      user_id: selectedProfile,
      department_id: dept.id,
      role_title: roleTitle || 'Staff',
    });
    setSaving(false);
    setShowAdd(false);
    setSelectedProfile('');
    setRoleTitle('');
    onRefresh();
  };

  const handleRemove = async (assignmentId: string) => {
    await supabase.from('staff_assignments').delete().eq('id', assignmentId);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-ink-900 shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${color}15`, color, boxShadow: `inset 0 0 0 1px ${color}30` }}>
              {deptIcon(dept.icon)}
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">{dept.name}</h3>
              <p className="text-xs text-ink-300">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
          {members.length === 0 && !showAdd && (
            <p className="py-8 text-center text-sm text-ink-300">No members assigned to this department yet.</p>
          )}
          {members.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/5 bg-ink-850/60 p-3">
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar initials={m.profiles?.avatar_initials || '??'} accent={m.profiles?.accent || '#d4a017'} status={(m.profiles?.discord_status as 'online'|'idle'|'dnd'|'offline') || 'offline'} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{m.profiles?.handle || 'Unknown'}</p>
                  </div>
                </div>
                <StatusBadge status={(m.profiles?.discord_status as 'online'|'idle'|'dnd'|'offline') || 'offline'} withDot={false} />
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-ink-400">Role</span>
                  <Badge variant="gold">{m.role_title}</Badge>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-red-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>
          ))}

          {showAdd && (
            <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-3">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold-300">Add staff member</h4>
              <div className="space-y-3">
                <select value={selectedProfile} onChange={(e) => setSelectedProfile(e.target.value)} className="input-field">
                  <option value="">Select member...</option>
                  {unassigned.map((p) => (
                    <option key={p.id} value={p.id}>{p.handle}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="Role title (e.g. Loan Officer)"
                  className="input-field"
                />
                <div className="flex gap-2">
                  <button onClick={handleAdd} disabled={saving || !selectedProfile} className="btn-gold flex-1 py-2 text-xs disabled:opacity-60">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                  </button>
                  <button onClick={() => setShowAdd(false)} className="btn-ghost py-2 text-xs">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {isAdmin && !showAdd && (
          <div className="border-t border-white/5 p-4">
            <button onClick={() => setShowAdd(true)} className="btn-outline w-full py-2 text-xs">
              <UserCog className="h-3.5 w-3.5" /> Add member to department
            </button>
          </div>
        )}

        {dept.name === 'Loan Center Management' && (
          <div className="border-t border-white/5 p-4">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-200/80">
              Loan Officer is a position under Loan Center Management. Officers report to the Loan Center Manager.
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function AssignRoleModal({
  member,
  onClose,
  onAssigned,
  logAudit,
}: {
  member: ProfileRow;
  onClose: () => void;
  onAssigned: () => void;
  logAudit: (action: string, target: string, severity?: 'info' | 'warning' | 'critical') => void;
}) {
  const [selectedRole, setSelectedRole] = useState<RbacRole>('Normal Member');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('set_user_role', {
      target_user: member.id,
      new_role: selectedRole,
    });
    if (!error) {
      logAudit('Role assigned', `${member.handle} → ${selectedRole}`, 'info');
      setSaved(true);
      setTimeout(onAssigned, 700);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <Panel className="relative w-full max-w-sm overflow-hidden p-5 animate-fade-up">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gold-400">
            <UserCog className="h-4 w-4" />
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">Assign Role</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-300 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-lg border border-white/5 bg-ink-900/60 p-3">
          <Avatar initials={member.avatar_initials || '??'} accent={member.accent} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{member.handle}</p>
            <p className="truncate text-xs text-ink-300">{member.display_name}</p>
          </div>
        </div>

        <label className="label">Access level</label>
        <div className="space-y-2">
          {allRoles.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRole(r)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                selectedRole === r
                  ? 'border-gold-500/40 bg-gold-500/10 text-gold-200'
                  : 'border-white/5 bg-ink-900/40 text-ink-200 hover:border-gold-500/20',
              )}
            >
              <span className="flex items-center gap-2">
                <span style={{ color: roleMeta[r].color }} className="inline-flex">{roleIcon(r)}</span>
                {r}
              </span>
              {selectedRole === r && <CheckCircle2 className="h-4 w-4 text-gold-400" />}
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 py-2 text-xs">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 py-2 text-xs disabled:opacity-60">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</> : 'Save role'}
          </button>
        </div>
      </Panel>
    </div>
  );
}
