import type { MethodologyPoint, SquadConfig } from "@/lib/types";

export const squadConfigs: SquadConfig[] = [
  {
    key: "energy",
    name: "Energy / Coal Squad",
    tickers: ["ADRO", "PTRO", "BUMI"],
    vibeBoost: "+10% conviction on weak Rupiah / firm Brent",
    trigger: "Coal momentum, USD/IDR breakout, Brent strength",
    rsiThreshold: 80,
    keywords: ["coal", "brent", "oil", "energy", "rupiah", "usd/idr"],
    color: "from-amber-300 to-orange-500",
  },
  {
    key: "cpo",
    name: "CPO Squad",
    tickers: ["LSIP", "AALI", "BWPT"],
    vibeBoost: "+10% conviction when FCPO trend and weather tailwind align",
    trigger: "FCPO futures, El Nino / La Nina, export levy noise",
    rsiThreshold: 80,
    keywords: ["palm", "palm oil", "fcpo", "malaysia", "el nino", "la nina", "weather"],
    color: "from-emerald-300 to-lime-500",
  },
  {
    key: "banks",
    name: "Big Bank Squad",
    tickers: ["BBRI", "BMRI", "BBNI"],
    vibeBoost: "Conservative entries when BI rate and foreign flow stabilize",
    trigger: "BI-7DRR, net buy / sell, Rupiah stability",
    rsiThreshold: 60,
    keywords: ["bank indonesia", "bi rate", "rupiah", "foreign flow", "net buy", "net sell", "bank"],
    color: "from-sky-300 to-cyan-500",
  },
  {
    key: "ev",
    name: "EV & Infras Squad",
    tickers: ["VKTR", "BRPT", "WIFI"],
    vibeBoost: "Momentum lift on policy catalysts and ESG inflows",
    trigger: "Subsidies, roadmap updates, ESG capital rotation",
    rsiThreshold: 55,
    keywords: ["ev", "electric vehicle", "subsidy", "roadmap", "esg", "infrastructure", "battery"],
    color: "from-fuchsia-300 to-indigo-500",
  },
  {
    key: "speculative",
    name: "Alpha Speculative Squad",
    tickers: ["INET", "IRSX"],
    vibeBoost: "High beta only when action flow confirms accumulation",
    trigger: "Corporate actions, M&A, rights issues, bandarmology",
    rsiThreshold: 50,
    keywords: ["rights issue", "merger", "acquisition", "takeover", "corporate action", "broker", "accumulation"],
    color: "from-rose-300 to-red-500",
  },
];

export const methodologySeries: MethodologyPoint[] = [
  { label: "Fundamental Only", value: 58, color: "#64748b" },
  { label: "Technical Only", value: 69, color: "#60a5fa" },
  { label: "RL Optimized", value: 82, color: "#2dd4bf" },
];
