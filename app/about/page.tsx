import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  ChartNoAxesCombined,
  FlaskConical,
  Globe2,
  Handshake,
  Scale,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

const learningPath = ["Observe", "Model", "Simulate", "Test", "Evaluate", "Decide"] as const;

const workAreas = [
  {
    icon: BookOpenCheck,
    title: "Real-world economics",
    text: "Cases, structured questions, evidence, and discussion connect economic theory with contemporary and historical questions. The aim is to move from what happened, to why it happened, to what could change if incentives, constraints, or decisions changed.",
  },
  {
    icon: BrainCircuit,
    title: "Models & mechanisms",
    text: "Across microeconomics, macroeconomics, behavioural economics, game theory, international, public and development economics, models are analytical tools—not unquestionable descriptions of reality. We examine assumptions, mechanisms, predictions, and limitations together.",
  },
  {
    icon: FlaskConical,
    title: "Interactive simulations",
    text: "Learners can change assumptions, test decisions, observe modelled consequences, and compare alternatives. These experiences develop economic reasoning, systems thinking, quantitative intuition, and an understanding of trade-offs.",
  },
  {
    icon: Globe2,
    title: "EconMind League",
    text: "The League extends learning into cross-school and cross-community exchange through shared simulations, challenges, experiments, discussions, and collaborative activities. It brings different perspectives to the same economic problem.",
  },
] as const;

const values = [
  { title: "Curiosity", text: "Economic questions are often more valuable than memorised answers." },
  { title: "Evidence", text: "Arguments should be supported by evidence wherever possible." },
  { title: "Models", text: "Models help us understand reality, but they are not reality itself." },
  { title: "Experimentation", text: "Simulations allow ideas to be tested before conclusions are accepted." },
  { title: "Debate", text: "Meaningful academic disagreement strengthens economic understanding." },
  { title: "Responsibility", text: "An open academic community works when people respect evidence, rules, privacy, and one another." },
] as const;

const policyLinks = [
  { href: "/privacy", title: "Privacy Notice", text: "How personal information and platform data are handled." },
  { href: "/terms", title: "Terms of Use", text: "Conditions, responsibilities, and limitations for using the platform." },
  { href: "/community-guidelines", title: "Community Guidelines", text: "Standards for discussion, participation, safety, and submitted content." },
  { href: "/integrity", title: "Academic & League Integrity", text: "Standards for fair academic and competitive participation." },
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">{children}</p>;
}

export default function AboutPage() {
  return (
    <main>
      <section className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <SectionLabel>About EconMind</SectionLabel>
          <h1 className="mt-4 max-w-5xl text-5xl font-bold tracking-[-.065em] sm:text-7xl">Economics beyond the classroom.</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--ink-muted)]">
            EconMind is a student-initiated, independently operated, non-profit educational platform for economics learning, experimentation, and academic exchange. It connects real-world issues, theory, interactive models, simulations, evidence, and discussion in one shared learning environment.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-6">
            {learningPath.map((step, index) => (
              <div key={step} className="bg-[var(--surface)] px-4 py-5">
                <span className="text-[10px] font-extrabold tracking-[.18em] text-[var(--accent)]">0{index + 1}</span>
                <p className="mt-2 font-bold tracking-[-.025em]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:py-24">
        <div>
          <SectionLabel>Our mission</SectionLabel>
          <h2 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl">Make economics interactive, evidence-based, collaborative, and connected to the real world.</h2>
        </div>
        <div className="space-y-5 text-base leading-8 text-[var(--ink-muted)]">
          <p>Traditional economics education often begins with a model and ends with an examination question. EconMind begins with problems. Participants are encouraged to observe an issue, identify relevant evidence, select appropriate concepts, examine the underlying mechanism, test possible decisions, and evaluate competing outcomes.</p>
          <p>Our purpose is not to provide one economic worldview. It is to provide an environment in which learners can develop the tools to form and defend their own conclusions.</p>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <SectionLabel>What we do</SectionLabel>
          <div className="mt-4 max-w-3xl"><h2 className="text-3xl font-bold tracking-[-.045em] sm:text-4xl">Tools for asking better economic questions.</h2></div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {workAreas.map((area) => {
              const Icon = area.icon;
              return (
                <article key={area.title} className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-6 shadow-[var(--shadow)]">
                  <span className="grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={19} /></span>
                  <h3 className="mt-5 text-xl font-bold tracking-[-.03em]">{area.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">{area.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_.92fr]">
          <div>
            <SectionLabel>An academic community</SectionLabel>
            <h2 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl">Reasoning over authority. Constructive disagreement over personal conflict.</h2>
            <div className="mt-6 space-y-5 text-base leading-8 text-[var(--ink-muted)]">
              <p>Economics involves disagreement: different assumptions, models, values, and evidence can produce different conclusions. EconMind welcomes academic challenge and encourages participants to distinguish facts, evidence, assumptions, model results, interpretations, normative judgments, and personal opinions.</p>
              <p>Harassment, intimidation, impersonation, plagiarism, deliberate manipulation, privacy violations, and other abuse do not belong here.</p>
            </div>
          </div>
          <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7">
            <UsersRound className="text-[var(--accent)]" size={22} />
            <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--ink-faint)]">We value</p>
            <ul className="mt-4 space-y-4 text-base font-bold tracking-[-.02em]">
              <li>Evidence over assertion</li>
              <li>Reasoning over authority</li>
              <li>Intellectual curiosity over predetermined conclusions</li>
              <li>Respectful debate across schools and communities</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-3">
            <article className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-6"><Handshake className="text-[var(--accent)]" size={20} /><h2 className="mt-5 text-xl font-bold tracking-[-.03em]">Independent by design</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">EconMind was initiated and is maintained by students. Unless expressly stated otherwise, a school, university, government body, company, financial institution, or other organisation does not operate, sponsor, endorse, or assume responsibility for the platform.</p></article>
            <article className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-6"><Scale className="text-[var(--accent)]" size={20} /><h2 className="mt-5 text-xl font-bold tracking-[-.03em]">Educational, not advisory</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">Nothing on EconMind is investment, financial, legal, accounting, business, regulatory, or public-policy advice. Models simplify reality; simulations rely on assumptions; data can change; and software can contain errors.</p></article>
            <article className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-6"><ChartNoAxesCombined className="text-[var(--accent)]" size={20} /><h2 className="mt-5 text-xl font-bold tracking-[-.03em]">Outcomes are not forecasts</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">A modelled result is an outcome within a set of assumptions—not a guarantee or prediction of reality. Rankings, scores, indicators, scenario outcomes, and generated results exist for learning, comparison, and experimentation.</p></article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <SectionLabel>Our principles</SectionLabel>
        <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-.045em] sm:text-4xl">A shared standard for open economic learning.</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value, index) => <article key={value.title} className="bg-[var(--surface)] p-6"><span className="text-[10px] font-extrabold tracking-[.18em] text-[var(--accent)]">0{index + 1}</span><h3 className="mt-4 text-lg font-bold tracking-[-.025em]">{value.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{value.text}</p></article>)}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:py-20">
          <div>
            <SectionLabel>Privacy, integrity & governance</SectionLabel>
            <h2 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl">Open learning needs clear boundaries.</h2>
            <p className="mt-6 text-sm leading-7 text-[var(--ink-muted)]">We aim to minimise data collection, limit access, use appropriate security, and give users meaningful control. Platform administrators may take proportionate steps to protect users, maintain academic integrity, address abuse, enforce rules, or meet applicable obligations.</p>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-muted)]">EconMind is primarily designed for secondary-school learners. It is not designed to solicit personal information from children under 14, and participation must follow applicable local age and consent requirements.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {policyLinks.map((policy) => <Link key={policy.href} href={policy.href} className="group rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-5 transition hover:border-[var(--accent)]"><ShieldCheck size={17} className="text-[var(--accent)]" /><h3 className="mt-4 flex items-center justify-between gap-3 text-sm font-bold">{policy.title}<ArrowRight size={15} className="shrink-0 transition group-hover:translate-x-1" /></h3><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{policy.text}</p></Link>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center shadow-[var(--shadow)] sm:px-10">
          <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">About the initiative</p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-.045em] sm:text-5xl">Student-initiated. Independently operated. Non-profit in purpose.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[var(--ink-muted)]">EconMind is built for economics education and academic exchange. It is not a separately registered charitable or non-profit legal entity, and its inclusion of any institution, resource, or point of view does not imply endorsement.</p>
          <p className="mt-8 font-serif text-2xl italic tracking-[-.025em]">Economics beyond the classroom.</p>
        </div>
      </section>
    </main>
  );
}
