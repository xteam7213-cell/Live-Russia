import {
  Crown,
  Shield,
  Users,
  Headphones,
  Landmark,
  BadgeCheck,
  MessageSquare,
  CalendarDays,
  LifeBuoy,
  User,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { RbacRole } from '@/lib/rbac';
import type { StaffDepartment } from '@/types';

const roleIconMap: Record<RbacRole, ReactNode> = {
  'Server Owner': <Crown className="h-4 w-4" />,
  Administrator: <Shield className="h-4 w-4" />,
  'Project Team': <Users className="h-4 w-4" />,
  'Junior Administrator': <BadgeCheck className="h-4 w-4" />,
  Moderator: <Shield className="h-4 w-4" />,
  'Support Team': <Headphones className="h-4 w-4" />,
  'Loan Center Management': <Landmark className="h-4 w-4" />,
  'Loan Officer': <Landmark className="h-4 w-4" />,
  'Normal Member': <User className="h-4 w-4" />,
};

export function roleIcon(role: RbacRole): ReactNode {
  return roleIconMap[role] ?? <User className="h-4 w-4" />;
}

const deptIconMap: Record<StaffDepartment, ReactNode> = {
  'Loan Center Management': <Landmark className="h-5 w-5" />,
  Events: <CalendarDays className="h-5 w-5" />,
  Moderation: <Shield className="h-5 w-5" />,
  'Junior Administrator': <BadgeCheck className="h-5 w-5" />,
  'Support Team': <LifeBuoy className="h-5 w-5" />,
};

export function deptIconByName(dept: StaffDepartment): ReactNode {
  return deptIconMap[dept] ?? <Shield className="h-5 w-5" />;
}

export function roleIconWithColor(role: RbacRole, color: string): ReactNode {
  return (
    <span style={{ color }} className="inline-flex">
      {roleIcon(role)}
    </span>
  );
}
