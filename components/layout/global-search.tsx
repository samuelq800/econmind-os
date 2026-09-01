"use client";

import { ArrowRight, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  searchGlobalIndex,
  type GlobalSearchEntry,
} from "@/lib/platform/search-index";
import styles from "./global-search.module.css";

let searchIndexPromise: Promise<readonly GlobalSearchEntry[]> | null = null;

function loadSearchIndex() {
  searchIndexPromise ??= import("@/lib/platform/search-catalog")
    .then((catalog) => catalog.GLOBAL_SEARCH_INDEX)
    .catch((error) => {
      searchIndexPromise = null;
      throw error;
    });
  return searchIndexPromise;
}

export function GlobalSearch() {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [entries, setEntries] = useState<readonly GlobalSearchEntry[]>([]);
  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const preload = useCallback(() => {
    if (loadState === "loading" || loadState === "ready") return;
    setLoadState("loading");
    void loadSearchIndex()
      .then((index) => {
        setEntries(index);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, [loadState]);

  const results = useMemo(
    () => searchGlobalIndex(entries, query, 10),
    [entries, query],
  );

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const openSearch = useCallback(() => {
    preload();
    setOpen(true);
  }, [preload]);

  const visit = useCallback(
    (entry: GlobalSearchEntry) => {
      closeSearch();
      router.push(entry.href);
    },
    [closeSearch, router],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.key.toLocaleLowerCase("en") !== "k"
      )
        return;

      const activeModal = document.querySelector<HTMLElement>(
        "[aria-modal='true']",
      );
      if (activeModal && activeModal !== dialogRef.current) return;

      event.preventDefault();
      if (open) closeSearch();
      else openSearch();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [closeSearch, open, openSearch]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() =>
      inputRef.current?.focus(),
    );

    document.body.style.overflow = "hidden";

    const handleDialogKeydown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "input:not([disabled]), button:not([disabled]):not([tabindex='-1']), a[href]",
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeydown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleDialogKeydown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [closeSearch, open]);

  useEffect(() => {
    window.addEventListener("popstate", closeSearch);
    return () => window.removeEventListener("popstate", closeSearch);
  }, [closeSearch]);

  useEffect(() => {
    if (!open || !results[activeIndex]) return;
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open, results]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + results.length) % results.length,
      );
    } else if (event.key === "Home" && results.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && results.length > 0) {
      event.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      visit(results[activeIndex]);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Search or go to a feature"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="Control+K Meta+K"
        onClick={openSearch}
        onFocus={preload}
        onPointerEnter={preload}
        className={`${styles.trigger} group flex h-10 shrink-0 items-center rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink-muted)] shadow-sm transition-colors hover:border-[var(--ink-faint)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]`}
      >
        <Search
          size={16}
          className={styles.triggerIcon}
          aria-hidden="true"
        />
        <span className={`${styles.triggerLabel} truncate text-sm font-medium`}>
          Find or go to
        </span>
        <kbd
          aria-hidden="true"
          className={`${styles.triggerShortcut} shrink-0 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-1 font-mono text-[10px] leading-none tracking-wide text-[var(--ink-muted)]`}
        >
          Ctrl K
        </kbd>
      </button>

      {open &&
        createPortal(
          <div
            className={`${styles.overlay} fixed inset-0 z-[100] overflow-y-auto bg-[color-mix(in_srgb,var(--ink)_28%,transparent)] p-4 backdrop-blur-[2px]`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeSearch();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={`${styles.dialog} mx-auto flex w-full max-w-[42rem] flex-col overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] shadow-2xl`}
            >
              <h2 id={titleId} className="sr-only">
                Search EconMind OS
              </h2>
              <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                <Search
                  size={18}
                  className="shrink-0 text-[var(--ink-faint)]"
                  aria-hidden="true"
                />
                <label htmlFor={`${listboxId}-input`} className="sr-only">
                  Find a feature or model
                </label>
                <input
                  ref={inputRef}
                  id={`${listboxId}-input`}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={loadState === "ready" && results.length > 0}
                  aria-controls={
                    loadState === "ready" && results.length > 0
                      ? listboxId
                      : undefined
                  }
                  aria-activedescendant={
                    results[activeIndex]
                      ? `${listboxId}-option-${activeIndex}`
                      : undefined
                  }
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Find or go to"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 min-w-0 flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={closeSearch}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>

              <p className="sr-only" role="status" aria-live="polite">
                {loadState === "loading"
                  ? "Loading search index"
                  : loadState === "error"
                    ? "Search could not be loaded"
                    : loadState === "ready" && results.length === 0
                      ? "No search results"
                      : `${results.length} search results`}
              </p>

              <div className={`${styles.results} scroll-slim min-h-0 flex-[1_1_auto] overflow-y-auto p-2`}>
                {loadState === "loading" && (
                  <div className="grid min-h-32 place-items-center text-sm text-[var(--ink-muted)]">
                    Loading features…
                  </div>
                )}

                {loadState === "error" && (
                  <div className="grid min-h-32 place-items-center gap-3 p-5 text-center">
                    <p className="m-0 text-sm text-[var(--ink-muted)]">
                      Search could not be loaded.
                    </p>
                    <button
                      type="button"
                      onClick={preload}
                      className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-bold text-white"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {loadState === "ready" && results.length === 0 && (
                  <div className="grid min-h-32 place-items-center px-5 text-center text-sm text-[var(--ink-muted)]">
                    No feature matches “{query.trim()}”.
                  </div>
                )}

                {loadState === "ready" && results.length > 0 && (
                  <div
                    id={listboxId}
                    role="listbox"
                    aria-label="Search results"
                    className="grid gap-1"
                  >
                    {results.map((entry, index) => {
                      const selected = index === activeIndex;
                      return (
                        <button
                          key={entry.href}
                          id={`${listboxId}-option-${index}`}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          tabIndex={-1}
                          onMouseMove={() => setActiveIndex(index)}
                          onClick={() => visit(entry)}
                          className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3.5 py-3 text-left transition-colors ${selected ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-subtle)]"}`}
                        >
                          <span className="min-w-0">
                            <span
                              className={`block truncate text-sm font-bold ${selected ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}
                            >
                              {entry.label}
                            </span>
                            {entry.description && (
                              <span className="mt-1 block truncate text-xs text-[var(--ink-muted)]">
                                {entry.description}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="hidden max-w-40 truncate rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-[var(--ink-faint)] sm:block">
                              {entry.group}
                            </span>
                            <ArrowRight
                              size={15}
                              className={
                                selected
                                  ? "text-[var(--accent)]"
                                  : "text-[var(--ink-faint)]"
                              }
                              aria-hidden="true"
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-2 text-[10px] font-semibold text-[var(--ink-muted)]">
                <span>↑↓ Navigate · Enter Open</span>
                <span>Esc Close</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
