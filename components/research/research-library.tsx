"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlignLeft, ArrowRight, Award, BadgeCheck, BookOpen, CheckCircle2, FileText, LoaderCircle, LockKeyhole, Search, Send, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ResearchPaper, ResearchPaperStatus, ResearchPaperSubmission, ResearchVisibility } from "@/lib/research/types";
import { extractPdfIntoWebPages, type WebReaderPage } from "@/lib/research/pdf-text";
import { attachResearchPdf, createResearchPaper, getResearchPaper, getResearchPdfUrl, listFeaturedResearch, listMyResearch, listPublishedResearch, listResearchForAdmin, reviewResearchPaper, updateResearchPaper, updateResearchPaperAsAdmin, uploadResearchPdf } from "@/lib/supabase/research-library";
import { getLeagueContext } from "@/lib/supabase/league";

const blankSubmission: ResearchPaperSubmission = {
  title: "", author_display_name: "", school_display_name: "", subject: "", competition_text: null,
  competition_year: null, award_text: null, abstract: null, keywords: null, description: null,
  coauthors_text: null, visibility: "public",
};

const statusLabel: Record<ResearchPaperStatus, string> = {
  draft: "Draft", pending_review: "Pending review", published: "Published", revision_requested: "Revision requested", rejected: "Rejected",
};

function readableDate(value: string | null) {
  if (!value) return "Not published";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function optional(value: string | null | undefined) { return value ?? ""; }

function paperToSubmission(paper: ResearchPaper): ResearchPaperSubmission {
  return {
    title: paper.title, author_display_name: paper.author_display_name, school_display_name: paper.school_display_name,
    subject: paper.subject, competition_text: paper.competition_text, competition_year: paper.competition_year,
    award_text: paper.award_text, abstract: paper.abstract, keywords: paper.keywords, description: paper.description,
    coauthors_text: paper.coauthors_text, visibility: paper.visibility,
  };
}

export function StatusBadge({ status }: { status: ResearchPaperStatus }) {
  const tones: Record<ResearchPaperStatus, string> = {
    draft: "bg-[var(--surface-subtle)] text-[var(--ink-muted)]",
    pending_review: "bg-amber-100 text-amber-900 dark:bg-amber-950/45 dark:text-amber-200",
    published: "bg-[var(--accent-soft)] text-[var(--accent)]",
    revision_requested: "bg-orange-100 text-orange-900 dark:bg-orange-950/45 dark:text-orange-200",
    rejected: "bg-[var(--red-soft)] text-[var(--red)]",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] ${tones[status]}`}>{statusLabel[status]}</span>;
}

export function PaperCard({ paper, featured = false }: { paper: ResearchPaper; featured?: boolean }) {
  return <article className={`group flex h-full flex-col rounded-xl border bg-[var(--surface)] p-5 shadow-[var(--shadow)] transition-colors hover:border-[var(--accent)] ${featured ? "border-[var(--accent)]" : "border-[var(--line)]"}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-wrap gap-2"><Badge>{paper.subject}</Badge>{featured && <Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"><Award size={11} /> Featured</Badge>}</div>
      {paper.award_verified && <span title="Award verified by EconMind" className="text-[var(--accent)]"><BadgeCheck size={17} /></span>}
    </div>
    <h2 className="mt-5 text-xl font-bold leading-7 tracking-[-.035em]">{paper.title}</h2>
    <p className="mt-3 text-sm font-semibold">{paper.author_display_name}</p>
    <p className="mt-1 text-xs text-[var(--ink-muted)]">{paper.school_display_name}</p>
    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-[var(--ink-muted)]">
      {paper.competition_text && <span>{paper.competition_text}</span>}
      {paper.award_text && <span className="text-[var(--accent)]">{paper.award_text}{paper.award_verified ? " · Verified" : ""}</span>}
    </div>
    {paper.abstract && <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--ink-muted)]">{paper.abstract}</p>}
    <Link href={`/learn/research/paper?paper=${encodeURIComponent(paper.id)}`} className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-[var(--accent)]">View Paper <ArrowRight size={14} /></Link>
  </article>;
}

function PdfWebReader({ pdfUrl, title }: { pdfUrl: string; title: string }) {
  const [pages, setPages] = useState<WebReaderPage[] | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState("");

  const openWebReader = async () => {
    setError("");
    setProgress({ completed: 0, total: 0 });
    try {
      const extracted = await extractPdfIntoWebPages(pdfUrl, (completed, total) => setProgress({ completed, total }));
      setPages(extracted);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This PDF could not be converted into web text.");
    } finally {
      setProgress(null);
    }
  };

  if (pages) return <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4"><div><p className="text-sm font-bold">Web Reader</p><p className="mt-1 text-xs text-[var(--ink-muted)]">Text extracted locally from the submitted PDF.</p></div><Button size="sm" variant="secondary" onClick={() => setPages(null)}>PDF view</Button></div><article className="mx-auto max-w-3xl space-y-10 px-5 py-8 sm:px-10"><h3 className="text-2xl font-bold tracking-[-.035em]">{title}</h3>{pages.map((page) => <section key={page.number} aria-label={`Page ${page.number}`}><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">Page {page.number}</p>{page.paragraphs.length ? <div className="mt-4 space-y-4 text-[15px] leading-8 text-[var(--ink-muted)]">{page.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> : <p className="mt-3 text-sm italic text-[var(--ink-faint)]">No selectable text was found on this page.</p>}</section>)}</article></div>;

  return <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center"><AlignLeft className="mx-auto text-[var(--accent)]" size={22} /><h3 className="mt-4 text-lg font-bold">Read as web text</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--ink-muted)]">Convert this PDF into a clean, scrollable reading view. The original PDF remains unchanged.</p><Button className="mt-5" onClick={() => void openWebReader()} disabled={Boolean(progress)}>{progress ? <LoaderCircle className="animate-spin" size={15} /> : <AlignLeft size={15} />}{progress?.total ? `Converting page ${progress.completed} of ${progress.total}…` : progress ? "Preparing web reader…" : "Read as web text"}</Button>{error && <p role="alert" className="mx-auto mt-4 max-w-lg rounded-lg bg-[var(--red-soft)] p-3 text-xs leading-5 text-[var(--red)]">{error}</p>}</div>;
}

export function ResearchLibrary() {
  const { user, openAuth } = useAuth();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [featured, setFeatured] = useState<ResearchPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(""); } });
    const timer = window.setTimeout(() => {
      void Promise.all([listPublishedResearch(query, sort), listFeaturedResearch()])
        .then(([nextPapers, nextFeatured]) => { if (active) { setPapers(nextPapers); setFeatured(nextFeatured); } })
        .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Research Library is unavailable right now."); })
        .finally(() => { if (active) setLoading(false); });
    }, query ? 180 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, sort]);

  const featuredIds = new Set(featured.map((paper) => paper.id));
  const visibleFeatured = query ? featured.filter((paper) => [paper.title, paper.author_display_name, paper.school_display_name, paper.subject, paper.competition_text].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase())) : featured;

  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
    <header className="border-b border-[var(--line)] pb-10">
      <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">EconMind academic archive</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6"><div><h1 className="text-4xl font-bold tracking-[-.06em] sm:text-6xl">Research Library</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-muted)]">Research and writing from the EconMind Network</p></div><div className="flex gap-2">{user ? <><Link href="/learn/research/my"><Button variant="secondary">My Research</Button></Link><Link href="/learn/research/submit"><Button><Upload size={15} />Submit Research</Button></Link></> : <Button onClick={() => openAuth("sign-in")}>Sign in to submit</Button>}</div></div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row"><label className="flex h-12 flex-1 items-center gap-3 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-4"><Search size={18} className="text-[var(--ink-faint)]" /><span className="sr-only">Search research</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search papers, authors, schools, subjects or competitions..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--ink-faint)]" /></label><label className="flex h-12 items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-bold">Sort<select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")} className="bg-transparent text-sm font-semibold outline-none"><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label></div>
    </header>
    {error && <p role="alert" className="mt-6 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}
    {visibleFeatured.length > 0 && <section className="mt-10"><div className="flex items-center gap-2"><Award size={18} className="text-[var(--accent)]" /><h2 className="text-2xl font-bold tracking-[-.04em]">Featured Research</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleFeatured.map((paper) => <PaperCard key={paper.id} paper={paper} featured />)}</div></section>}
    <section className="mt-12"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--ink-faint)]">Discover</p><h2 className="mt-2 text-2xl font-bold tracking-[-.04em]">Research from the Network</h2></div><p className="text-xs text-[var(--ink-muted)]">{loading ? "Loading…" : `${papers.length} paper${papers.length === 1 ? "" : "s"}`}</p></div>{loading ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : papers.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{papers.map((paper) => <PaperCard key={paper.id} paper={paper} featured={featuredIds.has(paper.id)} />)}</div> : <Card className="mt-5 p-10 text-center"><BookOpen className="mx-auto text-[var(--ink-faint)]" size={24} /><h3 className="mt-4 text-lg font-bold">Research Library</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{query ? "No published research matches that search." : "Research from the EconMind community will appear here."}</p>{user && !query && <Link href="/learn/research/submit"><Button className="mt-6"><Upload size={15} />Submit Research</Button></Link>}</Card>}</section>
  </main>;
}

export function ResearchPaperDetail() {
  const search = useSearchParams();
  const paperId = search.get("paper");
  const [paper, setPaper] = useState<ResearchPaper | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!paperId) { queueMicrotask(() => { if (active) { setLoading(false); setError("No paper was selected."); } }); return; }
    void getResearchPaper(paperId).then(async (nextPaper) => {
      if (!nextPaper) throw new Error("This paper is unavailable or no longer exists.");
      const nextUrl = nextPaper.file_path ? await getResearchPdfUrl(nextPaper.file_path) : null;
      if (active) { setPaper(nextPaper); setPdfUrl(nextUrl); }
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not open this paper."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [paperId]);

  if (loading) return <main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></main>;
  if (!paper || error) return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center"><div><FileText className="mx-auto text-[var(--ink-faint)]" size={26} /><h1 className="mt-5 text-3xl font-bold">Paper unavailable</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{error || "This paper could not be read."}</p><Link href="/learn/research"><Button variant="secondary" className="mt-6">Back to Research Library</Button></Link></div></main>;
  const metadata = [["Subject", paper.subject], ["Competition", paper.competition_text], ["Year", paper.competition_year ? String(paper.competition_year) : null], ["Award", paper.award_text], ["Co-authors", paper.coauthors_text], ["Keywords", paper.keywords]].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
    <Link href="/learn/research" className="text-xs font-bold text-[var(--accent)]">← Research Library</Link>
    <header className="mt-7 border-b border-[var(--line)] pb-9">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><Badge>{paper.subject}</Badge><h1 className="mt-5 max-w-4xl text-3xl font-bold tracking-[-.055em] sm:text-5xl">{paper.title}</h1><p className="mt-5 text-base font-semibold">{paper.author_display_name}</p><p className="mt-1 text-sm text-[var(--ink-muted)]">{paper.school_display_name}</p></div>{paper.award_verified && <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--accent)]"><BadgeCheck size={15} />Award verified</span>}</div>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{metadata.map(([label, value]) => <div key={label} className="rounded-lg bg-[var(--surface-subtle)] p-4"><dt className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">{label}</dt><dd className="mt-2 text-sm font-semibold">{value}</dd></div>)}</dl>
    </header>
    {paper.abstract && <section className="mt-10 max-w-3xl"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Abstract</p><h2 className="mt-2 text-2xl font-bold">Abstract</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-muted)]">{paper.abstract}</p></section>}
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Read Paper</p><h2 className="mt-2 text-2xl font-bold">Read Paper</h2></div>{pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer"><Button variant="secondary">Open PDF <ArrowRight size={14} /></Button></a>}</div>
      {pdfUrl ? <><PdfWebReader pdfUrl={pdfUrl} title={paper.title} /><div className="mt-5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]"><iframe title={`PDF preview: ${paper.title}`} src={pdfUrl} className="h-[72vh] min-h-[34rem] w-full bg-white" /><a href={pdfUrl} target="_blank" rel="noreferrer" className="block px-5 py-3 text-center text-xs font-bold text-[var(--accent)]">Open PDF in a new tab</a></div></> : <Card className="mt-5 p-7 text-sm text-[var(--ink-muted)]">The PDF file is currently unavailable. The author or a reviewer can re-upload it.</Card>}
    </section>
  </main>;
}

export function ResearchSubmissionForm() {
  const { user, openAuth } = useAuth();
  const search = useSearchParams();
  const paperId = search.get("paper");
  const [form, setForm] = useState<ResearchPaperSubmission>(blankSubmission);
  const [file, setFile] = useState<File | null>(null);
  const [permission, setPermission] = useState(false);
  const [loading, setLoading] = useState(Boolean(paperId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editing = Boolean(paperId);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const preset = async () => {
      const context = await getLeagueContext(user.id);
      const defaultAuthor = context.profile?.display_name?.trim() || user.user_metadata.display_name || user.email?.split("@")[0] || "";
      const defaultSchool = context.school?.name || "";
      if (paperId) {
        const paper = await getResearchPaper(paperId);
        if (!paper || paper.owner_user_id !== user.id) throw new Error("This submission is unavailable to this account.");
        if (active) { setForm(paperToSubmission(paper)); setPermission(true); }
      } else if (active) setForm((current) => ({ ...current, author_display_name: current.author_display_name || defaultAuthor, school_display_name: current.school_display_name || defaultSchool }));
    };
    void preset().catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not prepare the submission form."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [paperId, user]);

  const set = <K extends keyof ResearchPaperSubmission>(key: K, value: ResearchPaperSubmission[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) { openAuth("sign-in"); return; }
    if (!permission) { setError("Please confirm the publication permission before submitting."); return; }
    if (!editing && !file) { setError("Please choose a PDF file."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      if (editing && paperId) {
        await updateResearchPaper(paperId, form);
        setMessage("Research details saved and returned to Pending Review.");
      } else {
        const paper = await createResearchPaper(form);
        const path = await uploadResearchPdf(user.id, paper.id, file!);
        await attachResearchPdf(paper.id, path, file!);
        setMessage("Research submitted for review.");
        setFile(null);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit this research."); }
    finally { setBusy(false); }
  };

  if (!user) return <AccessGate title="Sign in to submit research" detail="Your account remains the ownership record for every submission." action={() => openAuth("sign-in")} />;
  if (loading) return <main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></main>;
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 sm:px-8 lg:py-14"><Link href="/learn/research" className="text-xs font-bold text-[var(--accent)]">← Research Library</Link><header className="mt-7 border-b border-[var(--line)] pb-8"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Member submission</p><h1 className="mt-3 text-4xl font-bold tracking-[-.055em]">{editing ? "Edit Research" : "Submit Research"}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">Required: title, author, school, subject, and a PDF. Everything else is optional.</p></header><form onSubmit={(event) => void submit(event)} className="mt-8 space-y-8"><Card className="p-5 sm:p-7"><h2 className="text-xl font-bold">Required information</h2><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Title *" wide><input required value={form.title} maxLength={240} onChange={(event) => set("title", event.target.value)} /></Field><Field label="Author *"><input required value={form.author_display_name} maxLength={160} onChange={(event) => set("author_display_name", event.target.value)} /></Field><Field label="School *"><input required value={form.school_display_name} maxLength={240} onChange={(event) => set("school_display_name", event.target.value)} placeholder="Your school or institution" /></Field><Field label="Subject *"><input required value={form.subject} maxLength={160} onChange={(event) => set("subject", event.target.value)} placeholder="e.g. Labour Economics" /></Field>{!editing && <Field label="Paper / File *" wide><input required accept="application/pdf,.pdf" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span className="mt-2 block text-[11px] font-normal text-[var(--ink-muted)]">PDF only, up to 25 MB.</span></Field>}</div></Card><Card className="p-5 sm:p-7"><h2 className="text-xl font-bold">Optional information</h2><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Competition"><input value={optional(form.competition_text)} maxLength={240} onChange={(event) => set("competition_text", event.target.value || null)} placeholder="e.g. John Locke Essay Competition" /></Field><Field label="Year"><input type="number" min="1900" max="2100" value={form.competition_year ?? ""} onChange={(event) => set("competition_year", event.target.value ? Number(event.target.value) : null)} /></Field><Field label="Award / Result"><input value={optional(form.award_text)} maxLength={240} onChange={(event) => set("award_text", event.target.value || null)} placeholder="e.g. Finalist" /></Field><Field label="Keywords"><input value={optional(form.keywords)} maxLength={600} onChange={(event) => set("keywords", event.target.value || null)} placeholder="Comma-separated keywords" /></Field><Field label="Co-authors" wide><input value={optional(form.coauthors_text)} maxLength={1000} onChange={(event) => set("coauthors_text", event.target.value || null)} placeholder="Optional co-author names" /></Field><Field label="Abstract" wide><textarea rows={5} value={optional(form.abstract)} maxLength={12000} onChange={(event) => set("abstract", event.target.value || null)} placeholder="Optional abstract" /></Field><Field label="Description / Note" wide><textarea rows={3} value={optional(form.description)} maxLength={4000} onChange={(event) => set("description", event.target.value || null)} placeholder="Optional note for readers" /></Field><Field label="Visibility" wide><select value={form.visibility} onChange={(event) => set("visibility", event.target.value as ResearchVisibility)}><option value="public">Public</option><option value="members">EconMind Members Only</option></select><span className="mt-2 block text-[11px] font-normal text-[var(--ink-muted)]">All work is reviewed before publication.</span></Field></div></Card><Card className="p-5 sm:p-7"><h2 className="text-xl font-bold">Publication permission</h2><label className="mt-5 flex items-start gap-3 text-sm leading-6 text-[var(--ink-muted)]"><input required checked={permission} onChange={(event) => setPermission(event.target.checked)} type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" /><span>I confirm that I am an author of this work, or that I have permission from the relevant author(s) to publish it on EconMind. I understand that I retain ownership of my work and grant EconMind a non-exclusive right to display and distribute this submitted version through the Research Library.</span></label><p className="mt-4 text-xs font-semibold text-[var(--ink-muted)]">Copyright remains with the author(s).</p></Card>{error && <p role="alert" className="rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}{message && <p className="flex items-center gap-2 rounded-xl bg-[var(--accent-soft)] p-4 text-sm font-semibold text-[var(--accent)]"><CheckCircle2 size={17} />{message}</p>}<div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}{busy ? "Submitting…" : editing ? "Save and resubmit for review" : "Submit Research"}</Button></div></form></main>;
}

export function MyResearch() {
  const { user, openAuth } = useAuth();
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { if (!user) return; let active = true; void listMyResearch().then((next) => { if (active) setPapers(next); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load your research."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [user]);
  if (!user) return <AccessGate title="Sign in to view your research" detail="Your submissions and review status are private to your account." action={() => openAuth("sign-in")} />;
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8 lg:py-14"><header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--line)] pb-8"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Member archive</p><h1 className="mt-3 text-4xl font-bold tracking-[-.055em]">My Research</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Track your submissions and their review status.</p></div><Link href="/learn/research/submit"><Button><Upload size={15} />Submit Research</Button></Link></header>{error && <p role="alert" className="mt-6 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}{loading ? <div className="grid min-h-60 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : papers.length ? <div className="mt-7 space-y-3">{papers.map((paper) => <Card key={paper.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex flex-wrap items-center gap-3"><StatusBadge status={paper.status} /><span className="text-[11px] text-[var(--ink-faint)]">Submitted {readableDate(paper.created_at)}</span></div><h2 className="mt-3 text-lg font-bold">{paper.title}</h2><p className="mt-1 text-sm text-[var(--ink-muted)]">{paper.subject} · {paper.school_display_name}</p>{paper.status === "revision_requested" && paper.admin_review_note && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">Revision requested: {paper.admin_review_note}</p>}</div><div className="flex gap-2"><Link href={`/learn/research/paper?paper=${encodeURIComponent(paper.id)}`}><Button size="sm" variant="secondary">View</Button></Link><Link href={`/learn/research/submit?paper=${encodeURIComponent(paper.id)}`}><Button size="sm">Edit</Button></Link></div></div></Card>)}</div> : <Card className="mt-7 p-12 text-center"><FileText className="mx-auto text-[var(--ink-faint)]" size={24} /><h2 className="mt-4 text-xl font-bold">You have not submitted any research yet.</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">Start with the essentials: title, author, school, subject, and PDF.</p><Link href="/learn/research/submit"><Button className="mt-6">Submit Research</Button></Link></Card>}</main>;
}

export function ResearchAdmin() {
  const { user, worldSupervisor, roleLoading, openAuth } = useAuth();
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Exclude<ResearchPaperStatus, "draft">>("published");
  const [verified, setVerified] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [draft, setDraft] = useState<ResearchPaperSubmission>(blankSubmission);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => void listResearchForAdmin().then((next) => { setPapers(next); setSelectedId((current) => current || next[0]?.id || ""); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load research review.")), []);
  useEffect(() => { if (user && worldSupervisor) load(); }, [user, worldSupervisor, load]);
  const selected = useMemo(() => papers.find((paper) => paper.id === selectedId) ?? null, [papers, selectedId]);
  useEffect(() => { if (selected) queueMicrotask(() => { setNote(selected.admin_review_note ?? ""); setStatus(selected.status === "draft" ? "pending_review" : selected.status); setVerified(selected.award_verified); setFeatured(selected.featured); setDraft(paperToSubmission(selected)); }); }, [selected]);
  const review = async () => { if (!selected) return; setBusy(true); setError(""); try { const next = await reviewResearchPaper({ paperId: selected.id, status, internalNote: note, awardVerified: verified, featured }); setPapers((current) => current.map((paper) => paper.id === next.id ? next : paper)); setMessage("Review decision saved."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save this review."); } finally { setBusy(false); } };
  const saveMetadata = async () => { if (!selected) return; setBusy(true); setError(""); try { const next = await updateResearchPaperAsAdmin(selected.id, draft); setPapers((current) => current.map((paper) => paper.id === next.id ? next : paper)); setMessage("Metadata saved."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save metadata."); } finally { setBusy(false); } };
  if (!user && !roleLoading) return <AccessGate title="Sign in as a platform administrator" detail="Research review is restricted to the existing EconMind administration role." action={() => openAuth("sign-in")} />;
  if (roleLoading) return <main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></main>;
  if (!worldSupervisor) return <AccessGate title="Platform administrator access required" detail="Your account does not have access to Research Submissions." />;
  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8 lg:py-14"><header className="border-b border-[var(--line)] pb-8"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Platform administration</p><h1 className="mt-3 text-4xl font-bold tracking-[-.055em]">Research Submissions</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Review, publish, request revision, reject, and maintain the member research archive.</p></header>{error && <p role="alert" className="mt-6 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}{message && <p className="mt-6 rounded-xl bg-[var(--accent-soft)] p-4 text-sm font-semibold text-[var(--accent)]">{message}</p>}<section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.9fr)]"><div className="space-y-3">{papers.map((paper) => <button type="button" key={paper.id} onClick={() => setSelectedId(paper.id)} className={`w-full rounded-xl border p-5 text-left ${selectedId === paper.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)]"}`}><div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge status={paper.status} /><span className="text-[10px] text-[var(--ink-faint)]">Updated {readableDate(paper.updated_at)}</span></div><h2 className="mt-3 text-base font-bold">{paper.title}</h2><p className="mt-1 text-xs text-[var(--ink-muted)]">{paper.author_display_name} · {paper.school_display_name}</p></button>)}{papers.length === 0 && <Card className="p-10 text-center text-sm text-[var(--ink-muted)]">No research submissions are waiting for review.</Card>}</div>{selected && <aside className="space-y-5"><Card className="p-5"><div className="flex items-start justify-between gap-3"><div><StatusBadge status={selected.status} /><h2 className="mt-3 text-xl font-bold">{selected.title}</h2><p className="mt-1 text-sm text-[var(--ink-muted)]">{selected.author_display_name} · {selected.school_display_name}</p></div><Link href={`/learn/research/paper?paper=${encodeURIComponent(selected.id)}`}><Button size="sm" variant="secondary">Preview</Button></Link></div><div className="mt-6 grid gap-4"><Field label="Review decision"><select value={status} onChange={(event) => setStatus(event.target.value as Exclude<ResearchPaperStatus, "draft">)}><option value="pending_review">Keep pending</option><option value="published">Publish</option><option value="revision_requested">Request revision</option><option value="rejected">Reject</option></select></Field><Field label="Internal Review Note"><textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Only reviewers and the author can see a revision note." /></Field><label className="flex items-center gap-2 text-xs font-bold"><input checked={verified} onChange={(event) => setVerified(event.target.checked)} type="checkbox" className="size-4 accent-[var(--accent)]" /> Award verified</label><label className="flex items-center gap-2 text-xs font-bold"><input checked={featured} disabled={status !== "published"} onChange={(event) => setFeatured(event.target.checked)} type="checkbox" className="size-4 accent-[var(--accent)]" /> Featured research</label><Button disabled={busy} onClick={() => void review()}>{busy && <LoaderCircle className="animate-spin" size={14} />}Save review</Button></div></Card><Card className="p-5"><h3 className="text-lg font-bold">Edit metadata</h3><div className="mt-5 grid gap-4"><Field label="Title"><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field><Field label="Author"><input value={draft.author_display_name} onChange={(event) => setDraft({ ...draft, author_display_name: event.target.value })} /></Field><Field label="School"><input value={draft.school_display_name} onChange={(event) => setDraft({ ...draft, school_display_name: event.target.value })} /></Field><Field label="Subject"><input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /></Field><Field label="Competition"><input value={optional(draft.competition_text)} onChange={(event) => setDraft({ ...draft, competition_text: event.target.value || null })} /></Field><Field label="Award"><input value={optional(draft.award_text)} onChange={(event) => setDraft({ ...draft, award_text: event.target.value || null })} /></Field><Field label="Visibility"><select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as ResearchVisibility })}><option value="public">Public</option><option value="members">EconMind Members Only</option></select></Field><Button variant="secondary" disabled={busy} onClick={() => void saveMetadata()}>Save metadata</Button></div></Card></aside>}</section></main>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`block text-xs font-bold ${wide ? "sm:col-span-2" : ""}`}>{label}<span className="mt-2 block [&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-[var(--line)] [&_input]:bg-[var(--canvas)] [&_input]:px-3 [&_input]:text-sm [&_select]:h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[var(--line)] [&_select]:bg-[var(--canvas)] [&_select]:px-3 [&_select]:text-sm [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[var(--line)] [&_textarea]:bg-[var(--canvas)] [&_textarea]:p-3 [&_textarea]:text-sm">{children}</span></label>; }

function AccessGate({ title, detail, action }: { title: string; detail: string; action?: () => void }) { return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><LockKeyhole size={22} /></span><h1 className="mt-5 text-3xl font-bold tracking-[-.05em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{detail}</p>{action && <Button className="mt-6" onClick={action}>Sign in</Button>}</div></main>; }
