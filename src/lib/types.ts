export type SquadKey =
  | "energy"
  | "cpo"
  | "banks"
  | "ev"
  | "speculative";

export type SquadConfig = {
  key: SquadKey;
  name: string;
  tickers: string[];
  vibeBoost: string;
  trigger: string;
  rsiThreshold: number;
  keywords: string[];
  color: string;
};

export type PickReason = {
  fundamental: string;
  technical: string;
  sentiment: string;
};

export type PickRow = {
  ticker: string;
  squad: string;
  trustScore: number;
  expectedEdge: string;
  stopLoss: string;
  price: number;
  rsi: number;
  changePct: number;
  why: PickReason;
};

export type SquadSnapshot = SquadConfig & {
  trust: number;
  winRate: number;
  qValue: number;
  policyWeight: number;
  rlScore: number;
  catalysts: string[];
  headwinds: string[];
  topTicker: string;
  scoreBreakdown: {
    macro: number;
    technical: number;
    news: number;
    qLearning: number;
    policy: number;
  };
};

export type MethodologyPoint = {
  label: string;
  value: number;
  color: string;
};

export type GovernorSnapshot = {
  generatedAt: string;
  marketContext: {
    usdIdr: string;
    ihsgTrend: string;
    commodityIndex: string;
    macroVibe: string;
    notes: string[];
  };
  picks: PickRow[];
  squads: SquadSnapshot[];
  methodologySeries: MethodologyPoint[];
  rl: {
    currentState: string;
    qRow: Record<string, number>;
    policyWeights: Record<string, number>;
    epsilon: number;
    alpha: number;
    gamma: number;
    lastReward: number | null;
    recentRewards: number[];
    pendingEpisode: {
      stateKey: string;
      actionSquad: SquadKey;
      ticker: string;
      entryPrice: number;
      entryIhsg: number;
      timestamp: string;
    } | null;
    history: Array<{
      timestamp: string;
      stateKey: string;
      actionSquad: SquadKey;
      reward: number;
      alphaReward: number;
      consistencyBonus: number;
      drawdownPenalty: number;
      outperformancePct: number;
    }>;
  };
  sources: string[];
};