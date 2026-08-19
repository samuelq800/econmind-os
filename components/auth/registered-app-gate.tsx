"use client";

import { LockKeyhole, LoaderCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { hasRequiredPageRole, pageAccessForPath } from "@/lib/platform/access-control";

/**

 * Applies the central frontend page policy to direct URLs as well as ordinary
 * navigation. Backend authorization remains a separate enforcement layer.
 */
export function RegisteredAppGate({ children }: { children: React.ReactNode }) {
  const {
    user,
    role,
    platformRole,
    loading,
    configured,
    openAuth,
    viewerAccess,
    viewerLoading,
    roleLoading,
  } = useAuth();
  const pathname = usePathname();
  const policy = pageAccessForPath(pathname);

  if (policy.audience === "public") return <>{children}</>;

  const checksRole = Boolean(policy.appRoles || policy.platformRoles);
  if (loading || viewerLoading || (user && checksRole && roleLoading)) {
    return (

      <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-5" aria-live="polite">
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--ink-muted)]">
          <LoaderCircle className="animate-spin text-[var(--accent)]" size={18} />
          Checking your secure session…
        </div>
      </main>
    );
  }

  const accountRequired = policy.audience === "account";
  if (!user && (!viewerAccess || accountRequired)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-5 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-sm sm:p-10">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <LockKeyhole size={22} />
          </span>
          <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Individual access required</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl">
            {accountRequired ? "Sign in with an individual account." : "Create an account or enter with an invitation."}
          </h1>
          <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
            {accountRequired
              ? "This page contains personal work or authoring tools and is not available in view-only mode."
              : "An individual account enables saved work. An invitation code unlocks view-only access without creating an account or joining a school."}
          </p>
          {!configured ? (

            <p className="mt-6 rounded-lg bg-[var(--red-soft)] p-3 text-sm text-[var(--red)]">
              Account access is not configured for this deployment yet.
            </p>
          ) : (
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={() => openAuth("sign-up")}>Create individual account</Button>
              <Button variant="secondary" onClick={() => openAuth("sign-in")}>Sign in</Button>
              {!accountRequired && <Button variant="ghost" onClick={() => openAuth("invitation")}>Enter invitation code</Button>}
            </div>

          )}
        </section>
      </main>
    );
  }

  if (!hasRequiredPageRole(policy, role, platformRole)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-5 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-sm sm:p-10">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <LockKeyhole size={22} />
          </span>
          <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Access restricted</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl">Your account does not have access to this page.</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">Use an account with the required platform or academic role.</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}


