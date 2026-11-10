import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile, UserRole } from "./types";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  // True between entering a password-reset code and saving the new password. The code signs
  // the user in, but they aren't done until they've chosen a password, so the app keeps them
  // on the reset screen instead of dropping them into the tabs.
  recoveringPassword: boolean;
  refreshProfile: () => Promise<void>;
  // Resolves to whether the account still needs its email confirmed (a code was emailed).
  signUp: (params: { email: string; password: string; fullName: string; role: UserRole }) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  confirmEmail: (params: { email: string; code: string }) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyPasswordResetCode: (params: { email: string; code: string }) => Promise<void>;
  finishPasswordReset: (newPassword: string) => Promise<void>;
  // Leaving the reset screen without choosing a password: sign back out.
  abandonPasswordReset: () => Promise<void>;
  changePassword: (params: { currentPassword: string; newPassword: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const signedInUserId = useRef<string | null>(null);

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
        signedInUserId.current = data.session?.user.id ?? null;
        if (data.session) await loadProfileSafely(data.session.user.id);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const previousUserId = signedInUserId.current;
      const nextUserId = newSession?.user.id ?? null;
      signedInUserId.current = nextUserId;
      setSession(newSession);

      // Signed out, or a different person signed in on this device: nothing the last user
      // loaded (their tasks, chats, notifications) may be shown to the next one.
      if (previousUserId && previousUserId !== nextUserId) {
        queryClient.clear();
        setProfile(null);
      }

      if (newSession) {
        // Supabase docs: don't await Supabase calls inside this callback (it can stall the
        // auth client's token refresh); run them right after it returns instead.
        setTimeout(() => {
          if (isMounted) void loadProfileSafely(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRecoveringPassword(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      recoveringPassword,
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id);
      },
      signUp: async ({ email, password, fullName, role }) => {
        // full_name/role land in auth.users.raw_user_meta_data; a DB trigger creates the
        // profiles row from it server-side, since signUp() has no session to insert with
        // until the user confirms their email (when confirmation is required).
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role, accepted_terms_at: new Date().toISOString() } },
        });
        if (error) throw error;
        if (!data.user) throw new Error("Sign up did not return a user");
        // With confirmation on, signing up with an address that already has an account
        // "succeeds" with an empty identities list (so the response doesn't reveal who has
        // an account). No email is sent, so say so instead of waiting for a code.
        if (!data.session && data.user.identities?.length === 0) {
          throw new Error("An account with this email already exists. Log in instead.");
        }

        if (data.session) {
          setSession(data.session);
          await loadProfile(data.user.id);
        }
        return { needsEmailConfirmation: !data.session };
      },
      signIn: async ({ email, password }) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        // Whatever the server said, make sure this device is signed out.
        if (error) await supabase.auth.signOut({ scope: "local" });
      },
      confirmEmail: async ({ email, code }) => {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
        if (error) throw error;
      },
      resendConfirmation: async (email) => {
        const { error } = await supabase.auth.resend({ type: "signup", email });
        if (error) throw error;
      },
      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
      },
      verifyPasswordResetCode: async ({ email, code }) => {
        // Set before the code is checked: a correct code signs the user in immediately.
        setRecoveringPassword(true);
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
        if (error) {
          setRecoveringPassword(false);
          throw error;
        }
      },
      finishPasswordReset: async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setRecoveringPassword(false);
      },
      abandonPasswordReset: async () => {
        await supabase.auth.signOut({ scope: "local" });
        setRecoveringPassword(false);
      },
      changePassword: async ({ currentPassword, newPassword }) => {
        const email = session?.user.email;
        if (!email) throw new Error("You're not signed in.");
        // Prove it's really the account owner holding the phone before changing anything.
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
        if (reauthError) throw new Error("Your current password isn't right.");
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      },
    }),
    [session, profile, loading, recoveringPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
