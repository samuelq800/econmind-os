"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, BookOpenCheck, FlaskConical, Landmark, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PROFESSOR_PROJECT_TYPES, projectWorkspacePath, type ProfessorProjectType } from "@/lib/professor-studio/catalog";
import { listAccessibleProfessorProjects, type ProfessorProject } from "@/lib/supabase/professor-studio";

const projectIcon = {
  mechanism_arena: Landmark,
  evidence_lab: FlaskConical,
  econbench: BookOpenCheck,
  model_assignment: Sparkles,
} as const;

const typeLabel = Object.fromEntries(
  PROFESSOR_PROJECT_TYPES.map((type) => [type.key, type.label]),
) as Record<ProfessorProjectType, string>;

export function ProfessorProjectDirectory() {
  const { user, roleLoading, openAuth } = useAuth();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProfessorProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedId = searchParams.get("project");
  const selected = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? projects[0],
    [projects, selectedId],
  );

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let active = true;
    void listAccessibleProfessorProjects()
      .then((rows) => { if (active) setProjects(rows); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load Professor projects."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  if (roleLoading) return <main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></main>;
  if (!user) return <main className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-5 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><LockKeyhole size={21} /></span><h1 className="mt-5 text-3xl font-bold tracking-[-.05em]">Sign in to view Professor projects</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Projects are open to registered EconMind users or to the school communities chosen by their Professor.</p><Button className="mt-6" onClick={() => openAuth("sign-in")}>Sign in</Button></div></main>;

  return <main className="mx-auto min-h-screen max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--line)] pb-8"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Independent academic projects</p><h1 className="mt-3 text-4xl font-bold tracking-[-.06em] sm:text-5xl">Professor Projects</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">Join published learning projects from EconMind Professors. Each project uses a reviewed learning source; the project brief explains the objective, participation format, and evidence boundary before you enter.</p></div><Link href="/professor" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] px-4 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)]">Professor Studio <ArrowRight size={14} /></Link></header>

    {error && <p role="alert" className="mt-6 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}
    {loading ? <div className="grid min-h-80 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"><div className="space-y-3">{projects.map((project) => { const Icon = projectIcon[project.project_type]; const current = selected?.id === project.id; return <Link key={project.id} href={`/professor/projects?project=${project.id}`} className={`block rounded-xl border p-5 transition-colors ${current ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--accent)]"><Icon size={17} /></span><div className="flex gap-2"><Badge>{typeLabel[project.project_type]}</Badge>{project.official_review_status === "approved" && <Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"><BadgeCheck size={11} />Official</Badge>}</div></div><h2 className="mt-4 text-lg font-bold">{project.title}</h2><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{project.summary}</p><p className="mt-4 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">{project.participation_scope === "open" ? "Open to registered users" : "Available to your invited school"}</p></Link>; })}{projects.length === 0 && <Card className="p-10 text-center"><LockKeyhole className="mx-auto text-[var(--ink-faint)]" size={20} /><h2 className="mt-4 text-lg font-bold">No accessible projects yet</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Published open projects and projects that invite your school will appear here.</p></Card>}</div>
      <aside>{selected ? <Card className="sticky top-24 p-6"><div className="flex items-center justify-between gap-3"><Badge>{typeLabel[selected.project_type]}</Badge>{selected.official_review_status === "approved" && <Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"><BadgeCheck size={11} />Official Challenge</Badge>}</div><h2 className="mt-5 text-2xl font-bold tracking-[-.04em]">{selected.title}</h2><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{selected.summary}</p><div className="mt-6 border-y border-[var(--line)] py-5"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--accent)]">Professor brief</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">{selected.brief}</p></div><p className="mt-5 text-xs leading-5 text-[var(--ink-muted)]">This project opens a reviewed source. Keep the Professor brief visible as your working agreement; Evidence Lab projects do not accept raw data uploads in this version.</p><Link href={projectWorkspacePath(selected.project_type, selected.source_key)} className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-white">Open learning source <ArrowRight size={14} /></Link></Card> : <Card className="p-6 text-sm text-[var(--ink-muted)]">Choose a project to read its brief.</Card>}</aside>
    </section>}
  </main>;
}
