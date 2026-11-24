import { useApp } from '@/store/AppContext';

export type RbacRole =
  | 'Server Owner'
  | 'Administrator'
  | 'Project Team'
  | 'Junior Administrator'
  | 'Moderator'
  | 'Support Team'
  | 'Loan Center Management'
  | 'Loan Officer'
  | 'Normal Member';

export type RbacPermission =
  | 'admin.view'
  | 'admin.overview'
  | 'admin.members'
  | 'admin.staff'
  | 'admin.loans'
  | 'admin.discord'
  | 'admin.activity'
  | 'admin.rankings'
  | 'admin.announcements'
  | 'admin.audit'
  | 'admin.access'
  | 'admin.assignRoles'
  | 'admin.grantRevoke'
  | 'staff.view'
  | 'loans.manage'
  | 'loans.view'
  | 'loans.offers'
  | 'support.tickets'
  | 'moderation.tools'
  | 'moderation.ban'
  | 'moderation.timeout'
  | 'moderation.unban'
  | 'rules.manage'
  | 'reports.view'
  | 'reports.file'
  | 'complaints.file'
  | 'complaints.view_junior'
  | 'complaints.view_admin';

const FULL_PERMISSIONS: RbacPermission[] = [
  'admin.view', 'admin.overview', 'admin.members', 'admin.staff', 'admin.loans',
  'admin.discord', 'admin.activity', 'admin.rankings',
  'admin.announcements', 'admin.audit', 'admin.access', 'admin.assignRoles', 'admin.grantRevoke',
  'staff.view', 'loans.manage', 'loans.view', 'loans.offers',
  'support.tickets', 'moderation.tools', 'moderation.ban', 'moderation.timeout', 'moderation.unban',
  'rules.manage',
  'reports.view', 'reports.file', 'complaints.file', 'complaints.view_junior', 'complaints.view_admin',
];

export const rolePermissions: Record<RbacRole, RbacPermission[]> = {
  'Server Owner': FULL_PERMISSIONS,
  Administrator: FULL_PERMISSIONS.filter(p => p !== 'complaints.view_admin'),
  'Project Team': FULL_PERMISSIONS.filter(p => p !== 'complaints.view_admin'),
  'Junior Administrator': ['admin.view', 'admin.overview', 'admin.members', 'admin.activity', 'reports.view', 'reports.file', 'complaints.file'],
  Moderator: ['admin.view', 'admin.overview', 'admin.activity', 'moderation.tools', 'moderation.timeout', 'staff.view', 'reports.view', 'reports.file', 'complaints.file'],
  'Support Team': ['admin.view', 'admin.overview', 'admin.activity', 'support.tickets', 'staff.view', 'complaints.file'],
  'Loan Center Management': ['admin.view', 'admin.overview', 'admin.loans', 'loans.manage', 'loans.view', 'loans.offers', 'admin.activity', 'staff.view'],
  'Loan Officer': ['admin.view', 'admin.overview', 'admin.loans', 'loans.view', 'loans.offers', 'staff.view'],
  'Normal Member': ['complaints.file'],
};

export const allRoles: RbacRole[] = [
  'Server Owner',
  'Administrator',
  'Project Team',
  'Junior Administrator',
  'Moderator',
  'Support Team',
  'Loan Center Management',
  'Loan Officer',
  'Normal Member',
];

export const roleMeta: Record<RbacRole, { label: string; description: string; color: string; emoji: string; glow: string; tier: number }> = {
  'Server Owner': { label: 'Server Owner', description: 'Full access to every feature, setting, department, member, permission and system configuration.', color: '#d4a017', emoji: '👑', glow: 'rgba(212,160,23,0.5)', tier: 1 },
  Administrator: { label: 'Administrator', description: 'Full management powers — identical access to the Server Owner.', color: '#ef4444', emoji: '🛡️', glow: 'rgba(239,68,68,0.5)', tier: 2 },
  'Project Team': { label: 'Project Team', description: 'Project leadership with full administrative access.', color: '#facc15', emoji: '💻', glow: 'rgba(250,204,21,0.5)', tier: 2 },
  'Junior Administrator': { label: 'Junior Administrator', description: 'Junior administrative staff supporting senior leadership.', color: '#22d3ee', emoji: '⚜️', glow: 'rgba(34,211,238,0.5)', tier: 3 },
  Moderator: { label: 'Moderator', description: 'Community moderation and rule enforcement.', color: '#f97316', emoji: '🛡️', glow: 'rgba(249,115,22,0.5)', tier: 4 },
  'Support Team': { label: 'Support Team', description: 'Member support and ticket resolution.', color: '#4ade80', emoji: '🎧', glow: 'rgba(74,222,128,0.5)', tier: 5 },
  'Loan Center Management': { label: 'Loan Center Management', description: 'Loan department management and approvals.', color: '#3b82f6', emoji: '🏦', glow: 'rgba(59,130,246,0.5)', tier: 5 },
  'Loan Officer': { label: 'Loan Officer', description: 'Loan-related operations under Loan Center Management.', color: '#60a5fa', emoji: '💰', glow: 'rgba(96,165,250,0.5)', tier: 6 },
  'Normal Member': { label: 'Normal Member', description: 'Member Dashboard and permitted community features only.', color: '#7a7a86', emoji: '👤', glow: 'rgba(122,122,134,0.3)', tier: 7 },
};

export function hasPermission(role: RbacRole, perm: RbacPermission): boolean {
  return rolePermissions[role]?.includes(perm) ?? false;
}

export function canManageStaff(role: RbacRole): boolean {
  return hasPermission(role, 'admin.assignRoles') || hasPermission(role, 'admin.grantRevoke');
}

export function isAdminLevel(role: RbacRole): boolean {
  return hasPermission(role, 'admin.view');
}

export function usePermissions() {
  const { rbacRole } = useApp();
  return {
    role: rbacRole,
    can: (perm: RbacPermission) => hasPermission(rbacRole, perm),
    canManageStaff: canManageStaff(rbacRole),
    isAdminLevel: isAdminLevel(rbacRole),
    permissions: rolePermissions[rbacRole],
  };
}
