import Link from "next/link";
import { ArrowRight, Network, Sparkles } from "lucide-react";

const schools = [
  ["Suzhou High School-International Division"],
  ["Basis International School Shenzhen"],
  ["Beijing Academy International Department"],
  ["Chongqing Nankai Secondary School"],
  ["Hangzhou Dingwen Academy"],
  ["Harrow Nanning"],
  ["HD Shanghai School"],
  ["HT Nanjing Impact Academy"],
  ["International Department of", "Beijing No.80 High School"],
  ["Jiangsu Tianyi High School"],
  ["Nanjing Foreign Language School, Xianlin Campus"],
  ["Shandong Experimental High School"],
  ["Suzhou Industrial Park", "Xinghai Experimental Senior High School", "(Shenhu Road Campus)"],
  ["SUZHOU SCIENCE&TECHNOLOGY TOWN", "FOREIGN LANGUAGE SCHOOL"],
] as const;

const schoolLength = (school: readonly string[]) => school.join(" ").length;
const schoolsByLength = [...schools.slice(1)].sort(
  (left, right) => schoolLength(left) - schoolLength(right),
);
const upperRightSchools = [schools[0], ...schoolsByLength.slice(0, 6)];
const lowerSchools = schoolsByLength.slice(6);

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
          <h1 className="inter-school-league-title mt-7 font-bold">EconMind<br />OS League.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-blue-100/85 sm:text-lg">A shared economics workspace where schools test policies, connect markets and run one persistent world together.</p>
        </div>

        <div className="relative z-10 mt-auto flex flex-col justify-end gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/league" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-[#0d2d80] transition hover:-translate-y-0.5 hover:bg-blue-50">Enter the League <ArrowRight size={16} /></Link>
            <Link href="/models" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-5 text-sm font-bold backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/18">Explore models <Sparkles size={16} /></Link>
          </div>
        </div>

        <div className="inter-school-lanes" aria-label="Participating schools">
          <p className="inter-school-lanes-label">Participating schools</p>
          <ol className="inter-school-lanes-list inter-school-lanes-list-right">
            {upperRightSchools.map((school, index) => (
              <li key={school.join(" ")} className={`inter-school-lane${index === 0 ? " inter-school-lane-featured" : ""}`} style={{ "--school-index": index } as React.CSSProperties}>
                {school.map((line) => <span key={line}>{line}</span>)}
              </li>
            ))}
          </ol>
          <ol className="inter-school-lanes-list inter-school-lanes-list-lower">
            {lowerSchools.map((school, index) => (
              <li key={school.join(" ")} className="inter-school-lane" style={{ "--school-index": index } as React.CSSProperties}>
                {school.map((line) => <span key={line}>{line}</span>)}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
