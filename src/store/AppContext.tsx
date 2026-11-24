import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { PageId, AuditLogEntry } from '@/types';
import type { RbacRole } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { useAuthProvider, type AuthProfile } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';


interface AppState {
  page: PageId;
  navigate: (page: PageId) => void;
  authed: boolean;
  loading: boolean;
  login: () => void;
  logout: () => void;
  isAdmin: boolean;
  rbacRole: RbacRole;
  secondaryRole: RbacRole | null;
  recoveryMode: boolean;
  setRbacRole: (role: RbacRole) => void;
  currentHandle: string;
  auditLogs: AuditLogEntry[];
  logAudit: (action: string, target: string, severity?: AuditLogEntry['severity']) => void;
  profileId: string;
  setProfileId: (id: string) => void;
  profile: AuthProfile | null;
  user: User | null;
  refreshProfile: () => Promise<void>;
  supabaseSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  supabaseSignUp: (email: string, password: string, handle: string, displayName: string) => Promise<{ error: string | null }>;
  supabaseSignOut: () => Promise<void>;
  supabaseResetPassword: (email: string) => Promise<{ error: string | null }>;
  supabaseUpdatePassword: (password: string) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  const [page, setPage] = useState<PageId>('login');
  const [profileId, setProfileId] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const authed = !!auth.session && !auth.loading;
  const rbacRole = auth.role;
  const secondaryRole = auth.secondaryRole;
  const recoveryMode = auth.recoveryMode;

  const navigate = (p: PageId) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const login = () => {
    setPage('dashboard');
  };

  const logout = () => {
    auth.signOut();
    setPage('login');
  };

  const logAudit = useCallback(
    async (action: string, target: string, severity: AuditLogEntry['severity'] = 'info') => {
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const entry: AuditLogEntry = {
        id: `g${Date.now()}`,
        action,
        target,
        actor: auth.profile?.handle ?? 'system',
        severity,
        timestamp: ts,
      };
      setAuditLogs((prev) => [entry, ...prev]);

      if (auth.user) {
        await supabase.from('audit_logs').insert({
          actor_id: auth.user.id,
          action,
          target,
          severity,
        });
      }
    },
    [auth.profile, auth.user],
  );

  const isAdmin = rbacRole === 'Server Owner' || rbacRole === 'Administrator';

  // Navigate to dashboard when auth state changes to logged in
  useMemo(() => {
    if (authed && page === 'login') {
      setPage('dashboard');
    }
    if (!authed && !auth.loading && page !== 'login') {
      setPage('login');
    }
  }, [authed, auth.loading, page]);

  const value: AppState = {
    page,
    navigate,
    authed,
    loading: auth.loading,
    login,
    logout,
    isAdmin,
    rbacRole,
    secondaryRole,
    recoveryMode,
    setRbacRole: (role: RbacRole) => {
      logAudit('Role switched', `Role set to ${role}`, 'info');
    },
    currentHandle: auth.profile?.handle ?? 'Member',
    auditLogs,
    logAudit,
    profileId,
    setProfileId,
    profile: auth.profile,
    user: auth.user,
    refreshProfile: auth.refreshProfile,
    supabaseSignIn: auth.signIn,
    supabaseSignUp: auth.signUp,
    supabaseSignOut: auth.signOut,
    supabaseResetPassword: auth.resetPassword,
    supabaseUpdatePassword: auth.updatePassword,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
