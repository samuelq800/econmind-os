"use client";

import { useEffect, useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { isFavorite, markModelVisited, setFavorite, type ModelKey } from "@/lib/supabase/data";

export function FavoriteModelButton({ modelKey }: { modelKey: ModelKey }) {
  const { user, openAuth } = useAuth();
  const [favorite, setFavoriteState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => setFavoriteState(false));
      return;
    }
    let active = true;
    void Promise.all([
      isFavorite(user.id, modelKey),
      markModelVisited(user.id, modelKey),
    ])
      .then(([value]) => {
        if (active) setFavoriteState(value);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Cloud sync failed.");
      });
    return () => {
      active = false;
    };
  }, [user, modelKey]);

  async function toggle() {
    if (!user) {
      openAuth("sign-in");
      return;
    }
    const next = !favorite;
    setBusy(true);
    setError("");
    try {
      await setFavorite(user.id, modelKey, next);
      setFavoriteState(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update favorite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${favorite ? "border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]" : "border-[var(--line)] bg-[var(--canvas)] text-[var(--ink-muted)]"}`}
      >
        {busy ? <LoaderCircle className="animate-spin" size={14} /> : <Heart size={14} fill={favorite ? "currentColor" : "none"} />}
        {favorite ? "Favorited" : user ? "Add favorite" : "Sign in to favorite"}
      </button>
      {error && <span className="max-w-64 text-[10px] text-[var(--red)]">{error}</span>}
    </div>
  );
}
