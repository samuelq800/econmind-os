"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/experiments/types";
import type { LeaguePlatformRole } from "@/lib/league/types";
import {
  clearSavedViewerInvitationCode,

  readSavedViewerInvitationCode,
  saveViewerInvitationCode,
  type ViewerInvitationAccess,
  validateViewerInvitationCode,
} from "@/lib/supabase/viewer-invitations";

export type AuthMode = "sign-in" | "sign-up" | "verify-sign-up" | "forgot-password" | "verify-recovery" | "reset-password" | "invitation";

type AuthContextValue = {
  user: User | null;
  role: AppRole;
  platformRole: LeaguePlatformRole | null;
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
  const [platformRole, setPlatformRole] = useState<LeaguePlatformRole | null>(null);
  const worldSupervisor = platformRole === "platform_admin";
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
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      const authMarker = new URLSearchParams(window.location.search).get("auth");
      if (event === "PASSWORD_RECOVERY" || (nextUser && authMarker === "recovery")) {
        setAuthMode("reset-password");
        setAuthOpen(true);
      }
      if (authMarker === "recovery" || authMarker === "confirmed") {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("auth");
        window.history.replaceState({}, "", cleanUrl.toString());
      }
      if (!nextUser) { setRole("guest"); setPlatformRole(null); setRoleLoading(false); }
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
    if (!supabase || !user) { queueMicrotask(() => { setRole("guest"); setPlatformRole(null); setRoleLoading(false); }); return; }
    let active = true;

    const refreshRole = () => {
      queueMicrotask(() => { if (active) setRoleLoading(true); });
      void Promise.resolve(supabase.from("profiles").select("role,platform_role,account_status").eq("user_id", user.id).maybeSingle()).then(async ({ data, error }) => {
        if (error) throw error;
        // Handles accounts created before a profile trigger was installed. The
        // insert is allowed only for the authenticated user's own UUID by RLS.
        if (!data) {
          const displayName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name.slice(0, 80) : null;
          const created = await supabase.from("profiles").insert({ user_id: user.id, display_name: displayName }).select("role,platform_role,account_status").maybeSingle();
          if (created.error) throw created.error;
          data = created.data;
        }
        if (!active) return;
        if (data?.account_status === "suspended") {
          await supabase.auth.signOut({ scope: "local" });
          if (active) { setRole("guest"); setPlatformRole(null); setRoleLoading(false); }
          return;
        }
        setRole(
          data?.role === "teacher" || data?.role === "professor"
            ? data.role
            : "student",
        );
        const nextPlatformRole = data?.platform_role;
        setPlatformRole(
          nextPlatformRole === "team_member" ||
            nextPlatformRole === "school_leader" ||
            nextPlatformRole === "platform_admin"
            ? nextPlatformRole
            : "user",
        );
        setRoleLoading(false);
      }).catch(() => {
        if (active) { setRole("student"); setPlatformRole(null); setRoleLoading(false); }
      });
    };

    // Access is checked when the account session changes. Window focus and
    // visibility events must not refresh or replace an in-progress workspace.
    refreshRole();
    return () => { active = false; };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      platformRole,
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
    [user, role, platformRole, worldSupervisor, viewerAccess, viewerLoading, roleLoading, loading, configured, authOpen, authMode],
  );


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
