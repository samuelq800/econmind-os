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
      reducedMotion ? 650 : 3300,
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
      <section className={styles.sequenceDialog}>
        <div className={styles.tinyFlightStage} aria-hidden="true">
          <span className={styles.engineGlow} />
          <svg
            className={styles.tinyRocket}
            viewBox="0 0 72 112"
            role="presentation"
          >
            <path
              className={styles.tinyRocketShell}
              d="M36 5C24 18 19 34 19 55v27l-9 14 14-5 4 13h16l4-13 14 5-9-14V55C53 34 48 18 36 5Z"
            />
            <path className={styles.tinyRocketDetail} d="M20 58h32M28 84h16" />
            <circle className={styles.tinyRocketWindow} cx="36" cy="38" r="5" />
            <path className={styles.tinyRocketPlume} d="M31 104l5 6 5-6" />
          </svg>
        </div>
        <p className={styles.sequenceEyebrow}>Deletion confirmed</p>
        <h2>Account deleted</h2>
        <p className={styles.sequenceCopy}>
          Your identity boundary is sealed. The secure session is closing now.
        </p>
        <div className={styles.sequenceStatus} aria-hidden="true">
          <span />
          SECURE SESSION // CLOSING
        </div>
      </section>

      <div className={styles.shutdownCurtain} aria-hidden="true">
        <span
          className={`${styles.shutdownPanel} ${styles.shutdownPanelLeft}`}
        />
        <span
          className={`${styles.shutdownPanel} ${styles.shutdownPanelRight}`}
        />
        <svg
          className={styles.shutdownFlash}
          viewBox="0 0 100 2"
          preserveAspectRatio="none"
          onAnimationEnd={onFinished}
        >
          <path d="M0 1H100" />
        </svg>
      </div>
    </div>
  );
}
