"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/experiments/types";

export type AuthMode = "sign-in" | "sign-up";

type AuthContextValue = {
  user: User | null;
  role: AppRole;
  roleLoading: boolean;
  loading: boolean;
  configured: boolean;
  authOpen: boolean;
  authMode: AuthMode;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole>("guest");
  const [roleLoading, setRoleLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) { setRole("guest"); setRoleLoading(false); }
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) { queueMicrotask(() => { setRole("guest"); setRoleLoading(false); }); return; }
    let active = true;
    queueMicrotask(() => { if (active) setRoleLoading(true); });
    void supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (!active) return;
      setRole(data?.role === "teacher" ? "teacher" : "student");
      setRoleLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      roleLoading,
      loading,
      configured,
      authOpen,
      authMode,
      openAuth: (mode = "sign-in") => {
        setAuthMode(mode);
        setAuthOpen(true);
      },
      closeAuth: () => setAuthOpen(false),
      signOut: async () => {
        const supabase = getSupabaseBrowserClient();
        if (supabase) await supabase.auth.signOut();
      },
    }),
    [user, role, roleLoading, loading, configured, authOpen, authMode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
