import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircleMore, Network, Phone } from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { FOUNDING_TEAM, REGIONAL_LEADERS, REGIONAL_NETWORK, contactLabel, type TeamMember } from "@/lib/team/team-data";

export function TeamPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-b border-[var(--line)]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,color-mix(in_srgb,var(--line)_52%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--line)_52%,transparent)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_86%)]" />
          <div className="relative mx-auto max-w-[1360px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">EconMind Network</p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[.94] tracking-[-.055em] sm:text-7xl lg:text-8xl">Meet the Team<br />Behind EconMind.</h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--ink-muted)] sm:text-lg">A student-led network connecting schools, regions, and economic communities through shared research, simulation, and competition.</p>
            <div className="mt-12 flex max-w-2xl flex-wrap gap-x-8 gap-y-4 border-t border-[var(--line)] pt-5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">
              <span>Student-led</span><span>Cross-regional</span><span>Built for the League</span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1360px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28" aria-labelledby="founding-team">
          <div className="max-w-2xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">01 · Founding Team</p>
            <h2 id="founding-team" className="mt-4 font-serif text-4xl tracking-[-.05em] sm:text-6xl">One founding partnership.</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--ink-muted)]">EconMind was founded as a shared project: a platform for making economic reasoning, simulation and cross-school collaboration more accessible.</p>
          </div>
          <article className="mt-12 grid overflow-hidden border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[1.02fr_.98fr]">
            <div className="relative min-h-[390px] bg-[var(--surface-subtle)] sm:min-h-[510px]">
              <Image src="/images/team/samuel-yale.jpg" alt="Samuel and Yale, Co-Founders of EconMind" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" style={{ objectPosition: "50% 45%" }} />
              <span className="absolute bottom-5 left-5 border border-white/45 bg-black/25 px-3 py-2 text-[9px] font-extrabold uppercase tracking-[.16em] text-white backdrop-blur-sm">Joint founding team</span>
            </div>
            <div className="grid content-between p-6 sm:p-9 lg:p-12">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">EconMind OS · Est. 2026</p>
                <p className="mt-5 max-w-xl font-serif text-3xl leading-tight tracking-[-.045em] sm:text-4xl">Product and research developed in partnership.</p>
              </div>
              <div className="mt-12 grid gap-9 border-t border-[var(--line)] pt-7 sm:grid-cols-2">
                {FOUNDING_TEAM.map((member) => <FounderProfile key={member.name} member={member} />)}
              </div>
            </div>
          </article>
        </section>

        <section className="border-y border-[var(--line)] bg-[var(--surface)]" aria-labelledby="regional-leadership">
          <div className="mx-auto max-w-[1360px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <div className="grid gap-10 border-b border-[var(--line)] pb-12 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">02 · Regional Leadership</p>
                <h2 id="regional-leadership" className="mt-4 max-w-2xl font-serif text-4xl tracking-[-.05em] sm:text-6xl">One network,<br />many regional nodes.</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[var(--ink-muted)]">Our regional leads connect participating schools, coordinate local communities, and help shape the EconMind League across different educational networks.</p>
            </div>

            <div className="mt-10 grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {REGIONAL_LEADERS.map((member) => <TeamMemberCard key={member.name} member={member} />)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1360px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28" aria-labelledby="regional-index">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <span className="grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Network size={19} /></span>
              <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">Regional index</p>
              <h2 id="regional-index" className="mt-4 max-w-md font-serif text-4xl tracking-[-.05em] sm:text-5xl">A distributed leadership structure.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-[var(--ink-muted)]">Regional leadership keeps the network connected without placing its direction in a single school or city.</p>
            </div>
            <ol className="border-y border-[var(--line)]">
              {REGIONAL_NETWORK.map((node, index) => <li key={node.region} className="grid gap-2 border-b border-[var(--line)] py-5 last:border-b-0 sm:grid-cols-[3rem_1fr_auto] sm:items-baseline"><span className="text-[10px] font-extrabold tracking-[.14em] text-[var(--accent)]">{String(index + 1).padStart(2, "0")}</span><strong className="text-base tracking-[-.025em]">{node.region}</strong><span className="text-sm text-[var(--ink-muted)]">{node.leads.join(" · ")}</span></li>)}
            </ol>
          </div>
        </section>

        <section className="border-t border-[var(--line)] bg-[var(--surface-subtle)]">
          <div className="mx-auto grid max-w-[1360px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-12 lg:py-28">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">03 · Schools & Wider Network</p>
              <h2 className="mt-4 max-w-2xl font-serif text-4xl tracking-[-.05em] sm:text-6xl">Built across schools and regions.</h2>
            </div>
            <div className="max-w-xl lg:pt-7">
              <p className="text-base leading-8 text-[var(--ink-muted)]">EconMind brings together students from different schools, cities, and academic systems to build a shared platform for economic learning, experimentation, and competition. Regional leadership allows the League to grow without becoming centralized around a single institution.</p>
              <Link href="/league/schools" className="mt-8 inline-flex items-center gap-2 border-b border-[var(--ink)] pb-2 text-sm font-bold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">Explore Participating Schools <ArrowRight size={15} /></Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function FounderProfile({ member }: { member: TeamMember }) {
  return <section>
    <h3 className="text-2xl font-bold tracking-[-.04em]">{member.name}</h3>
    <p className="mt-1 text-sm text-[var(--ink-muted)]">{member.role}</p>
    <ul className="mt-5 space-y-2 border-l border-[var(--line-strong)] pl-3 text-xs leading-5 text-[var(--ink-muted)]">
      {member.focus?.map((item) => <li key={item}>{item}</li>)}
    </ul>
    <Contact member={member} className="mt-6" />
  </section>;
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  return <article className="group border-b border-[var(--line)] pb-6">
    <Portrait member={member} />
    <div className="mt-5 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-xl font-bold tracking-[-.04em]">{member.name}</h3>
        <p className="mt-1 min-h-10 text-sm leading-5 text-[var(--ink-muted)]">{member.role}</p>
      </div>
      <span className="mt-1 text-[10px] font-extrabold uppercase tracking-[.13em] text-[var(--accent)]">Lead</span>
    </div>
    <Contact member={member} className="mt-5" />
  </article>;
}

function Portrait({ member }: { member: TeamMember }) {
  if (!member.image) {
    return <div className="relative grid aspect-[4/5] place-items-center overflow-hidden bg-[var(--surface-subtle)]"><span aria-hidden="true" className="text-6xl font-serif text-[var(--line-strong)]">{member.name.slice(0, 1)}</span><span className="absolute bottom-4 left-4 text-[9px] font-extrabold uppercase tracking-[.15em] text-[var(--ink-faint)]">Portrait forthcoming</span></div>;
  }

  return <div className="relative aspect-[4/5] overflow-hidden bg-[var(--surface-subtle)]">
    <Image src={member.image} alt={`${member.name}, ${member.role}`} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.025]" style={{ objectPosition: member.imagePosition }} />
  </div>;
}

function Contact({ member, className = "" }: { member: TeamMember; className?: string }) {
  const Icon = member.contact.type === "phone" ? Phone : MessageCircleMore;
  const value = member.contact.value;
  const content = <><Icon size={13} aria-hidden="true" /><span className="font-extrabold uppercase tracking-[.12em] text-[var(--ink-faint)]">{contactLabel(member.contact)}</span><span className="font-semibold text-[var(--ink-muted)]">{value}</span></>;

  return member.contact.type === "phone"
    ? <a href={`tel:${value}`} className={`inline-flex items-center gap-2 text-xs transition-colors hover:text-[var(--accent)] ${className}`}>{content}</a>
    : <p className={`inline-flex items-center gap-2 text-xs ${className}`}>{content}</p>;
}
