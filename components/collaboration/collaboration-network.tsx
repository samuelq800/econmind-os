import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, Network, Quote } from "lucide-react";
import styles from "./collaboration-network.module.css";

type PartnerProfile = {
  name: string;
  fullName?: string;
  category: string[];
  description: string;
  relationship: string;
  logo: { src: string; alt: string; tone: "navy" | "black" };
  founder: { name?: string; role: string; image: string; alt: string; position: string };
  metrics?: Array<{ value: string; label: string }>;
  links?: Array<{ label: string; href: string }>;
};

const partners: readonly PartnerProfile[] = [
  {
    name: "BoMinds",
    category: ["Critical Thinking", "Philosophy", "Humanities", "Student-led Nonprofit"],
    description:
      "BoMinds is a student-led nonprofit network connecting young people in China with dialogue and learning opportunities in critical thinking, philosophy, and the humanities.",
    relationship:
      "Cross-community academic exchange, interdisciplinary activities, and shared student initiatives.",
    logo: { src: "/images/collaboration/bominds-logo.jpg", alt: "BoMinds logo", tone: "navy" },
    founder: {
      role: "Founder",
      image: "/images/collaboration/bominds-founder.jpg",
      alt: "BoMinds founder",
      position: "82% center",
    },
  },
  {
    name: "UHHC",
    fullName: "The Union of Humanities and History Clubs",
    category: ["Humanities", "History", "Interdisciplinary", "International Network"],
    description:
      "The Union of Humanities and History Clubs (UHHC) is an international alliance of student organizations focusing on history, literature, arts, and interdisciplinary fields including economics, business, law, and humanities-oriented AI. Its member network spans 33 schools across 4 countries, while its broader collaboration network connects approximately 100 schools across 10 countries.",
    relationship:
      "Cross-community academic exchange, interdisciplinary activities, and shared student initiatives.",
    logo: { src: "/images/collaboration/uhhc-logo.png", alt: "UHHC logo", tone: "black" },
    founder: {
      name: "Peter",
      role: "Founder",
      image: "/images/collaboration/peter-uhhc-founder.png",
      alt: "Peter, UHHC Founder and Distinguished Strategic Partner",
      position: "50% 36%",
    },
    metrics: [
      { value: "4", label: "Countries" },
      { value: "33", label: "Member Schools" },
      { value: "10", label: "Countries Connected" },
      { value: "100+", label: "Schools in Network" },
    ],
    links: [
      { label: "Official Website", href: "http://www.uhhc.com.cn/" },
      { label: "About UHHC", href: "http://www.uhhc.com.cn/uhhcintro/" },
    ],
  },
];

function PartnerLogo({ partner }: { partner: PartnerProfile }) {
  return (
    <div className={`${styles.logoPanel} ${partner.logo.tone === "navy" ? styles.navyLogo : styles.blackLogo}`}>
      <div className={styles.logoRule} />
      <Image
        className={styles.partnerLogo}
        src={partner.logo.src}
        alt={partner.logo.alt}
        width={partner.logo.tone === "navy" ? 450 : 310}
        height={partner.logo.tone === "navy" ? 450 : 283}
        sizes="(max-width: 760px) 76vw, 34vw"
      />
      <p>Collaboration Network</p>
    </div>
  );
}

function FounderProfile({ partner, distinguished = false }: { partner: PartnerProfile; distinguished?: boolean }) {
  return (
    <article className={`${styles.personCard} ${distinguished ? styles.distinguished : ""}`}>
      <div className={styles.personImageWrap}>
        <Image
          src={partner.founder.image}
          alt={partner.founder.alt}
          fill
          sizes="(max-width: 760px) 100vw, 350px"
          className={styles.personImage}
          style={{ objectPosition: partner.founder.position }}
        />
      </div>
      <div className={styles.personCopy}>
        {distinguished && <p className={styles.distinguishedLabel}>Distinguished Strategic Partner</p>}
        <div>
          <p className={styles.personRole}>{partner.founder.role}</p>
          <h3>{partner.founder.name ?? "Founder profile"}</h3>
        </div>
        {distinguished && <p className={styles.personNote}>An exceptional strategic relationship supporting connected student academic communities.</p>}
      </div>
    </article>
  );
}

function PartnerInformation({ partner }: { partner: PartnerProfile }) {
  return (
    <div className={styles.partnerInformation}>
      <header>
        <p className={styles.sectionNumber}>{partner.name === "BoMinds" ? "Featured Partner 01" : "Featured Partner 02"}</p>
        <h2 id={partner.name === "BoMinds" ? "bominds-heading" : "uhhc-heading"}>{partner.name}</h2>
        {partner.fullName && <p className={styles.fullName}>{partner.fullName}</p>}
      </header>
      <div className={styles.tags}>{partner.category.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <p className={styles.description}>{partner.description}</p>
      {partner.metrics && <div className={styles.metrics}>{partner.metrics.map((metric) => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div>}
      <div className={styles.relationship}>
        <p>Collaboration with EconMind</p>
        <span>{partner.relationship}</span>
      </div>
      {partner.links && <div className={styles.partnerLinks}>{partner.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLink size={14} /></a>)}</div>}
    </div>
  );
}

export function CollaborationNetwork() {
  const [bominds, uhhc] = partners;
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Collaboration Network</p>
          <h1>Ideas become more powerful when institutions connect.</h1>
          <p className={styles.heroCopy}>Connecting student-led organizations across economics, humanities, critical thinking, and interdisciplinary learning.</p>
        </div>
        <aside className={styles.heroAside}>
          <Network size={22} />
          <p>Independent communities.<br />Shared intellectual purpose.</p>
        </aside>
      </section>

      <section className={styles.partnerSection} aria-labelledby="bominds-heading">
        <PartnerLogo partner={bominds} />
        <div className={styles.partnerContent}>
          <PartnerInformation partner={bominds} />
          <FounderProfile partner={bominds} />
        </div>
      </section>

      <section className={`${styles.partnerSection} ${styles.partnerReverse}`} aria-labelledby="uhhc-heading">
        <div className={styles.partnerContent}>
          <PartnerInformation partner={uhhc} />
          <div className={styles.uhhcProfiles}>
            <FounderProfile partner={uhhc} />
            <FounderProfile partner={uhhc} distinguished />
          </div>
        </div>
        <PartnerLogo partner={uhhc} />
      </section>

      <section className={styles.ecosystem}>
        <div className={styles.ecosystemIntro}>
          <p className={styles.kicker}>Collaboration Ecosystem</p>
          <h2>Not a wall of logos.<br /><em>A connected academic network.</em></h2>
          <p>EconMind brings complementary student communities into conversation: distinct in focus, aligned in curiosity.</p>
        </div>
        <div className={styles.networkMap} aria-label="BoMinds, EconMind and UHHC collaboration ecosystem">
          <span className={`${styles.node} ${styles.bomindsNode}`}>BoMinds</span>
          <span className={`${styles.node} ${styles.econmindNode}`}>EconMind</span>
          <span className={`${styles.node} ${styles.uhhcNode}`}>UHHC</span>
          <i className={styles.lineOne} />
          <i className={styles.lineTwo} />
          <i className={styles.lineThree} />
          <p className={styles.economics}>Economics</p>
          <p className={styles.humanities}>Humanities</p>
          <p className={styles.critical}>Critical Thinking</p>
          <p className={styles.interdisciplinary}>Interdisciplinary Learning</p>
        </div>
      </section>

      <section className={styles.futurePartner}>
        <Quote size={20} />
        <div><p className={styles.kicker}>An open network</p><h2>Future collaborations are built around shared learning, not sponsorship.</h2></div>
        <Link href="/about">Learn about EconMind <ArrowRight size={16} /></Link>
      </section>
    </main>
  );
}
