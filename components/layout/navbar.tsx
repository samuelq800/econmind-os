"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cloud, LogIn, LogOut, Menu, Moon, Sun, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useTheme } from "./theme-provider";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/models", label: "Models" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/experiments", label: "Experiments" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const path = usePathname();
  const { theme, toggleTheme, ready } = useTheme();
  const { user, loading, openAuth, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const links = user
    ? [...publicLinks, { href: "/dashboard", label: "Dashboard" }]
    : publicLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--canvas)_88%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--ink)] text-sm font-black text-[var(--surface)]">E</span>
          <span className="text-sm font-extrabold">EconMind OS</span>
          <span className="hidden rounded border border-[var(--line)] px-1.5 py-.5 text-[9px] font-bold uppercase tracking-widest text-[var(--ink-faint)] sm:inline">Beta</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = link.href === "/" ? path === "/" : path.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-[var(--surface-strong)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <button
            aria-label="Toggle color theme"
            onClick={toggleTheme}
            className="grid size-9 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)]"
          >
            {ready && theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="relative hidden sm:block">
            {user ? (
              <button
                type="button"
                onClick={() => setAccountOpen((current) => !current)}
                className="flex h-9 max-w-48 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><UserRound size={12} /></span>
                <span className="truncate">{user.email}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => openAuth("sign-in")}
                className="flex h-9 items-center gap-2 rounded-lg bg-[var(--ink)] px-3 text-xs font-bold text-[var(--surface)] disabled:opacity-50"
              >
                <LogIn size={14} /> {loading ? "Loading" : "Sign in"}
              </button>
            )}
            {user && accountOpen && (
              <div className="absolute right-0 top-11 w-64 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl">
                <div className="border-b border-[var(--line)] px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Signed in</p>
                  <p className="mt-1 truncate text-xs font-semibold">{user.email}</p>
                </div>
                <Link href="/dashboard" onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface-subtle)]">
                  <Cloud size={14} /> Economist Workspace
                </Link>
                <Link href="/library" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface-subtle)]">
                  <Cloud size={14} /> My cloud library
                </Link>
                <button
                  type="button"
                  onClick={() => { setAccountOpen(false); void signOut(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[var(--red)] hover:bg-[var(--red-soft)]"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>

          <button
            aria-label="Toggle navigation"
            onClick={() => setOpen((current) => !current)}
            className="grid size-9 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] md:hidden"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-[var(--line)] bg-[var(--surface)] p-3 md:hidden">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm font-semibold text-[var(--ink-muted)]">
              {link.label}
            </Link>
          ))}
          {user ? (
            <button type="button" onClick={() => { setOpen(false); void signOut(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[var(--red)]">
              <LogOut size={15} /> Sign out
            </button>
          ) : (
            <button type="button" onClick={() => { setOpen(false); openAuth("sign-in"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[var(--accent)]">
              <LogIn size={15} /> Sign in
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
