"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Heart, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { isFavorite, markModelComplete, markModelVisited, setFavorite, type ModelKey } from "@/lib/supabase/data";

export function FavoriteModelButton({ modelKey }: { modelKey: ModelKey }) {
  const { user, openAuth } = useAuth();
  const [favorite, setFavoriteState] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState<"favorite" | "complete" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setFavoriteState(false);
        setCompleted(false);
      });
      return;
    }
    let active = true;
    const visitKey = `econmind:visited:${user.id}:${modelKey}`;
    const shouldRecordVisit = !window.sessionStorage.getItem(visitKey);
    void isFavorite(user.id, modelKey)
      .then((value) => { if (active) setFavoriteState(value); })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Cloud sync failed.");
      });
    if (shouldRecordVisit) {
      void markModelVisited(modelKey)
        .then(() => { if (active) window.sessionStorage.setItem(visitKey, "1"); })
        .catch((caught) => {
          if (active) setError(caught instanceof Error ? caught.message : "Could not update recent activity.");
        });
    }
    return () => {
      active = false;
    };
  }, [user, modelKey]);

  async function toggleFavorite() {
    if (!user) {
      openAuth("sign-in");
      return;
    }
    const next = !favorite;
    setBusy("favorite");
    setError("");
    try {
      await setFavorite(user.id, modelKey, next);
      setFavoriteState(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update favorite.");
    } finally {
      setBusy(null);
    }
  }

  async function complete() {
    if (!user) {
      openAuth("sign-in");
      return;
    }
    setBusy("complete");
    setError("");
    try {
      await markModelComplete(modelKey);
      setCompleted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update progress.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex max-w-sm flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button type="button" disabled={Boolean(busy)} onClick={() => void toggleFavorite()} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${favorite ? "border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]" : "border-[var(--line)] bg-[var(--canvas)] text-[var(--ink-muted)]"}`}>
          {busy === "favorite" ? <LoaderCircle className="animate-spin" size={14} /> : <Heart size={14} fill={favorite ? "currentColor" : "none"} />}
          {favorite ? "Favorited" : user ? "Add favorite" : "Sign in to favorite"}
        </button>
        <button type="button" disabled={Boolean(busy) || completed} onClick={() => void complete()} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${completed ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--canvas)] text-[var(--ink-muted)]"}`}>
          {busy === "complete" ? <LoaderCircle className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
          {completed ? "Completed" : user ? "Mark complete" : "Sign in to track"}
        </button>
      </div>
      {error && <span className="text-[10px] text-[var(--red)]">{error}</span>}
    </div>
  );
}
