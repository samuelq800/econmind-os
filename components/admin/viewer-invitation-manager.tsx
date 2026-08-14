"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Eye, KeyRound, LoaderCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ViewerInvitation } from "@/lib/supabase/viewer-invitations";
import { createViewerInvitationCode, listViewerInvitationCodes, setViewerInvitationActive } from "@/lib/supabase/viewer-invitations";

export function ViewerInvitationManager() {
  const { user, worldSupervisor, roleLoading, openAuth } = useAuth();
  const [invitations, setInvitations] = useState<ViewerInvitation[]>([]);
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canManage = Boolean(user && worldSupervisor);

  const load = useCallback(async () => {
    if (!user || !worldSupervisor) return;
    setLoading(true);
    try {
      setInvitations(await listViewerInvitationCodes());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load viewer invitations.");
    } finally {
      setLoading(false);
    }
  }, [user, worldSupervisor]);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    void listViewerInvitationCodes()
      .then((rows) => { if (active) setInvitations(rows); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load viewer invitations."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canManage]);

  async function createInvitation() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await createViewerInvitationCode({ label, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null });
      setIssuedCode(created.invitationCode);
      setLabel("");
      setExpiresAt("");
      setMessage("Invitation code created. Copy it now; it is not stored in readable form.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the viewer invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleInvitation(invitation: ViewerInvitation) {
    setBusy(true);
    setError("");
    try {
      await setViewerInvitationActive(invitation.id, !invitation.isActive);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the viewer invitation.");
    } finally {
      setBusy(false);
    }
  }

  if (!user && !roleLoading) return <AccessGate title="Administrator sign-in required" detail="Sign in with your platform administrator account to manage read-only viewing invitations." action={() => openAuth("sign-in")} />;
  if (roleLoading || (canManage && loading)) return <main className="grid min-h-[65vh] place-items-center"><span className="inline-flex items-center gap-2 text-sm text-[var(--ink-muted)]"><LoaderCircle className="animate-spin text-[var(--accent)]" size={16} /> Checking invitation access…</span></main>;
  if (!worldSupervisor) return <AccessGate title="Platform administrator access required" detail="Viewer invitation codes can only be created or disabled by a platform administrator." />;

  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8 lg:px-12"><header className="max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Access control</p><h1 className="mt-3 text-4xl font-bold tracking-[-.055em] sm:text-5xl">Viewing invitations</h1><p className="mt-4 text-sm leading-7 text-[var(--ink-muted)]">Invitation holders can open every EconMind page in view-only mode. They are not given an account, school, team, saved work, or permission to make database changes.</p></header><div className="mt-9 grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><Card className="p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><KeyRound size={18} /></span><div><h2 className="font-bold">Create invitation</h2><p className="mt-1 text-xs text-[var(--ink-muted)]">A secure code is shown once after creation.</p></div></div><label className="mt-6 block text-xs font-bold">Label <span className="font-normal text-[var(--ink-faint)]">(optional)</span><input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} placeholder="e.g. Open Day visitors" className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" /></label><label className="mt-4 block text-xs font-bold">Expiry <span className="font-normal text-[var(--ink-faint)]">(optional)</span><input value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" /></label><Button className="mt-5 w-full" disabled={busy} onClick={() => void createInvitation()}>{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Eye size={15} />}Create view-only code</Button>{issuedCode && <div className="mt-5 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--accent)]">Copy now</p><code className="mt-2 block select-all break-all text-base font-bold tracking-[.08em] text-[var(--ink)]">{issuedCode}</code><Button size="sm" variant="secondary" className="mt-3" onClick={() => void navigator.clipboard.writeText(issuedCode)}><Copy size={13} /> Copy code</Button></div>}</Card><Card className="p-0"><div className="border-b border-[var(--line)] p-6"><h2 className="font-bold">Issued invitations</h2><p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">Disabling a code also removes viewing access the next time that browser opens or refreshes EconMind.</p></div>{invitations.length ? <ol className="divide-y divide-[var(--line)]">{invitations.map((invitation) => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="text-sm font-bold">{invitation.label ?? "Untitled viewing invitation"}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">Created {new Date(invitation.createdAt).toLocaleDateString()} · {invitation.expiresAt ? `Expires ${new Date(invitation.expiresAt).toLocaleString()}` : "No expiry"}</p></div><Button size="sm" variant={invitation.isActive ? "secondary" : "ghost"} disabled={busy} onClick={() => void toggleInvitation(invitation)}>{invitation.isActive ? "Disable" : "Enable"}</Button></li>)}</ol> : <div className="p-8 text-sm text-[var(--ink-muted)]">No viewing invitations have been created yet.</div>}</Card></div>{error && <p role="alert" className="mt-6 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}{message && <p className="mt-6 flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]"><CheckCircle2 size={16} />{message}</p>}</main>;
}

function AccessGate({ title, detail, action }: { title: string; detail: string; action?: () => void }) {
  return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center"><div><ShieldAlert className="mx-auto text-[var(--accent)]" size={24} /><h1 className="mt-5 text-3xl font-bold tracking-[-.045em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{detail}</p>{action && <Button className="mt-6" onClick={action}>Sign in</Button>}</div></main>;
}
