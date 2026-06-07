import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';

export type StyldProfile = {
  id: string;
  email: string;
  full_name: string | null;
  business_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: StyldProfile | null;
  isReady: boolean;
  isNewSignUp: boolean;
  clearNewSignUp: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: {
    full_name?: string | null;
    business_name?: string | null;
  }) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function profileFromUser(user: User): StyldProfile {
  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;

  return {
    id: user.id,
    email: user.email ?? '',
    full_name: fullName,
    business_name: null,
    avatar_url: null,
    created_at: user.created_at,
    updated_at: new Date().toISOString(),
  };
}

async function fetchProfile(user: User): Promise<StyldProfile> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, business_name, avatar_url, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load profile', error.message);
      return profileFromUser(user);
    }

    if (data) {
      return data;
    }

    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email ?? '',
      full_name: profileFromUser(user).full_name,
    });

    if (insertError && insertError.code !== '23505') {
      console.warn('Failed to create profile', insertError.message);
    }

    const { data: created, error: reloadError } = await supabase
      .from('profiles')
      .select('id, email, full_name, business_name, avatar_url, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (reloadError) {
      console.warn('Failed to reload profile', reloadError.message);
      return profileFromUser(user);
    }

    return created ?? profileFromUser(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown profile error';
    console.warn('Failed to load profile', message);
    return profileFromUser(user);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StyldProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isNewSignUp, setIsNewSignUp] = useState(false);

  const refreshProfile = async () => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    const nextProfile = await fetchProfile(session.user);
    setProfile(nextProfile);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    fetchProfile(session.user).then(setProfile);
  }, [session?.user.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const clearNewSignUp = () => setIsNewSignUp(false);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (!error) setIsNewSignUp(true);
    return { error: error?.message ?? null };
  };

  const signInWithApple = async (): Promise<{ error: string | null }> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { error: 'Apple sign-in failed. No identity token received.' };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) return { error: error.message };

      // Detect new user: created_at within last 10 seconds
      if (data.user) {
        const createdMs = new Date(data.user.created_at).getTime();
        if (Date.now() - createdMs < 10_000) {
          // Patch full name from Apple if provided
          const givenName = credential.fullName?.givenName ?? '';
          const familyName = credential.fullName?.familyName ?? '';
          const fullName = [givenName, familyName].filter(Boolean).join(' ');
          if (fullName) {
            await supabase.auth.updateUser({ data: { full_name: fullName } });
          }
          setIsNewSignUp(true);
        }
      }

      return { error: null };
    } catch (e: unknown) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return { error: null }; // user cancelled — not an error
      }
      const msg = e instanceof Error ? e.message : 'Apple sign-in failed.';
      return { error: msg };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const updateProfile = async (patch: {
    full_name?: string | null;
    business_name?: string | null;
  }) => {
    if (!session?.user.id) {
      return { error: 'Not signed in.' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);

    if (error) {
      return { error: error.message };
    }

    await refreshProfile();
    return { error: null };
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isReady,
      isNewSignUp,
      clearNewSignUp,
      signIn,
      signUp,
      signInWithApple,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [session, profile, isReady, isNewSignUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
