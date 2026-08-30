"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ClipboardCheck, Cloud, Eye, GraduationCap, KeyRound, LogIn, LogOut, Menu, Moon, ShieldCheck, Sun, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { availableNavigationSections, isNavigationSectionActive, MOBILE_NAVIGATION_GROUPS } from "@/lib/platform/feature-flags";
import { withBasePath } from "@/lib/base-path";
import { useTheme } from "./theme-provider";

const navigationSections = availableNavigationSections();
const compactDesktopSectionIds = new Set(["home", "about", "explore", "learn", "lab", "simulation", "league"]);

export function Navbar() {
  const path = usePathname() ?? "/";
  const { theme, toggleTheme, ready } = useTheme();
  const { user, role, worldSupervisor, viewerAccess, viewerLoading, loading, openAuth, signOut, endViewerSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const links = navigationSections;
  const compactDesktopLinks = links.filter((section) => compactDesktopSectionIds.has(section.id));
  const compactOverflowLinks = links.filter((section) => !compactDesktopSectionIds.has(section.id));

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--canvas)_88%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1720px] items-center gap-3 px-5 lg:px-8">
        <Link href="/" className="brand-home-link flex shrink-0 items-center gap-3" onClick={() => setOpen(false)} draggable={false}>
          <span className="brand-badge-mini">
            <Image
              src={withBasePath("/brand/econmind-badge-96.png")}
              alt=""
              width={36}
              height={36}
              priority
              draggable={false}
              className="brand-badge-mini-image"
            />
          </span>
          <span className="text-sm font-extrabold">EconMind OS</span>
          <span className="hidden rounded border border-[var(--line)] px-1.5 py-.5 text-[9px] font-bold uppercase tracking-widest text-[var(--ink-faint)] sm:inline">Beta</span>
        </Link>
        <nav className="hidden min-w-0 flex-1 flex-nowrap items-center justify-center gap-0.5 2xl:flex" aria-label="Primary navigation">
          {links.map((section) => {
            const active = isNavigationSectionActive(section, path);
            const hasChildren = section.children.length > 0;
            return (
              <div key={section.id} className="relative shrink-0" onMouseEnter={() => hasChildren && setOpenSection(section.id)} onMouseLeave={() => setOpenSection(null)}>
                <div className={`flex items-center rounded-lg ${active ? "bg-[var(--surface-strong)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                  <Link href={section.href} aria-current={active ? "page" : undefined} className="whitespace-nowrap px-2.5 py-2 text-xs font-semibold 2xl:px-3 2xl:text-sm" onClick={() => setOpenSection(null)}>{section.label}</Link>
                  {hasChildren && <button type="button" aria-label={`Open ${section.label} navigation`} aria-expanded={openSection === section.id} onClick={() => setOpenSection((current) => current === section.id ? null : section.id)} className="-ml-1 grid size-6 place-items-center rounded-md hover:bg-[var(--surface-subtle)]"><ChevronDown size={13} /></button>}
                </div>
                {hasChildren && openSection === section.id && (
                  <div className="absolute left-0 top-full z-50 w-[19rem] pt-2">
                    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl">
                      <p className="px-3 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">{section.description}</p>
                      {section.children.map((item) => {
                        const itemActive = path === item.href || path.startsWith(`${item.href}/`);
                        return <Link key={item.href} href={item.href} onClick={() => setOpenSection(null)} className={`block rounded-lg px-3 py-2.5 ${itemActive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "hover:bg-[var(--surface-subtle)]"}`}>
                          <span className="block text-xs font-bold">{item.label}</span>
                          {item.description && <span className="mt-0.5 block text-[11px] leading-4 text-[var(--ink-muted)]">{item.description}</span>}
                        </Link>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <nav className="relative hidden min-w-0 flex-1 flex-nowrap items-center justify-center gap-0.5 xl:flex 2xl:hidden" aria-label="Primary navigation">
          {compactDesktopLinks.map((section) => {
            const active = isNavigationSectionActive(section, path);
            const hasChildren = section.children.length > 0;
            return (
              <div key={section.id} className="relative shrink-0" onMouseEnter={() => hasChildren && setOpenSection(section.id)} onMouseLeave={() => setOpenSection(null)}>
                <div className={`flex items-center rounded-lg ${active ? "bg-[var(--surface-strong)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                  <Link href={section.href} aria-current={active ? "page" : undefined} className="whitespace-nowrap px-2.5 py-2 text-xs font-semibold" onClick={() => setOpenSection(null)}>{section.label}</Link>
                  {hasChildren && <button type="button" aria-label={`Open ${section.label} navigation`} aria-expanded={openSection === section.id} onClick={() => setOpenSection((current) => current === section.id ? null : section.id)} className="-ml-1 grid size-6 place-items-center rounded-md hover:bg-[var(--surface-subtle)]"><ChevronDown size={13} /></button>}
                </div>
                {hasChildren && openSection === section.id && (
                  <div className="absolute left-0 top-full z-50 w-[19rem] pt-2">
                    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl">
                      <p className="px-3 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">{section.description}</p>
                      {section.children.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpenSection(null)} className="block rounded-lg px-3 py-2.5 hover:bg-[var(--surface-subtle)]"><span className="block text-xs font-bold">{item.label}</span></Link>)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="relative shrink-0" onMouseEnter={() => setOpenSection("desktop-more")} onMouseLeave={() => setOpenSection(null)}>
            <button type="button" aria-label="Open more navigation" aria-expanded={openSection === "desktop-more"} onClick={() => setOpenSection((current) => current === "desktop-more" ? null : "desktop-more")} className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold ${compactOverflowLinks.some((section) => isNavigationSectionActive(section, path)) ? "bg-[var(--surface-strong)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>More <ChevronDown size={13} /></button>
            {openSection === "desktop-more" && (
              <div className="absolute right-0 top-full z-50 w-[18rem] pt-2">
                <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl">
                  {compactOverflowLinks.map((section) => (
                    <div key={section.id} className="border-b border-[var(--line)] py-1 last:border-b-0">
                      <Link href={section.href} onClick={() => setOpenSection(null)} className="block rounded-lg px-3 py-2 text-xs font-extrabold hover:bg-[var(--surface-subtle)]">{section.label}</Link>
                      {section.children.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpenSection(null)} className="block rounded-lg px-5 py-1.5 text-[11px] text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]">{item.label}</Link>)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
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
            ) : viewerAccess ? (
              <button
                type="button"
                onClick={() => setAccountOpen((current) => !current)}
                className="flex h-9 items-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 text-xs font-bold text-[var(--accent)]"
              >
                <Eye size={14} /> View-only
              </button>
            ) : (
              <button
                type="button"
                disabled={loading || viewerLoading}
                onClick={() => openAuth("sign-in")}
                className="flex h-9 items-center gap-2 rounded-lg bg-[var(--ink)] px-3 text-xs font-bold text-[var(--surface)] disabled:opacity-50"
              >
                <LogIn size={14} /> {loading ? "Loading" : "Sign in"}
              </button>
            )}
            {(user || viewerAccess) && accountOpen && (
              <div className="absolute right-0 top-11 w-64 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl">
                <div className="border-b border-[var(--line)] px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{viewerAccess ? "Invitation viewer" : "Signed in"}</p>
                  <p className="mt-1 truncate text-xs font-semibold">{viewerAccess ? viewerAccess.label ?? "Read-only access" : user?.email}</p>
                </div>
                {user && <Link href="/dashboard" onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface-subtle)]">
                  <Cloud size={14} /> Workspace dashboard
                </Link>}
                {user && <Link href="/library" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface-subtle)]">
                  <Cloud size={14} /> My cloud library
                </Link>}
                {user && <Link href="/profile" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface-subtle)]">
                  <UserRound size={14} /> Profile & privacy
                </Link>}
                {role === "professor" && <Link href="/professor" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]">
                  <GraduationCap size={14} /> Professor Studio
                </Link>}
                {role === "teacher" && (
                  <Link href="/admin/daily-brief" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]">
                    <ClipboardCheck size={14} /> Review Daily Brief
                  </Link>
                )}
                {worldSupervisor && <Link href="/admin/viewer-invitations" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"><KeyRound size={14} /> Viewing invitations</Link>}
                {worldSupervisor && <Link href="/admin/governance" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"><ShieldCheck size={14} /> Governance requests</Link>}
                <button
                  type="button"
                  onClick={() => { setAccountOpen(false); if (viewerAccess) endViewerSession(); else void signOut(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[var(--red)] hover:bg-[var(--red-soft)]"
                >
                  <LogOut size={14} /> {viewerAccess ? "Leave viewing mode" : "Sign out"}
                </button>
              </div>
            )}
          </div>

          <button
            aria-label="Toggle navigation"
            onClick={() => setOpen((current) => !current)}
            className="grid size-9 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] xl:hidden"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="fixed inset-x-0 bottom-0 top-16 overflow-y-auto border-t border-[var(--line)] bg-[var(--canvas)] p-5 shadow-2xl xl:hidden" aria-label="Full navigation">
          <div className="mx-auto max-w-xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--ink-faint)]">Navigate EconMind</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {links.map((section) => (
                <Link key={section.id} href={section.href} onClick={() => setOpen(false)} aria-current={isNavigationSectionActive(section, path) ? "page" : undefined} className={`rounded-xl border px-4 py-3 text-sm font-bold ${isNavigationSectionActive(section, path) ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface)]"}`}>
                  {section.label}
                </Link>
              ))}
            </div>
            <div className="mt-8 grid gap-6">
              {MOBILE_NAVIGATION_GROUPS.filter(
                (group) => group.items.length > 0 && links.some((section) => section.label === group.label),
              ).map((group) => (
                <section key={group.label}>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--ink-faint)]">{group.label}</p>
                  {group.items.length > 0 && <div className="mt-2 grid grid-cols-2 gap-1">
                    {group.items.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-sm font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]">{item.label}</Link>)}
                  </div>}
                </section>
              ))}
            </div>
          {role === "teacher" && (
            <Link href="/admin/daily-brief" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[var(--accent)]">
              <ClipboardCheck size={15} /> Review Daily Brief
            </Link>
          )}
          {role === "professor" && (
            <Link href="/professor" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[var(--accent)]">
              <GraduationCap size={15} /> Professor Studio
            </Link>
          )}
          {user ? (
            <button type="button" onClick={() => { setOpen(false); void signOut(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[var(--red)]">
              <LogOut size={15} /> Sign out
            </button>
          ) : viewerAccess ? (
            <button type="button" onClick={() => { setOpen(false); endViewerSession(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[var(--red)]">
              <LogOut size={15} /> Leave viewing mode
            </button>
          ) : (
            <button type="button" onClick={() => { setOpen(false); openAuth("sign-in"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[var(--accent)]">
              <LogIn size={15} /> Sign in
            </button>
          )}
          </div>
        </nav>
      )}
    </header>
  );
}
