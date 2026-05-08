import { useState, useEffect } from 'react';
import { supabase } from '@data/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import type { Gender } from '@domain/models/Profile';

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
    const msg = (verifyError.message ?? '').toLowerCase();
    /** Auth user deleted in dashboard / SQL while JWT still in storage — refresh token invalid. */
    const isInvalidSession =
      msg.includes('user not found') ||
      msg.includes('invalid refresh token') ||
      msg.includes('refresh token not found');
    if (isInvalidSession) {
      await supabase.auth.signOut();
      return { session: null, user: null };
    }
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

/**
 * Where Supabase sends the user after clicking the email confirmation link.
 * - Dev: localhost default or EXPO_PUBLIC_AUTH_REDIRECT_URL_DEV.
 * - Prod: EXPO_PUBLIC_AUTH_REDIRECT_URL if set; else on **web** use `window.location.origin` so Netlify/custom
 *   domains match the URL users signed up on (avoid hardcoding www when production is *.netlify.app).
 * - Fallback: canonical site (native / no window at call time).
 */
function getAuthEmailRedirectTo(): string {
  if (process.env.NODE_ENV === 'development') {
    return process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL_DEV?.trim() || 'http://localhost:8081/';
  }
  const fromEnv = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  return 'https://www.amoraea.com/';
}

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

  const signUp = async (
    email: string,
    password: string,
    options?: { inviteCode?: string; age?: number; gender?: Gender }
  ) => {
    const metadata: Record<string, unknown> = {};
    if (options?.inviteCode) metadata.referral_code = options.inviteCode.trim();
    if (typeof options?.age === 'number') metadata.age = options.age;
    if (options?.gender) metadata.gender = options.gender;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: Object.keys(metadata).length ? metadata : undefined,
        emailRedirectTo: getAuthEmailRedirectTo(),
      },
    });
    if (error) throw error;
    /**
     * Duplicate email: Supabase often returns no AuthApiError (enumeration protection) but either
     * `user: null` or a user row with an empty `identities` array — see auth signUp docs / GitHub issues.
     * Only treat **empty array** as duplicate, not missing `identities` (avoid blocking valid signups).
     */
    if (data.user == null) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
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
      options: {
        emailRedirectTo: getAuthEmailRedirectTo(),
      },
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
