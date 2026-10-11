"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getGroupRegistrationPolicy,
  setGroupRegistrationPolicy,
  type GroupRegistrationPolicy,
} from "@/lib/supabase/group-registration";

/** Rendered only inside the administrator gate; both RPCs also enforce it. */
export function GroupRegistrationPolicyPanel() {
  const [policy, setPolicy] = useState<GroupRegistrationPolicy | null>(null);
  const [code, setCode] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void getGroupRegistrationPolicy()
      .then((value) => {
        if (active) {
          setPolicy(value);
          if (value.expires_at) {
            const date = new Date(value.expires_at);
            setExpiry(
              new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
                .toISOString()
                .slice(0, 16),
            );
          }
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Group registration controls are unavailable. Check that the group registration migration has been deployed.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(enabled: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await setGroupRegistrationPolicy(
        code.trim() || null,
        enabled,
        enabled && expiry ? new Date(expiry).toISOString() : null,
      );
      setPolicy(await getGroupRegistrationPolicy());
      setCode("");
      setMessage(
        enabled
          ? "Shared group registration enabled. Distribute the code within your group."
          : "Group registration stopped. Existing accounts remain active.",
      );
    } catch {
      setError(
        "Could not update group registration. Check the code, expiry and administrator permissions.",
      );
    } finally {
      setBusy(false);
    }
  }

  const expired = policy?.enabled && !policy.is_open;
  return (
    <Card className="mt-8 p-6">
      <h2 className="text-lg font-bold">Shared group registration</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
        Group members can use one reusable registration code to activate
        individual accounts without an email code. Google sign-in, email
        verification, password recovery and viewing invitations remain
        available.
      </p>
      <p className="mt-3 text-xs font-bold">
        Status:{" "}
        {policy
          ? policy.enabled && !expired
            ? "Open"
            : expired
              ? "Expired"
              : "Closed"
          : "Unavailable"}
        {policy?.expires_at &&
          ` · Expires ${new Date(policy.expires_at).toLocaleString()}`}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-bold">
          Shared code{" "}
          {policy?.has_code && (
            <span className="font-normal text-[var(--ink-muted)]">
              (leave blank to keep the current code)
            </span>
          )}
          <input
            type="password"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            minLength={12}
            maxLength={128}
            className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 font-mono text-sm"
          />
        </label>
        <label className="block text-xs font-bold">
          Optional expiry
          <input
            type="datetime-local"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm"
          />
        </label>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
        The code is stored as a hash and cannot be read back. It can be reused
        by multiple group members until you stop, rotate or expire it. Group
        distribution controls who receives it.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          disabled={
            busy || !policy || (!policy.has_code && code.trim().length < 12)
          }
          onClick={() => void save(true)}
        >
          Save and enable shared code
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !policy || !policy.enabled}
          onClick={() => void save(false)}
        >
          Stop group registration
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--red)]">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-[var(--accent)]">
          {message}
        </p>
      )}
    </Card>
  );
}
