"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/experiments/types";
import {
  clearSavedViewerInvitationCode,
  readSavedViewerInvitationCode,
  saveViewerInvitationCode,
  type ViewerInvitationAccess,
  validateViewerInvitationCode,
} from "@/lib/supabase/viewer-invitations";

export type AuthMode = "sign-in" | "sign-up" | "invitation";

type AuthContextValue = {
  user: User | null;
  role: AppRole;
  worldSupervisor: boolean;
  viewerAccess: ViewerInvitationAccess | null;
  viewerLoading: boolean;
  roleLoading: boolean;
  loading: boolean;
  configured: boolean;
  authOpen: boolean;
  authMode: AuthMode;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  signOut: () => Promise<void>;
  startViewerSession: (code: string) => Promise<void>;
  endViewerSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole>("guest");
  const [worldSupervisor, setWorldSupervisor] = useState(false);
  const [viewerAccess, setViewerAccess] = useState<ViewerInvitationAccess | null>(null);
  const [viewerLoading, setViewerLoading] = useState(true);
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
      if (!session?.user) { setRole("guest"); setWorldSupervisor(false); setRoleLoading(false); }
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const savedCode = readSavedViewerInvitationCode();
    if (!savedCode) {
      queueMicrotask(() => setViewerLoading(false));
      return;
    }
    let active = true;
    void validateViewerInvitationCode(savedCode)
      .then((invitation) => {
        if (!active) return;
        if (invitation) setViewerAccess(invitation);
        else clearSavedViewerInvitationCode();
      })
      .catch(() => clearSavedViewerInvitationCode())
      .finally(() => { if (active) setViewerLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) { queueMicrotask(() => { setRole("guest"); setWorldSupervisor(false); setRoleLoading(false); }); return; }
    let active = true;
    const refreshRole = () => {
      queueMicrotask(() => { if (active) setRoleLoading(true); });
      void supabase.from("profiles").select("role,platform_role").eq("user_id", user.id).maybeSingle().then(async ({ data }) => {
        // Handles accounts created before a profile trigger was installed. The
        // insert is allowed only for the authenticated user's own UUID by RLS.
        if (!data) {
          const displayName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name.slice(0, 80) : null;
          const created = await supabase.from("profiles").insert({ user_id: user.id, display_name: displayName }).select("role,platform_role").maybeSingle();
          data = created.data;
        }
        if (!active) return;
        setRole(data?.role === "teacher" ? "teacher" : "student");
        // School Leaders supervise only the country assigned to their own
        // school Team. World-wide controls are reserved for the platform
        // administrator; the database enforces the same boundary.
        setWorldSupervisor(
          data?.platform_role === "platform_admin",
        );
        setRoleLoading(false);
      }, () => { if (active) { setRole("student"); setWorldSupervisor(false); setRoleLoading(false); } });
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refreshRole(); };
    refreshRole();
    window.addEventListener("focus", refreshRole);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { active = false; window.removeEventListener("focus", refreshRole); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      worldSupervisor,
      viewerAccess,
      viewerLoading,
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
        clearSavedViewerInvitationCode();
        setViewerAccess(null);
      },
      startViewerSession: async (code: string) => {
        const invitation = await validateViewerInvitationCode(code);
        if (!invitation) throw new Error("This invitation code is invalid, expired, or disabled.");
        const supabase = getSupabaseBrowserClient();
        if (supabase) await supabase.auth.signOut();
        saveViewerInvitationCode(code);
        setViewerAccess(invitation);
      },
      endViewerSession: () => {
        clearSavedViewerInvitationCode();
        setViewerAccess(null);
      },
    }),
    [user, role, worldSupervisor, viewerAccess, viewerLoading, roleLoading, loading, configured, authOpen, authMode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
