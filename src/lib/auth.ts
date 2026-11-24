import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { RbacRole } from '@/lib/rbac';

export interface AuthProfile {
  id: string;
  handle: string;
  display_name: string;
  avatar_initials: string;
  accent: string;
  bio: string;
  game: string;
  verified: boolean;
  discord_connected: boolean;
  discord_username: string | null;
  discord_status: string;
  reputation: number;
  created_at: string;
  avatar_url: string | null;
  cover_url: string | null;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  role: RbacRole;
  secondaryRole: RbacRole | null;
  recoveryMode: boolean;
  loading: boolean;
  signUp: (email: string, password: string, handle: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

function deriveRole(user: User | null): RbacRole {
  if (!user) return 'Normal Member';
  const role = user.app_metadata?.role;
  const validRoles: RbacRole[] = [
    'Server Owner', 'Administrator', 'Project Team', 'Junior Administrator',
    'Moderator', 'Support Team', 'Loan Center Management',
    'Loan Officer', 'Normal Member',
  ];
  return (validRoles as string[]).includes(role) ? (role as RbacRole) : 'Normal Member';
}

function deriveSecondaryRole(user: User | null): RbacRole | null {
  if (!user) return null;
  const secRole = user.app_metadata?.secondary_role;
  if (!secRole) return null;
  const validRoles: RbacRole[] = [
    'Server Owner', 'Administrator', 'Project Team', 'Junior Administrator',
    'Moderator', 'Support Team', 'Loan Center Management',
    'Loan Officer', 'Normal Member',
  ];
  return (validRoles as string[]).includes(secRole) ? (secRole as RbacRole) : null;
}

export function useAuthProvider(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.warn('[Auth] Failed to fetch profile:', error.message);
      return null;
    }

    if (!data) {
      // Profile missing — auto-create it from auth metadata
      const authMeta = supabase.auth.getSession();
      const handle = (await authMeta).data.session?.user?.user_metadata?.handle || `member_${uid.slice(0, 8)}`;
      const displayName = (await authMeta).data.session?.user?.user_metadata?.display_name || handle;
      const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: uid,
        handle,
        display_name: displayName,
        avatar_initials: initials,
      });
      if (insertErr) {
        console.warn('[Auth] Auto-profile creation failed:', insertErr.message);
        return null;
      }
      const { data: newData } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      setProfile(newData as AuthProfile | null);
      return newData as AuthProfile | null;
    }

    setProfile(data as AuthProfile | null);
    return data as AuthProfile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    if (window.location.hash.includes('type=recovery')) {
      setRecoveryMode(true);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await fetchProfile(data.session.user.id);
      }
      if (mounted) setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
        if (event === 'SIGNED_IN' && newSession?.user) {
          await supabase.auth.refreshSession();
        }
        if (!mounted) return;
        if (newSession?.user) {
          const { data: refreshed } = await supabase.auth.getSession();
          setSession(refreshed.session ?? newSession);
          await fetchProfile(newSession.user.id);
        } else {
          setSession(null);
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = useCallback(
    async (email: string, password: string, handle: string, displayName: string): Promise<{ error: string | null }> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { handle, display_name: displayName },
        },
      });

      if (error) return { error: error.message };
      if (!data.user) return { error: 'Sign-up failed: no user returned.' };

      // Create profile row
      const initials = displayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        handle,
        display_name: displayName,
        avatar_initials: initials,
      });

      if (profileError) {
        return { error: `Account created but profile setup failed: ${profileError.message}` };
      }

      return { error: null };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === 'invalid_credentials') {
        return { error: 'The email or password you entered is incorrect. If you have forgotten your password, use the "Forgot?" link below to reset it.' };
      }
      if (error.code === 'email_not_confirmed') {
        return { error: 'Your email address has not been confirmed yet. Please check your inbox for a confirmation email.' };
      }
      if (error.code === 'too_many_requests') {
        return { error: 'Too many login attempts. Please wait a few minutes before trying again.' };
      }
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#type=recovery`,
    });
    if (error) {
      if (error.code === 'rate_limit_exceeded' || error.code === 'too_many_requests') {
        return { error: 'Too many recovery requests. Please wait a few minutes before trying again.' };
      }
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    setRecoveryMode(false);
    window.history.replaceState({}, document.title, window.location.pathname);
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  return {
    session,
    user: session?.user ?? null,
    profile,
    role: deriveRole(session?.user ?? null),
    secondaryRole: deriveSecondaryRole(session?.user ?? null),
    recoveryMode,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
  };
}
