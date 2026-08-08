import Link from "next/link";
import { ArrowRight, Network, Sparkles } from "lucide-react";

const schools = [
  { lines: ["Suzhou High School-International Division"], position: 0 },
  { lines: ["Basis International School Shenzhen"], position: 1 },
  { lines: ["Beijing Academy International Department"], position: 2 },
  { lines: ["Chongqing Nankai Secondary School"], position: 3 },
  { lines: ["Hangzhou Dingwen Academy"], position: 4 },
  { lines: ["Harrow Nanning"], position: 5 },
  { lines: ["HD Shanghai School"], position: 6 },
  { lines: ["HT Nanjing Impact Academy"], position: 7 },
  { lines: ["International Department of", "Beijing No.80 High School"], position: 8 },
  { lines: ["Jiangsu Tianyi High School"], position: 9.45 },
  { lines: ["Nanjing Foreign Language School, Xianlin Campus"], position: 10.45 },
  { lines: ["Shandong Experimental High School"], position: 11.45 },
  { lines: ["Suzhou Industrial Park", "Xinghai Experimental Senior High School", "(Shenhu Road Campus)"], position: 12.45 },
  { lines: ["SUZHOU SCIENCE&TECHNOLOGY TOWN", "FOREIGN LANGUAGE SCHOOL"], position: 14.85 },
] as const;

export function InterschoolNetworkHero() {
  return (
    <section className="inter-school-hero overflow-hidden text-white">
      <div className="inter-school-grid" aria-hidden="true" />
      <div className="inter-school-globe" aria-hidden="true">
        <span className="inter-school-globe-ring inter-school-globe-ring-one" />
        <span className="inter-school-globe-ring inter-school-globe-ring-two" />
        <span className="inter-school-globe-ring inter-school-globe-ring-three" />
      </div>
      <div className="inter-school-orbit inter-school-orbit-one" aria-hidden="true" />
      <div className="inter-school-orbit inter-school-orbit-two" aria-hidden="true" />

      <div className="relative mx-auto grid min-h-[720px] max-w-[1440px] px-5 py-16 sm:px-8 lg:min-h-[900px] lg:px-12 lg:py-20">
        <div className="relative z-10 max-w-3xl self-start">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-blue-100">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 backdrop-blur-sm"><Network size={13} /> Inter-school network</span>
            <span>Fourteen schools · one economic world</span>
          </div>
          <h1 className="mt-7 text-[clamp(3.2rem,5.4vw,6rem)] font-bold leading-[.86] tracking-[-.075em]">EconMind<br />OS League.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-blue-100/85 sm:text-lg">A shared economics workspace where schools test policies, connect markets and run one persistent world together.</p>
        </div>

        <div className="relative z-10 mt-auto flex flex-col justify-end gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/league" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-[#0d2d80] transition hover:-translate-y-0.5 hover:bg-blue-50">Enter the League <ArrowRight size={16} /></Link>
            <Link href="/models" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-5 text-sm font-bold backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/18">Explore models <Sparkles size={16} /></Link>
          </div>
        </div>

        <div className="inter-school-lanes" aria-label="Participating schools">
          {schools.map((school, index) => (
            <p key={school.lines.join(" ")} aria-label={school.lines.join(" ")} className={`inter-school-lane${index === 0 ? " inter-school-lane-featured" : ""}${school.lines.length > 1 ? " inter-school-lane-long inter-school-lane-multiline" : ""}`} style={{ "--school-index": school.position } as React.CSSProperties}>
              {school.lines.map((line) => <span key={line}>{line}</span>)}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
