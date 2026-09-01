"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ClipboardCheck, Cloud, Eye, Gamepad2, GraduationCap, KeyRound, LoaderCircle, LogIn, LogOut, Menu, Moon, ShieldCheck, Sun, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getDesignatedAccountAccessStatus, setDesignatedAccountAccess } from "@/lib/supabase/account-moderation";
import { availableNavigationSections, isNavigationSectionActive, MOBILE_NAVIGATION_GROUPS } from "@/lib/platform/feature-flags";
import { withBasePath } from "@/lib/base-path";
import { useTheme } from "./theme-provider";

const navigationSections = availableNavigationSections();
const compactDesktopSectionIds = new Set(["home", "about", "explore", "learn", "lab", "simulation", "league"]);
const DESIGNATED_ACCOUNT_MODERATOR_ID = "ffc87a95-f535-4781-9c2d-c2fac962ea9e";

export function Navbar() {
  const path = usePathname() ?? "/";
  const { theme, toggleTheme, ready } = useTheme();
  const { user, role, worldSupervisor, viewerAccess, viewerLoading, loading, openAuth, signOut, endViewerSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [targetSuspended, setTargetSuspended] = useState(false);
  const [moderationMessage, setModerationMessage] = useState("");
  const links = navigationSections;
  const compactDesktopLinks = links.filter((section) => compactDesktopSectionIds.has(section.id));
  const compactOverflowLinks = links.filter((section) => !compactDesktopSectionIds.has(section.id));
  const designatedAccountModerator = user?.id === DESIGNATED_ACCOUNT_MODERATOR_ID && worldSupervisor;

  useEffect(() => {
    if (!moderationOpen) return;
    let active = true;
    void getDesignatedAccountAccessStatus()
      .then((state) => { if (active) setTargetSuspended(state.suspended); })
      .catch((caught) => { if (active) setModerationMessage(caught instanceof Error ? caught.message : "Account access control is unavailable."); })
      .finally(() => { if (active) setModerationLoading(false); });
    return () => { active = false; };
  }, [moderationOpen]);

  const openAccountAccessControl = () => {
    setAccountOpen(false);
    setModerationLoading(true);
    setModerationMessage("");
    setModerationOpen(true);
  };

  const updateTargetAccess = async (suspended: boolean) => {
    if (moderationBusy) return;
    setModerationBusy(true);
    setModerationMessage("");
    try {
      const state = await setDesignatedAccountAccess(suspended);
      setTargetSuspended(state.suspended);
      setModerationMessage(state.suspended ? "Account access is suspended." : "Account access has been restored.");
    } catch (caught) {
      setModerationMessage(caught instanceof Error ? caught.message : "Account access could not be updated.");
    } finally {
      setModerationBusy(false);
    }
  };

  // Live World is an event-only surface. It deliberately has no bridge back
  // into the normal application navigation or account controls.
  if (path === "/live-world" || path.startsWith("/live-world/")) return null;

  return (
    <>
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
            <button type="button" aria-label="Open more navigation" aria-expanded={openSection === "desktop-more"} onClick={() => setOpenSection((current) => current === "desktop-more" ? null : "desktop-more")} className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-semibold leading-5 tracking-normal ${compactOverflowLinks.some((section) => isNavigationSectionActive(section, path)) ? "bg-[var(--surface-strong)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>More <ChevronDown size={13} /></button>
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
                {worldSupervisor && <Link href="/admin/live-world" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"><Gamepad2 size={14} /> Live World rooms</Link>}
                {designatedAccountModerator && <button type="button" onClick={openAccountAccessControl} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#2f6dff] hover:bg-[#e7efff]"><ShieldCheck size={14} /> Account access control</button>}
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
    {moderationOpen && <AccountAccessConsole suspended={targetSuspended} loading={moderationLoading} busy={moderationBusy} message={moderationMessage} onClose={() => setModerationOpen(false)} onChange={updateTargetAccess} />}
    </>
  );
}

function AccountAccessConsole({ suspended, loading, busy, message, onClose, onChange }: { suspended: boolean; loading: boolean; busy: boolean; message: string; onClose: () => void; onChange: (suspended: boolean) => Promise<void> }) {
  const stream = ["01001000 01100001 01110010 01101101 01101111 01101110 01101001 01111010 01100101", "ACCESS::CONTROL  AUTH::VERIFIED  POLICY::REVERSIBLE", "01100001 01100011 01100011 01100101 01110011 01110011 00101101 01101100 01101111 01100011 01101011", "SUPABASE::AUTH  SESSION::REVOKE  AUDIT::WRITE"];
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#020617]/95 p-5 text-blue-100" role="dialog" aria-modal="true" aria-label="Account access control">
    <div className="account-access-code-rain" aria-hidden="true">{Array.from({ length: 11 }, (_, index) => <span key={index} className="account-access-code-stream" style={{ left: `${index * 10 + 2}%`, animationDelay: `${-index * 1.15}s` }}>{stream[index % stream.length]}<br />{stream[(index + 1) % stream.length]}<br />{stream[(index + 2) % stream.length]}</span>)}</div>
    <section className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-blue-400/45 bg-[#06112b]/95 shadow-[0_0_80px_rgba(37,99,235,.32)]">
      <div className="flex items-center justify-between border-b border-blue-300/25 bg-blue-500/10 px-5 py-3 font-mono text-[10px] font-bold tracking-[.2em] text-blue-200"><span>ECONMIND // ACCOUNT ACCESS CONSOLE</span><button type="button" onClick={onClose} className="rounded p-1 text-blue-100 hover:bg-blue-300/15" aria-label="Close account access control"><X size={16} /></button></div>
      <div className="p-6 sm:p-8">
        <p className="font-mono text-[10px] font-bold tracking-[.22em] text-cyan-300">DESIGNATED ACCOUNT · REVERSIBLE CONTROL</p>
        <h2 className="mt-3 text-3xl font-bold tracking-[-.04em] text-white">{loading ? "Checking access state…" : suspended ? "Access suspended" : "Access active"}</h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-blue-100/75">This control affects the designated account only. Every change is recorded and can be reversed here.</p>
        <div className="mt-6 rounded-xl border border-blue-300/25 bg-black/30 p-4 font-mono text-xs leading-6 text-blue-200"><p>&gt; identity: designated account</p><p>&gt; status: {loading ? "QUERYING" : suspended ? "SUSPENDED" : "ACTIVE"}</p><p>&gt; audit trail: ENABLED</p></div>
        {message && <p role="status" className="mt-4 rounded-lg border border-blue-300/25 bg-blue-400/10 px-4 py-3 text-sm text-blue-100">{message}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          {loading ? <span className="inline-flex items-center gap-2 rounded-lg border border-blue-300/30 px-4 py-2.5 text-sm font-semibold text-blue-100"><LoaderCircle className="animate-spin" size={16} /> Checking…</span> : suspended ? <button type="button" disabled={busy} onClick={() => void onChange(false)} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-[#06112b] hover:bg-cyan-200 disabled:opacity-50">{busy ? "Restoring…" : "Restore account access"}</button> : <button type="button" disabled={busy} onClick={() => void onChange(true)} className="rounded-lg border border-blue-300/45 bg-blue-500/20 px-4 py-2.5 text-sm font-bold text-blue-50 hover:bg-blue-500/30 disabled:opacity-50">{busy ? "Suspending…" : "Suspend account access"}</button>}
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-blue-300/25 px-4 py-2.5 text-sm font-semibold text-blue-100 hover:bg-blue-300/10">Close</button>
        </div>
      </div>
    </section>
  </div>;
}
