"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  ACKNOWLEDGEMENT_DOCUMENTS,
  allPoliciesChecked,
  emptyPolicyChecks,
  type ConfirmationState,
  type PolicyConfirmationCoordinator,
} from "@/lib/legal/acknowledgement";
import { usePolicyAcknowledgement } from "./policy-acknowledgement-provider";

export function LegalConsentGate() {
  const pathname = usePathname() ?? "/";
  const { user, authOpen, signOut } = useAuth();
  const { state, coordinator } = usePolicyAcknowledgement();
  const userId = user?.id ?? null;
  const readingPolicy =
    pathname === "/legal" ||
    pathname.startsWith("/legal/") ||
    ["/terms", "/privacy", "/community-guidelines", "/integrity"].includes(
      pathname.replace(/\/$/, ""),
    );
  const visible =
    !authOpen &&
    !readingPolicy &&
    state.userId === userId &&
    !!userId &&
    (state.status === "required" || state.status === "error");
  if (!visible || !userId) return null;
  return <PolicyConfirmationDialog key={userId} userId={userId} state={state} coordinator={coordinator} signOut={signOut} />;
}

export function PolicyConfirmationDialog({userId,state,coordinator,signOut}: {
  userId: string;
  state: ConfirmationState;
  coordinator: PolicyConfirmationCoordinator;
  signOut: () => Promise<void>;
}) {
  const [checks, setChecks] = useState(emptyPolicyChecks);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ) ?? []),
      ].filter((element) => element.getClientRects().length);
      const first = elements[0],
        last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/65 p-3 backdrop-blur-md sm:p-6">
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-consent-title"
        aria-describedby="legal-consent-description"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] shadow-2xl outline-none sm:max-h-[calc(100dvh-48px)]"
      >
        <header className="border-b border-[var(--line)] px-5 py-5 sm:px-8">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">
            <ShieldCheck size={16} />
            Policy update · 21 October 2026
          </p>
          <h2
            id="legal-consent-title"
            className="mt-3 text-2xl font-bold tracking-[-.035em] sm:text-3xl"
          >
            Review once. Continue with clarity.
          </h2>
          <p
            id="legal-consent-description"
            className="mt-3 text-sm leading-6 text-[var(--ink-muted)]"
          >
            Open and review each document, then confirm below. This is saved to
            your account, not just this browser.
          </p>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8">
          {state.status === "error" ? (
            <div
              role="alert"
              className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-5 text-sm leading-6"
            >
              <p>{state.error}</p>
              <Button className="mt-4" onClick={() => coordinator.retry()}>
                Retry verification
              </Button>
            </div>
          ) : (
            <>
              {(["platform", "world"] as const).map((scope) => (
                <fieldset
                  key={scope}
                  disabled={state.saving}
                  className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4 sm:p-5"
                >
                  <legend className="px-2 text-xs font-extrabold uppercase tracking-[.13em] text-[var(--accent)]">
                    {scope === "world"
                      ? "EconMind World · edition 2026-10-21"
                      : "EconMind Platform · version 2.0"}
                  </legend>
                  {ACKNOWLEDGEMENT_DOCUMENTS.filter(
                    (document) => document.scope === scope,
                  ).map((document) => (
                    <label
                      key={document.key}
                      className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-3 text-sm leading-6"
                    >
                      <input
                        type="checkbox"
                        required
                        checked={checks[document.key] === true}
                        onChange={(event) =>
                          setChecks((current) => ({
                            ...current,
                            [document.key]: event.target.checked,
                          }))
                        }
                        className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span>
                        {document.action === "agree"
                          ? "I have read and agree to comply with the "
                          : "I have read and acknowledge the "}
                        <Link
                          href={document.route}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[var(--accent)] underline underline-offset-4"
                        >
                          {document.scope === "world" &&
                          document.key !== "world/about"
                            ? "World "
                            : ""}
                          {document.title} ↗
                        </Link>
                        .
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
              <p className="border-l-2 border-[var(--accent)] pl-3 text-xs leading-5 text-[var(--ink-muted)]">
                Platform and World documents retain their separate stated
                scopes. World rules apply to World participation; this
                confirmation does not enrol you, join a team, grant permissions
                or provide guardian authorisation. Acknowledging privacy
                information is not blanket consent to optional data uses.
              </p>
              {state.error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-[var(--red-soft)] p-3 text-sm text-[var(--red)]"
                >
                  {state.error}
                </p>
              )}
            </>
          )}
        </div>
        <footer className="border-t border-[var(--line)] px-5 py-4 sm:px-8">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
            <span>
              {Object.values(checks).filter(Boolean).length} / 8 confirmed
            </span>
            <Link
              href="/legal/"
              target="_blank"
              className="font-bold text-[var(--accent)]"
            >
              Read all policies ↗
            </Link>
          </div>
          <Button
            className="w-full"
            disabled={
              state.status !== "required" ||
              state.saving ||
              !allPoliciesChecked(checks)
            }
            onClick={async () => {
              if (await coordinator.accept(checks)) {
                window.dispatchEvent(
                  new Event("econmind:legal-consent-updated"),
                );
                try {
                  window.localStorage.setItem(
                    `econmind.policy-confirmation.${userId}`,
                    String(Date.now()),
                  );
                } catch {
                  /* Server receipt remains authoritative when browser storage is unavailable. */
                }
              }
            }}
          >
            {state.saving ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Confirm and continue
          </Button>
          <button
            type="button"
            disabled={state.saving}
            className="mt-3 w-full text-xs text-[var(--ink-muted)] underline underline-offset-4"
            onClick={() => void signOut()}
          >
            Not ready to agree? Sign out
          </button>
        </footer>
      </section>
    </div>
  );
}
