"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { missingProfileMetadata, profileMetadataFallback } from "@/lib/supabase/google-sign-in";
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
  profileError: string | null;
  retryProfile: () => void;
  loading: boolean;
  configured: boolean;
  authOpen: boolean;
  authMode: AuthMode;
  authNotice: string | null;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  signOut: () => Promise<void>;
  startViewerSession: (code: string) => Promise<void>;
  endViewerSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const currentAuthUserId = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole>("guest");
  const [platformRole, setPlatformRole] = useState<LeaguePlatformRole | null>(null);
  const worldSupervisor = platformRole === "platform_admin";
  const [viewerAccess, setViewerAccess] = useState<ViewerInvitationAccess | null>(null);

  const [viewerLoading, setViewerLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetry, setProfileRetry] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authNotice, setAuthNotice] = useState<string | null>(null);
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
      if (nextUser && nextUser.id !== currentAuthUserId.current) setRoleLoading(true);
      currentAuthUserId.current = nextUser?.id ?? null;
      setUser(nextUser);
      const currentUrl = new URL(window.location.href);
      const authMarker = currentUrl.searchParams.get("auth");
      const fragment = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
      if (event === "PASSWORD_RECOVERY" || (nextUser && authMarker === "recovery")) {
        setAuthMode("reset-password");
        setAuthOpen(true);
      }
      const googleCallbackFailed = currentUrl.searchParams.has("error") || currentUrl.searchParams.has("error_code") || fragment.has("error") || fragment.has("error_code");
      const googleCallbackPending = currentUrl.searchParams.has("code") || fragment.has("access_token");
      if (authMarker === "google") {
        if (googleCallbackFailed || (!nextUser && !googleCallbackPending)) {
          setAuthNotice("Google sign-in was not completed. Please try again or use email and password.");
          setAuthMode("sign-in");
          setAuthOpen(true);
        } else if (nextUser) {
          setAuthNotice(null);
          setAuthOpen(false);
        }
      }
      if (authMarker === "recovery" || authMarker === "confirmed" || (authMarker === "google" && (googleCallbackFailed || nextUser || !googleCallbackPending))) {
        currentUrl.searchParams.delete("auth");
        if (authMarker === "google") {
          for (const key of ["code", "error", "error_code", "error_description"]) currentUrl.searchParams.delete(key);
          if (fragment.has("access_token") || fragment.has("error") || fragment.has("error_code")) currentUrl.hash = "";
        }
        window.history.replaceState({}, "", currentUrl.toString());
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
    if (!supabase || !user) { queueMicrotask(() => { setRole("guest"); setPlatformRole(null); setProfileError(null); setRoleLoading(false); }); return; }
    let active = true;

    const refreshRole = () => {
      queueMicrotask(() => { if (active) { setRoleLoading(true); setProfileError(null); } });
      void Promise.resolve(supabase.from("profiles").select("role,platform_role,account_status,display_name,avatar_url").eq("user_id", user.id).maybeSingle()).then(async ({ data, error }) => {
        if (error) throw error;
        // Handles accounts created before a profile trigger was installed. The
        // insert is allowed only for the authenticated user's own UUID by RLS.
        if (!data) {
          const fallback = profileMetadataFallback(user.user_metadata);
          const created = await supabase.from("profiles").insert({ user_id: user.id, display_name: fallback.displayName, avatar_url: fallback.avatarUrl }).select("role,platform_role,account_status,display_name,avatar_url").maybeSingle();
          if (created.error) throw created.error;
          data = created.data;
        }
        if (!active) return;
        if (data?.account_status === "suspended") {
          await supabase.auth.signOut({ scope: "local" });
          if (active) { setRole("guest"); setPlatformRole(null); setRoleLoading(false); }
          return;
        }
        if (!data) throw new Error("Account profile is unavailable.");
        const missing = missingProfileMetadata(data, user.user_metadata);
        if (missing.displayName) {
          const query = supabase.from("profiles").update({ display_name: missing.displayName }).eq("user_id", user.id);
          const { error: updateError } = await (data.display_name === null ? query.is("display_name", null) : query.eq("display_name", data.display_name));
          if (updateError) console.warn("Optional profile name could not be initialized.");
        }
        if (missing.avatarUrl) {
          const query = supabase.from("profiles").update({ avatar_url: missing.avatarUrl }).eq("user_id", user.id);
          const { error: updateError } = await (data.avatar_url === null ? query.is("avatar_url", null) : query.eq("avatar_url", data.avatar_url));
          if (updateError) console.warn("Optional profile avatar could not be initialized.");
        }
        if (!active) return;
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
        if (active) { setRole("guest"); setPlatformRole(null); setProfileError("Could not verify your account profile. Please retry."); setRoleLoading(false); }
      });
    };

    // Access is checked when the account session changes. Window focus and
    // visibility events must not refresh or replace an in-progress workspace.
    refreshRole();
    return () => { active = false; };
  }, [user, profileRetry]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      platformRole,
      worldSupervisor,
      viewerAccess,

      viewerLoading,
      roleLoading,
      profileError,
      retryProfile: () => setProfileRetry((attempt) => attempt + 1),
      loading,
      configured,
      authOpen,
      authMode,
      authNotice,
      openAuth: (mode = "sign-in") => {
        setAuthNotice(null);
        setAuthMode(mode);
        setAuthOpen(true);
      },
      closeAuth: () => { setAuthNotice(null); setAuthOpen(false); },
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
    [user, role, platformRole, worldSupervisor, viewerAccess, viewerLoading, roleLoading, profileError, loading, configured, authOpen, authMode, authNotice],
  );


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
