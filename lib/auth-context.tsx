import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile, UserRole } from "./types";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (params: { email: string; password: string; fullName: string; role: UserRole }) => Promise<void>;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    setProfile(data);
  };

  // Used on app start and sign-in, where nothing awaits the result. A token refreshed a moment
  // ago can be briefly rejected ("JWT issued at future") while Supabase's servers agree on the
  // time, so retry once before giving up, and never leave the rejection unhandled.
  const loadProfileSafely = async (userId: string) => {
    try {
      await loadProfile(userId);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        await loadProfile(userId);
      } catch (err) {
        console.warn("Couldn't load profile:", err);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
        if (data.session) await loadProfileSafely(data.session.user.id);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        // Supabase docs: don't await Supabase calls inside this callback (it can stall the
        // auth client's token refresh); run them right after it returns instead.
        setTimeout(() => {
          if (isMounted) void loadProfileSafely(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id);
      },
      signUp: async ({ email, password, fullName, role }) => {
        // full_name/role land in auth.users.raw_user_meta_data; a DB trigger creates the
        // profiles row from it server-side, since signUp() has no session to insert with
        // until the user confirms their email (if confirmation is required on this project).
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } },
        });
        if (error) throw error;
        if (!data.user) throw new Error("Sign up did not return a user");

        if (data.session) {
          setSession(data.session);
          await loadProfile(data.user.id);
        }
      },
      signIn: async ({ email, password }) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
