"use client";

import Link from "next/link";
import {
  createContext,
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  LoaderCircle,
  ShieldAlert,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { BASE_PATH } from "@/lib/base-path";
import {
  ACCOUNT_DELETION_BLOCKER_MESSAGES,
  clearDeletedAccountSession,
  deletePersonalAccount,
  getAccountDeletionEligibility,
  type AccountDeletionEligibility,
} from "@/lib/supabase/account-deletion";
import styles from "./account-deletion-provider.module.css";

type DeletionPhase =
  | "closed"
  | "checking"
  | "blocked"
  | "confirming"
  | "deleting"
  | "failed"
  | "animating";

type AccountSnapshot = {
  userId: string;
  email: string;
};

type AccountDeletionContextValue = {
  openAccountDeletion: () => void;
};

const AccountDeletionContext =
  createContext<AccountDeletionContextValue | null>(null);

export function useAccountDeletion() {
  const value = useContext(AccountDeletionContext);
  if (!value) throw new Error("AccountDeletionProvider missing");
  return value;
}

export function AccountDeletionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<DeletionPhase>("closed");
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [eligibility, setEligibility] =
    useState<AccountDeletionEligibility | null>(null);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);
  const eligibilityRequestRef = useRef(0);
  const deletionStartedRef = useRef(false);

  const checkEligibility = useCallback(async () => {
    const requestId = ++eligibilityRequestRef.current;
    setPhase("checking");
    setEligibility(null);
    setError("");
    try {
      const result = await getAccountDeletionEligibility();
      if (eligibilityRequestRef.current !== requestId) return;
      setEligibility(result);
      setPhase(result.eligible ? "confirming" : "blocked");
    } catch (caught) {
      if (eligibilityRequestRef.current !== requestId) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not verify account deletion eligibility.",
      );
      setPhase("failed");
    }
  }, []);

  const openAccountDeletion = useCallback(() => {
    if (!user?.id || !user.email || phase !== "closed") return;
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    deletionStartedRef.current = false;
    setAccount({ userId: user.id, email: user.email });
    void checkEligibility();
  }, [checkEligibility, phase, user]);

  const close = useCallback(() => {
    if (phase === "deleting" || phase === "animating") return;
    eligibilityRequestRef.current += 1;
    setPhase("closed");
    setEligibility(null);
    setError("");
    setAccount(null);
    deletionStartedRef.current = false;
    queueMicrotask(() => triggerRef.current?.focus());
  }, [phase]);

  const confirm = useCallback(
    async (confirmation: string) => {
      if (!account || phase !== "confirming" || deletionStartedRef.current)
        return;
      deletionStartedRef.current = true;
      setPhase("deleting");
      setError("");
      try {
        await deletePersonalAccount(confirmation);
        setPhase("animating");
      } catch (caught) {
        deletionStartedRef.current = false;
        setError(
          caught instanceof Error
            ? caught.message
            : "Account deletion did not complete. No data was changed.",
        );
        setPhase("failed");
      }
    },
    [account, phase],
  );

  const contextValue = useMemo(
    () => ({ openAccountDeletion }),
    [openAccountDeletion],
  );

  return (
    <AccountDeletionContext.Provider value={contextValue}>
      {children}
      {phase !== "closed" && account && (
        <AccountDeletionDialog
          phase={phase}
          account={account}
          eligibility={eligibility}
          error={error}
          onClose={close}
          onRetry={() => void checkEligibility()}
          onConfirm={(confirmation) => void confirm(confirmation)}
        />
      )}
    </AccountDeletionContext.Provider>
  );
}

function AccountDeletionDialog({
  phase,
  account,
  eligibility,
  error,
  onClose,
  onRetry,
  onConfirm,
}: {
  phase: DeletionPhase;
  account: AccountSnapshot;
  eligibility: AccountDeletionEligibility | null;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  onConfirm: (confirmation: string) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const shellRef = useRef<HTMLDivElement>(null);
  const sequenceFinishedRef = useRef(false);
  const canClose =
    phase === "checking" ||
    phase === "blocked" ||
    phase === "confirming" ||
    phase === "failed";
  const expectedConfirmation = `DELETE ${account.email}`;
  const confirmationMatches =
    confirmation.trim().toLowerCase() === expectedConfirmation.toLowerCase();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (phase === "animating") return;
    const shell = shellRef.current;
    if (!shell) return;
    const preferred = shell.querySelector<HTMLElement>("[data-safe-focus]");
    preferred?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && canClose) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        shell.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled])",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canClose, onClose, phase]);

  const finishSequence = useCallback(async () => {
    if (sequenceFinishedRef.current) return;
    sequenceFinishedRef.current = true;
    await clearDeletedAccountSession(account.userId);
    const home = BASE_PATH ? `${BASE_PATH}/` : "/";
    window.location.assign(home);
  }, [account.userId]);

  useEffect(() => {
    if (phase !== "animating") return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const fallback = window.setTimeout(
      () => void finishSequence(),
      reducedMotion ? 450 : 3800,
    );
    return () => window.clearTimeout(fallback);
  }, [finishSequence, phase]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmationMatches) onConfirm(confirmation.trim());
  }

  if (phase === "animating") {
    return <DecommissionSequence onFinished={() => void finishSequence()} />;
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canClose) onClose();
      }}
    >
      <div
        ref={shellRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="account-deletion-title"
        aria-describedby="account-deletion-copy"
      >
        <div className={styles.dialogTopline}>
          <span>ACCOUNT CONTROL // DECOMMISSION</span>
          <span>AUTH-UID LOCKED</span>
        </div>
        {canClose && (
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close account deletion dialog"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        )}

        {phase === "checking" && (
          <section className={styles.statePanel} aria-live="polite">
            <span className={styles.stateIcon}>
              <LoaderCircle className="animate-spin" size={22} />
            </span>
            <p className={styles.eyebrow}>Preflight safety check</p>
            <h2 id="account-deletion-title">Validating the account boundary</h2>
            <p id="account-deletion-copy">
              The server is checking school, team, League, World, and
              shared-content responsibilities. Nothing is being deleted.
            </p>
            <Button data-safe-focus variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </section>
        )}

        {phase === "blocked" && (
          <section className={styles.statePanel}>
            <span className={`${styles.stateIcon} ${styles.warningIcon}`}>
              <ShieldAlert size={22} />
            </span>
            <p className={styles.eyebrow}>Self-service deletion unavailable</p>
            <h2 id="account-deletion-title">Shared records are protected</h2>
            <p id="account-deletion-copy">
              This account is not an unbound personal account. No data was
              changed.
            </p>
            <ul className={styles.blockerList}>
              {(eligibility?.blockers ?? []).map((blocker) => (
                <li key={blocker}>
                  <AlertTriangle size={14} />
                  {ACCOUNT_DELETION_BLOCKER_MESSAGES[blocker]}
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <Button data-safe-focus variant="secondary" onClick={onClose}>
                Keep account
              </Button>
              <Link href="/contact" className={styles.supportLink}>
                Request administrator review
              </Link>
            </div>
          </section>
        )}

        {phase === "confirming" && (
          <form className={styles.statePanel} onSubmit={submit}>
            <span className={`${styles.stateIcon} ${styles.dangerIcon}`}>
              <AlertTriangle size={22} />
            </span>
            <p className={styles.eyebrow}>Final irreversible action</p>
            <h2 id="account-deletion-title">
              Permanently delete this account?
            </h2>
            <p id="account-deletion-copy">
              The server confirmed that this is a standard personal account with
              no organisation membership or shared responsibility.
            </p>
            <div className={styles.impactGrid}>
              <span>
                <Check size={13} /> Supabase Auth identity
              </span>
              <span>
                <Check size={13} /> Personal profile & preferences
              </span>
              <span>
                <Check size={13} /> Private runs & progress
              </span>
              <span>
                <Check size={13} /> Private support correspondence
              </span>
            </div>
            <label className={styles.confirmLabel}>
              Type <strong>{expectedConfirmation}</strong> to confirm
              <input
                data-safe-focus
                autoComplete="off"
                spellCheck={false}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={expectedConfirmation}
              />
            </label>
            <div className={styles.actions}>
              <Button variant="secondary" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                type="submit"
                disabled={!confirmationMatches}
              >
                Delete permanently
              </Button>
            </div>
          </form>
        )}

        {phase === "deleting" && (
          <section className={styles.statePanel} aria-live="assertive">
            <span className={styles.stateIcon}>
              <LoaderCircle className="animate-spin" size={22} />
            </span>
            <p className={styles.eyebrow}>Atomic deletion in progress</p>
            <h2 id="account-deletion-title">Securing the final transaction</h2>
            <p id="account-deletion-copy">
              Do not close this window. The success sequence starts only after
              the database confirms a complete deletion.
            </p>
            <div className={styles.progressTrack}>
              <span />
            </div>
          </section>
        )}

        {phase === "failed" && (
          <section className={styles.statePanel}>
            <span className={`${styles.stateIcon} ${styles.warningIcon}`}>
              <ShieldAlert size={22} />
            </span>
            <p className={styles.eyebrow}>Transaction aborted safely</p>
            <h2 id="account-deletion-title">The account was not deleted</h2>
            <p id="account-deletion-copy">
              {error ||
                "The safety check could not complete. No data was changed."}
            </p>
            <div className={styles.actions}>
              <Button data-safe-focus variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button onClick={onRetry}>Run safety check again</Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DecommissionSequence({ onFinished }: { onFinished: () => void }) {
  return (
    <div
      className={styles.sequence}
      role="status"
      aria-live="polite"
      aria-label="Account deleted. Closing the secure session."
    >
      <div className={styles.telemetryGrid} aria-hidden="true" />
      <div className={styles.sequenceHeader} aria-hidden="true">
        <span>ECONMIND FLIGHT SYSTEMS</span>
        <span>ACCOUNT DECOMMISSION // FINAL</span>
      </div>
      <div className={styles.rocketStage} aria-hidden="true">
        <div className={styles.scanLine} />
        <svg
          className={styles.rocket}
          viewBox="0 0 360 620"
          role="presentation"
        >
          <g
            className={styles.rocketOutline}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          >
            <path d="M180 28 C143 68 126 112 126 177 L126 427 L98 486 L98 528 L145 503 L151 547 L209 547 L215 503 L262 528 L262 486 L234 427 L234 177 C234 112 217 68 180 28Z" />
            <path d="M151 547 L142 579 M170 547 L166 592 M190 547 L194 592 M209 547 L218 579" />
          </g>
          <g
            className={styles.rocketStructure}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          >
            <path d="M137 124 H223 M127 178 H233 M127 287 H233 M127 321 H233 M127 430 H233 M146 503 H214" />
            <ellipse cx="180" cy="205" rx="42" ry="15" />
            <ellipse cx="180" cy="263" rx="42" ry="15" />
            <ellipse cx="180" cy="348" rx="42" ry="15" />
            <ellipse cx="180" cy="410" rx="42" ry="15" />
            <path d="M138 205 V263 M222 205 V263 M138 348 V410 M222 348 V410" />
            <rect x="147" y="137" width="66" height="27" rx="4" />
            <path d="M153 452 L180 494 L207 452 M163 452 L180 477 L197 452" />
            <path d="M180 42 V536" strokeDasharray="5 7" />
          </g>
          <g
            className={styles.rocketCallouts}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          >
            <path d="M210 83 H302" />
            <path d="M214 151 H319" />
            <path d="M222 232 H326" />
            <path d="M222 371 H326" />
            <path d="M207 469 H306" />
            <path d="M150 303 H43" />
            <path d="M145 513 H36" />
          </g>
          <g className={styles.rocketLabels} fill="currentColor">
            <text x="307" y="87">
              PAYLOAD FAIRING
            </text>
            <text x="324" y="155">
              AVIONICS
            </text>
            <text x="331" y="236">
              UPPER STAGE // LOX
            </text>
            <text x="331" y="375">
              CORE STAGE // CH4
            </text>
            <text x="311" y="473">
              ENGINE MANIFOLD
            </text>
            <text x="38" y="307" textAnchor="end">
              INTERSTAGE
            </text>
            <text x="31" y="517" textAnchor="end">
              THRUST STRUCTURE
            </text>
          </g>
        </svg>
        <div className={styles.telemetryCopy}>
          <span>IDENTITY PURGE</span>
          <b>COMPLETE</b>
          <span>DATA BOUNDARY</span>
          <b>SEALED</b>
        </div>
      </div>
      <div className={`${styles.hatch} ${styles.leftHatch}`} aria-hidden="true">
        <i />
      </div>
      <div
        className={`${styles.hatch} ${styles.rightHatch}`}
        aria-hidden="true"
      >
        <i />
      </div>
      <div className={styles.crtScene} aria-hidden="true" />
      <div
        className={styles.crtBeam}
        aria-hidden="true"
        onAnimationEnd={onFinished}
      />
    </div>
  );
}
