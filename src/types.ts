export type DiscordStatus = 'online' | 'idle' | 'dnd' | 'offline';

export type StaffDepartment =
  | 'Loan Center Management'
  | 'Events'
  | 'Moderation'
  | 'Junior Administrator'
  | 'Support Team';

export interface Member {
  id: string;
  handle: string;
  displayName: string;
  avatarInitials: string;
  accent: string;
  department: StaffDepartment | null;
  verified: boolean;
  joinedDate: string;
  reputation: number;
  status: DiscordStatus;
  activity?: string;
  lastSeen?: string;
  discordConnected: boolean;
  discordUsername?: string;
  bio?: string;
  game: string;
  staffRole?: string;
}

export interface ActivityRecord {
  id: string;
  memberId: string;
  type: 'verification' | 'promotion' | 'loan' | 'event' | 'discord' | 'announcement' | 'join';
  label: string;
  detail: string;
  timestamp: string;
  actor?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: 'Community' | 'Event' | 'Policy' | 'System' | 'Staff';
  pinned: boolean;
  author: string;
  date: string;
}

export interface LoanRecord {
  id: string;
  memberHandle: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'repaid' | 'overdue';
  officer?: string;
  issuedDate: string;
  dueDate: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  target: string;
  actor: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

export interface MemberReport {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  resolution_notes: string;
  resolver_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminComplaint {
  id: string;
  complainant_id: string;
  accused_id: string;
  accused_role: 'Junior Administrator' | 'Administrator';
  subject: string;
  details: string;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  resolution_notes: string;
  resolver_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanOffer {
  id: string;
  officer_id: string;
  member_id: string;
  amount: number;
  interest_rate: number;
  term_days: number;
  purpose: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
  updated_at: string;
}

export type PageId =
  | 'login'
  | 'dashboard'
  | 'profile'
  | 'community'
  | 'staff'
  | 'activity'
  | 'discord'
  | 'announcements'
  | 'admin'
  | 'suggestions'
  | 'support'
  | 'events'
  | 'radio'
  | 'reports'
  | 'complaints'
  | 'loan-offers'
  | 'calls'
  | 'chat'
  | 'rules'
  | 'live-stage';
