import { useState, useEffect } from 'react';
import { supabase } from '@data/supabase/client';
import { Session, User } from '@supabase/supabase-js';

/** Apply auth state from a session + server-verified user (preferred) or cached user on transient errors. */
const applySessionForApp = async (session: Session | null) => {
  if (!session?.user) {
    return { session: null as Session | null, user: null as User | null };
  }

  if (!session.user.email) {
    await supabase.auth.signOut();
    return { session: null, user: null };
  }

  const {
    data: { user: verifiedUser },
    error: verifyError,
  } = await supabase.auth.getUser();

  if (verifyError) {
    // Offline / transient: JWT from storage may omit email_confirmed_at; keep session if email present.
    if (session.user.email) {
      return { session, user: session.user };
    }
    await supabase.auth.signOut();
    return { session: null, user: null };
  }

  if (!verifiedUser?.email) {
    await supabase.auth.signOut();
    return { session: null, user: null };
  }

  if (!verifiedUser.email_confirmed_at) {
    await supabase.auth.signOut();
    return { session: null, user: null };
  }

  return { session, user: verifiedUser };
};

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const sync = async (nextSession: Session | null) => {
      const next = await applySessionForApp(nextSession);
      if (cancelled) return;
      setSession(next.session);
      setUser(next.user);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session: initial } }) => sync(initial));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      sync(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string, options?: { inviteCode?: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: options?.inviteCode ? { referral_code: options.inviteCode.trim() } : undefined,
        emailRedirectTo:
          typeof window !== 'undefined' && window.location?.origin
            ? `${window.location.origin}`
            : undefined,
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    if (error) throw error;
  };

  return {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resendConfirmationEmail,
  };
};
