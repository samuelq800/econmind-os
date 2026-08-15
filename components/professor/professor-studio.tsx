"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  FlaskConical,
  GraduationCap,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  Megaphone,
  Save,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PROFESSOR_PROJECT_TYPES,
  professorProjectTemplates,
  projectWorkspacePath,
  type ProfessorProjectType,
} from "@/lib/professor-studio/catalog";
import {
  listMyProfessorProjects,
  requestProfessorProjectOfficialReview,
  saveProfessorProject,
  type ProfessorProject,
  type ProfessorProjectScope,
} from "@/lib/supabase/professor-studio";
import { listPublicLeagueSchools, type PublicLeagueSchool } from "@/lib/supabase/league-directory";

const projectIcon = {
  mechanism_arena: Landmark,
  evidence_lab: FlaskConical,
  econbench: BookOpenCheck,
  model_assignment: Sparkles,
} as const;

const statusLabel: Record<ProfessorProject["status"], string> = {
  draft: "Draft",
  published: "Live",
  closed: "Closed",
  archived: "Archived",
};

export function ProfessorStudio() {
  const { user, role, roleLoading, openAuth } = useAuth();
  const [projects, setProjects] = useState<ProfessorProject[]>([]);
  const [schools, setSchools] = useState<PublicLeagueSchool[]>([]);
  const [projectType, setProjectType] = useState<ProfessorProjectType>("mechanism_arena");
  const [sourceKey, setSourceKey] = useState(() => professorProjectTemplates("mechanism_arena")[0]?.key ?? "");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [brief, setBrief] = useState("");
  const [scope, setScope] = useState<ProfessorProjectScope>("open");
  const [schoolIds, setSchoolIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const templates = useMemo(() => professorProjectTemplates(projectType), [projectType]);
  const selectedTemplate = templates.find((template) => template.key === sourceKey) ?? templates[0];

  useEffect(() => {
    if (!user || role !== "professor") {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let active = true;
    void Promise.all([listMyProfessorProjects(), listPublicLeagueSchools().catch(() => [])])
      .then(([nextProjects, nextSchools]) => {
        if (!active) return;
        setProjects(nextProjects);
        setSchools(nextSchools);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load Professor Studio.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, role]);

  function selectType(nextType: ProfessorProjectType) {
    setProjectType(nextType);
    setSourceKey(professorProjectTemplates(nextType)[0]?.key ?? "");
    setTitle("");
    setSummary("");
    setBrief("");
    setSchoolIds([]);
    setScope("open");
  }

  function toggleSchool(schoolId: string) {
    setSchoolIds((current) => current.includes(schoolId)
      ? current.filter((id) => id !== schoolId)
      : [...current, schoolId]);
  }

  async function save(status: "draft" | "published") {
    if (!user || role !== "professor") return openAuth("sign-in");
    if (!title.trim() || !summary.trim() || !brief.trim() || !sourceKey) {
      setError("Choose a reviewed source and complete the title, summary, and project brief.");
      return;
    }
    if (scope === "invited" && schoolIds.length === 0) {
      setError("Select at least one school for an invitation-only project.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const project = await saveProfessorProject({
        projectType,
        title: title.trim(),
        summary: summary.trim(),
        brief: brief.trim(),
        sourceKey,
        participationScope: scope,
        status,
        configuration: {
          schema_version: 1,
          source_type: projectType,
          source_title: selectedTemplate?.title ?? sourceKey,
          evidence_upload: false,
          scoring_mode: projectType === "model_assignment" ? "correctness_only" : "reviewed_source",
        },
        audiences: schoolIds.map((targetId) => ({ audienceType: "school", targetId })),
      });
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      setMessage(status === "published" ? "Project is live. Its official ranking status remains separate." : "Professor project saved as a draft.");
      setTitle("");
      setSummary("");
      setBrief("");
      setSchoolIds([]);
      setScope("open");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this Professor project.");
    } finally {
      setBusy(false);
    }
  }

  async function requestOfficialReview(projectId: string) {
    setBusy(true);
    setError("");
    try {
      await requestProfessorProjectOfficialReview(projectId);
      setProjects((current) => current.map((project) => project.id === projectId
        ? { ...project, official_review_status: "pending" }
        : project));
      setMessage("Official Challenge review requested. The project can continue as a normal cross-school activity while review is pending.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request official review.");
    } finally {
      setBusy(false);
    }
  }

  if (roleLoading) return <main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></main>;
  if (!user) return <AccessGate title="Professor Studio requires sign-in" detail="Professor is a platform-wide academic role. It is not tied to a school, Team, or World Simulation office." action={() => openAuth("sign-in")} />;
  if (role !== "professor") return <AccessGate title="Professor access required" detail="A platform administrator assigns Professor independently of League school membership. The role creates and manages academic projects, not school or World Simulation authority." />;

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
      <header className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(115deg,var(--surface)_0%,var(--surface)_62%,var(--accent-soft)_100%)] p-6 shadow-[var(--shadow)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"><GraduationCap size={12} /> Independent academic role</Badge>
            <h1 className="mt-4 text-4xl font-bold tracking-[-.06em] sm:text-5xl">Professor Studio</h1>
            <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">Design cross-school economic learning projects from reviewed EconMind sources. You can launch an activity, invite schools, review work in your project, or request Official Challenge status—without receiving school, Team, country, or World Simulation control.</p>
            <Link href="/professor/projects" className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">Browse published Professor projects <ArrowRight size={13} /></Link>
          </div>
          <div className="grid min-w-48 gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-xs">
            <span className="font-bold text-[var(--accent)]">Your authority</span>
            <span className="text-[var(--ink-muted)]">Academic projects · feedback · project analytics</span>
            <span className="border-t border-[var(--line)] pt-2 text-[var(--ink-muted)]">No school administration · no World controls</span>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Metric label="Projects" value={projects.length} detail="Across drafts and live activities" />
        <Metric label="Live now" value={projects.filter((project) => project.status === "published").length} detail="Open or invitation-only" />
        <Metric label="Official review" value={projects.filter((project) => project.official_review_status === "pending").length} detail="Awaiting platform decision" />
      </section>

      <section className="mt-10 grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Project composer</p><h2 className="mt-2 text-2xl font-bold tracking-[-.04em]">Start from a reviewed learning source.</h2></div>
            <Badge>{selectedTemplate?.detail ?? "Choose a source"}</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {PROFESSOR_PROJECT_TYPES.map((type) => {
              const Icon = projectIcon[type.key];
              const selected = projectType === type.key;
              return <button key={type.key} type="button" onClick={() => selectType(type.key)} className={`rounded-xl border p-5 text-left transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)]"}`}><span className={`grid size-9 place-items-center rounded-lg ${selected ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-subtle)] text-[var(--accent)]"}`}><Icon size={17} /></span><h3 className="mt-4 text-sm font-bold">{type.label}</h3><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{type.description}</p></button>;
            })}
          </div>

          <Card className="mt-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-[var(--accent)]">{PROFESSOR_PROJECT_TYPES.find((type) => type.key === projectType)?.action}</p><h3 className="mt-1 text-xl font-bold">Project brief</h3></div><Link href={selectedTemplate ? projectWorkspacePath(projectType, selectedTemplate.key) : "#"} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">Preview source <ArrowRight size={13} /></Link></div>
            <div className="mt-6 grid gap-5"><Field label="Reviewed source"><select value={sourceKey} onChange={(event) => setSourceKey(event.target.value)}>{templates.map((template) => <option key={template.key} value={template.key}>{template.title}</option>)}</select><span className="mt-1 block text-[10px] font-normal text-[var(--ink-muted)]">{selectedTemplate?.detail}</span></Field>
              <Field label="Project title"><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder={selectedTemplate ? `${selectedTemplate.title}: seminar` : "Name the learning project"} /></Field>
              <Field label="Short invitation summary"><textarea value={summary} maxLength={600} rows={2} onChange={(event) => setSummary(event.target.value)} placeholder="What will participants investigate, decide, or explain?" /></Field>
              <Field label="Professor brief"><textarea value={brief} maxLength={6000} rows={6} onChange={(event) => setBrief(event.target.value)} placeholder="State the learning objective, what is fixed, the expected evidence or reasoning, and how participants should work." /></Field>
            </div>
          </Card>

          <Card className="mt-5 p-5 sm:p-6"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 text-[var(--accent)]" size={18} /><div><h3 className="text-sm font-bold">Participation</h3><p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">Open projects are visible to all registered EconMind users. Invitation-only projects remain visible only to selected schools. A Professor does not gain school membership by inviting a school.</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><Choice label="Open to all registered users" checked={scope === "open"} onChange={() => setScope("open")} /><Choice label="Invite selected schools" checked={scope === "invited"} onChange={() => setScope("invited")} /></div>{scope === "invited" && <div className="mt-5 max-h-64 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3"><p className="px-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">Approved League schools</p><div className="mt-2 grid gap-1 sm:grid-cols-2">{schools.map((school) => <label key={school.school_id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-[var(--surface)]"><input type="checkbox" checked={schoolIds.includes(school.school_id)} onChange={() => toggleSchool(school.school_id)} className="accent-[var(--accent)]" /><span>{school.school_name}</span></label>)}{schools.length === 0 && <p className="px-2 py-4 text-xs text-[var(--ink-muted)]">The school directory is unavailable until Supabase is configured.</p>}</div></div>}</Card>

          {projectType === "evidence_lab" && <div className="mt-5 flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4 text-xs leading-5 text-[var(--ink-muted)]"><LockKeyhole className="mt-0.5 shrink-0 text-[var(--accent)]" size={15} />Evidence Lab remains fixed-source in this version. Professors can create a research brief and feedback workflow, but participants cannot upload raw data.</div>}
          {error && <p role="alert" className="mt-5 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}
          {message && <p className="mt-5 rounded-xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]">{message}</p>}
          <div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy || loading} onClick={() => void save("draft")}><Save size={14} />Save draft</Button><Button disabled={busy || loading} onClick={() => void save("published")}>{busy ? <LoaderCircle className="animate-spin" size={14} /> : <Megaphone size={14} />}Launch project</Button></div>
        </div>

        <aside className="space-y-5"><Card className="p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">Official boundary</p><h2 className="mt-2 text-lg font-bold">A live project is not automatically an Official Challenge.</h2><p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">Official status is reserved for cross-school ranking, platform badges, or other league-wide consequences. You can request it after launch; a platform administrator makes the final decision.</p></Card><Card className="p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">Your projects</p>{loading ? <div className="grid min-h-32 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" size={18} /></div> : <div className="mt-4 space-y-3">{projects.map((project) => { const Icon = projectIcon[project.project_type]; return <div key={project.id} className="rounded-lg border border-[var(--line)] p-3"><div className="flex items-start justify-between gap-2"><span className="grid size-7 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={14} /></span><Badge>{statusLabel[project.status]}</Badge></div><p className="mt-3 text-sm font-bold">{project.title}</p><p className="mt-1 text-[11px] leading-4 text-[var(--ink-muted)]">{project.participation_scope === "open" ? "Open registration" : "Selected school invitations"} · {project.official_review_status.replaceAll("_", " ")}</p><div className="mt-3 flex flex-wrap gap-2"><Link href={projectWorkspacePath(project.project_type, project.source_key)} className="text-[11px] font-bold text-[var(--accent)]">Open source</Link>{project.official_review_status === "not_requested" && <button type="button" disabled={busy} onClick={() => void requestOfficialReview(project.id)} className="text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]">Request official review</button>}{project.official_review_status === "approved" && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)]"><BadgeCheck size={13} />Official</span>}</div></div>; })}{projects.length === 0 && <p className="rounded-lg border border-dashed border-[var(--line)] p-5 text-center text-xs leading-5 text-[var(--ink-muted)]">Your drafts and launched projects will appear here.</p>}</div>}</Card></aside>
      </section>
    </main>
  );
}

function AccessGate({ title, detail, action }: { title: string; detail: string; action?: () => void }) {
  return <main className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-5 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><GraduationCap size={22} /></span><h1 className="mt-5 text-3xl font-bold tracking-[-.05em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{detail}</p>{action && <Button className="mt-6" onClick={action}>Sign in</Button>}</div></main>;
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">{label}</p><p className="mt-2 text-3xl font-bold tracking-[-.05em]">{value}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">{detail}</p></Card>;
}

function Choice({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs ${checked ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--canvas)]"}`}><input type="radio" checked={checked} onChange={onChange} className="mt-0.5 accent-[var(--accent)]" /><span className="font-bold">{label}</span></label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold">{label}<span className="mt-2 block [&>input]:h-10 [&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-[var(--line-strong)] [&>input]:bg-[var(--canvas)] [&>input]:px-3 [&>select]:h-10 [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-[var(--line-strong)] [&>select]:bg-[var(--canvas)] [&>select]:px-3 [&>textarea]:w-full [&>textarea]:rounded-lg [&>textarea]:border [&>textarea]:border-[var(--line-strong)] [&>textarea]:bg-[var(--canvas)] [&>textarea]:p-3 [&>textarea]:font-normal">{children}</span></label>;
}
