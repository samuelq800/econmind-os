import type { EconBenchChallenge } from "@/lib/economics/econbench";

const tone = "var(--accent)";
const muted = "var(--ink-faint)";

export function ChallengePreview({
  challenge,
}: {
  challenge: EconBenchChallenge;
}) {
  const id = challenge.challenge_id;
  const caption: Record<string, string> = {
    "EB-01-OIL-SHOCK": "SRAS shifts left · inflation rises",
    "EB-02-DEBT-RECESSION": "Debt path · output gap",
    "EB-03-MONOPSONY-WAGE": "Wage floor · labour market",
    "EB-04-DEPRECIATION-JCURVE": "Currency · trade-balance path",
    "EB-05-RENT-CONTROL": "Price ceiling · shortage",
    "EB-06-RESTAURANT-INVENTORY": "Waste · stockout frontier",
    "EB-07-CARBON-POLICY": "Marginal abatement cost",
    "EB-08-BANK-RUN": "Withdrawal threshold",
    "EB-09-FLEX-WORK": "OLS · fixed-effects contrast",
    "EB-10-TRADE-WAR": "Tariff · retaliation network",
  };
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-2.5">
      <svg
        viewBox="0 0 180 58"
        className="h-14 w-full"
        role="img"
        aria-label={caption[id]}
      >
        <line
          x1="12"
          y1="48"
          x2="170"
          y2="48"
          stroke={muted}
          strokeWidth="1"
          opacity=".45"
        />
        <line
          x1="18"
          y1="54"
          x2="18"
          y2="8"
          stroke={muted}
          strokeWidth="1"
          opacity=".45"
        />
        {id === "EB-01-OIL-SHOCK" && (
          <>
            <path
              d="M25 40 C65 32 95 22 160 14"
              fill="none"
              stroke="var(--blue)"
              strokeWidth="2"
            />
            <path
              d="M25 18 C74 21 111 29 160 40"
              fill="none"
              stroke={tone}
              strokeWidth="2"
            />
            <path
              d="M35 13 C80 16 119 24 162 34"
              fill="none"
              stroke="var(--red)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <path
              d="M102 15 l6 0 m-3 -3 l3 3 -3 3"
              stroke="var(--red)"
              fill="none"
            />
          </>
        )}
        {id === "EB-02-DEBT-RECESSION" && (
          <>
            <polyline
              points="25,36 55,30 88,34 122,20 158,15"
              fill="none"
              stroke="var(--red)"
              strokeWidth="2.5"
            />
            <polyline
              points="25,40 55,43 88,37 122,31 158,27"
              fill="none"
              stroke={tone}
              strokeWidth="2.5"
            />
          </>
        )}
        {id === "EB-03-MONOPSONY-WAGE" && (
          <>
            <path
              d="M28 43 C65 37 95 28 160 10"
              fill="none"
              stroke="var(--blue)"
              strokeWidth="2"
            />
            <path
              d="M28 12 C78 18 108 27 160 44"
              fill="none"
              stroke={tone}
              strokeWidth="2"
            />
            <line
              x1="25"
              y1="28"
              x2="112"
              y2="28"
              stroke="var(--amber)"
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          </>
        )}
        {id === "EB-04-DEPRECIATION-JCURVE" && (
          <>
            <path
              d="M22 23 C55 42 78 46 103 35 S139 17 162 16"
              fill="none"
              stroke={tone}
              strokeWidth="2.5"
            />
            <line
              x1="25"
              y1="24"
              x2="165"
              y2="24"
              stroke={muted}
              strokeDasharray="3 3"
            />
          </>
        )}
        {id === "EB-05-RENT-CONTROL" && (
          <>
            <path
              d="M27 42 C70 30 106 20 160 12"
              fill="none"
              stroke="var(--blue)"
              strokeWidth="2"
            />
            <path
              d="M27 12 C75 22 115 32 160 43"
              fill="none"
              stroke={tone}
              strokeWidth="2"
            />
            <line
              x1="28"
              y1="29"
              x2="158"
              y2="29"
              stroke="var(--red)"
              strokeWidth="2"
            />
            <line
              x1="62"
              y1="25"
              x2="62"
              y2="34"
              stroke="var(--red)"
              strokeWidth="2"
            />
            <line
              x1="126"
              y1="25"
              x2="126"
              y2="34"
              stroke="var(--red)"
              strokeWidth="2"
            />
          </>
        )}
        {id === "EB-06-RESTAURANT-INVENTORY" && (
          <>
            <path
              d="M28 42 C72 13 117 13 160 42"
              fill="none"
              stroke={tone}
              strokeWidth="2.5"
            />
            <circle cx="94" cy="20" r="3.5" fill="var(--amber)" />
            <line
              x1="94"
              y1="20"
              x2="94"
              y2="48"
              stroke="var(--amber)"
              strokeDasharray="3 3"
            />
          </>
        )}
        {id === "EB-07-CARBON-POLICY" && (
          <>
            <path
              d="M26 43 C69 41 102 32 159 10"
              fill="none"
              stroke={tone}
              strokeWidth="2.5"
            />
            <line
              x1="93"
              y1="9"
              x2="93"
              y2="48"
              stroke="var(--blue)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </>
        )}
        {id === "EB-08-BANK-RUN" && (
          <>
            <rect
              x="28"
              y="18"
              width="56"
              height="22"
              rx="3"
              fill="var(--blue-soft)"
              stroke="var(--blue)"
            />
            <path
              d="M91 17 L150 17 L150 40 L91 40 Z"
              fill="var(--accent-soft)"
              stroke={tone}
            />
            <line
              x1="84"
              y1="29"
              x2="112"
              y2="29"
              stroke="var(--red)"
              strokeWidth="2.5"
            />
            <path d="M106 24 l7 5 -7 5" stroke="var(--red)" fill="none" />
          </>
        )}
        {id === "EB-09-FLEX-WORK" && (
          <>
            <line
              x1="32"
              y1="41"
              x2="82"
              y2="15"
              stroke="var(--blue)"
              strokeWidth="2.5"
            />
            <line
              x1="98"
              y1="39"
              x2="148"
              y2="20"
              stroke={tone}
              strokeWidth="2.5"
            />
            <circle cx="56" cy="29" r="3" fill="var(--blue)" />
            <circle cx="123" cy="30" r="3" fill={tone} />
          </>
        )}
        {id === "EB-10-TRADE-WAR" && (
          <>
            <circle
              cx="45"
              cy="29"
              r="8"
              fill="var(--blue-soft)"
              stroke="var(--blue)"
            />
            <circle
              cx="100"
              cy="17"
              r="8"
              fill="var(--accent-soft)"
              stroke={tone}
            />
            <circle
              cx="135"
              cy="39"
              r="8"
              fill="var(--amber-soft)"
              stroke="var(--amber)"
            />
            <line
              x1="52"
              y1="26"
              x2="92"
              y2="19"
              stroke="var(--red)"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <line
              x1="105"
              y1="23"
              x2="129"
              y2="34"
              stroke={tone}
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      <p className="mt-1 text-[9px] font-semibold text-[var(--ink-muted)]">
        {caption[id]}
      </p>
    </div>
  );
}
