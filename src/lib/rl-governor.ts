import { unstable_noStore as noStore } from "next/cache";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { squadConfigs } from "@/lib/data";
import type { GovernorSnapshot, MethodologyPoint, PickRow, SquadConfig, SquadKey, SquadSnapshot } from "@/lib/types";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type PriceSnapshot = {
  lastPrice: number;
  previousClose: number;
  closes: number[];
  volumes: number[];
  changePct: number;
  rsi: number;
};

type IntradaySnapshot = {
  openPrice: number;
  currentPrice: number;
  lowFirst30: number;
  changePct: number;
};

type NewsSnapshot = {
  headlines: string[];
  matchedHeadlines: string[];
  score: number;
};

type MarketSnapshot = {
  usdIdr: number;
  ihsg: PriceSnapshot | null;
  commodity: PriceSnapshot | null;
  newsHeadlines: string[];
  prices: Map<string, PriceSnapshot>;
};

type RlEpisode = {
  timestamp: string;
  stateKey: string;
  actionSquad: SquadKey;
  ticker: string;
  entryPrice: number;
  entryIhsg: number;
  qBefore: number;
  qAfter: number;
  policyBefore: number;
  policyAfter: number;
  reward: number;
  alphaReward: number;
  consistencyBonus: number;
  drawdownPenalty: number;
  outperformancePct: number;
};

type PendingEpisode = {
  timestamp: string;
  stateKey: string;
  actionSquad: SquadKey;
  ticker: string;
  entryPrice: number;
  entryIhsg: number;
};

type RlState = {
  qTable: Partial<Record<string, Record<SquadKey, number>>>;
  policyPrefs: Record<SquadKey, number>;
  history: RlEpisode[];
  pendingEpisode: PendingEpisode | null;
  epsilon: number;
  alpha: number;
  gamma: number;
  policyLearningRate: number;
};

const REUTERS_FEEDS = [
  "https://feeds.reuters.com/reuters/businessNews",
  "https://feeds.reuters.com/reuters/marketsNews",
];

const YAHOO_TICKER_SUFFIX = ".JK";
const STATE_FILE = join(process.cwd(), "data", "governor-rl-state.json");
let memoryState: RlState | null = null;
const DEFAULT_STATE: RlState = {
  qTable: {},
  policyPrefs: {
    energy: 0,
    cpo: 0,
    banks: 0,
    ev: 0,
    speculative: 0,
  },
  history: [],
  pendingEpisode: null,
  epsilon: 0.12,
  alpha: 0.25,
  gamma: 0.9,
  policyLearningRate: 0.08,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number, min: number, max: number) {
  if (max === min) {
    return 0.5;
  }

  return clamp((value - min) / (max - min), 0, 1);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function percentChange(current: number, previous: number) {
  if (!previous) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

function calculateRsi(closes: number[], period = 14) {
  if (closes.length <= period) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let index = closes.length - period; index < closes.length; index += 1) {
    const current = closes[index];
    const previous = closes[index - 1];

    if (current === undefined || previous === undefined) {
      continue;
    }

    const delta = current - previous;

    if (delta > 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "application/json,text/plain,*/*",
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "application/rss+xml,application/xml,text/xml,*/*",
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

function extractRssHeadlines(xml: string) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items
    .map((item) => {
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
      const description =
        item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ??
        item.match(/<description>(.*?)<\/description>/)?.[1] ??
        "";

      return `${title} ${description}`.trim();
    })
    .filter(Boolean);
}

async function fetchReutersHeadlines() {
  const feeds = await Promise.all(REUTERS_FEEDS.map((feed) => fetchText(feed)));
  return feeds.flatMap((feed) => (feed ? extractRssHeadlines(feed) : [])).slice(0, 40);
}

async function fetchYahooPriceHistory(symbol: string): Promise<PriceSnapshot | null> {
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d&includePrePost=false&events=div%2Csplits`;
  const payload = await fetchJson<YahooChartResponse>(endpoint);
  const result = payload?.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close?.filter((value): value is number => typeof value === "number") ?? [];
  const volumes = result?.indicators?.quote?.[0]?.volume?.filter((value): value is number => typeof value === "number") ?? [];
  const lastPrice = result?.meta?.regularMarketPrice ?? closes.at(-1) ?? 0;
  const previousClose = result?.meta?.previousClose ?? closes.at(-2) ?? lastPrice;

  if (!lastPrice || closes.length < 2) {
    return null;
  }

  return {
    lastPrice,
    previousClose,
    closes,
    volumes,
    changePct: percentChange(lastPrice, previousClose),
    rsi: calculateRsi(closes),
  };
}

async function fetchYahooIntraday(symbol: string): Promise<IntradaySnapshot | null> {
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=false&events=div%2Csplits`;
  const payload = await fetchJson<YahooChartResponse>(endpoint);
  const result = payload?.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close?.filter((value): value is number => typeof value === "number") ?? [];
  const lows = result?.indicators?.quote?.[0]?.close?.filter((value): value is number => typeof value === "number") ?? [];
  const openPrice = result?.meta?.previousClose ?? closes[0] ?? 0;
  const currentPrice = result?.meta?.regularMarketPrice ?? closes.at(-1) ?? 0;
  const lowFirst30 = Math.min(...lows.slice(0, 6), currentPrice || Infinity);

  if (!openPrice || !currentPrice || closes.length === 0) {
    return null;
  }

  return {
    openPrice,
    currentPrice,
    lowFirst30: Number.isFinite(lowFirst30) ? lowFirst30 : currentPrice,
    changePct: percentChange(currentPrice, openPrice),
  };
}

async function fetchUsdIdrRate() {
  const payload = await fetchJson<{ rates?: { IDR?: number } }>("https://open.er-api.com/v6/latest/USD");
  return payload?.rates?.IDR ?? 0;
}

function softmax(values: Record<SquadKey, number>) {
  const entries = Object.entries(values) as Array<[SquadKey, number]>;
  const exponentials = entries.map(([, value]) => Math.exp(value));
  const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;

  return entries.reduce((accumulator, [key, value], index) => {
    accumulator[key] = exponentials[index] / total;
    return accumulator;
  }, {} as Record<SquadKey, number>);
}

function stateKeyFromMarket(usdIdr: number, ihsgChangePct: number, commodityChangePct: number) {
  const usdBucket = usdIdr >= 17000 ? "weak-usd" : usdIdr >= 16650 ? "neutral-usd" : "strong-usd";
  const ihsgBucket = ihsgChangePct <= -0.5 ? "red-ihsg" : ihsgChangePct >= 0.5 ? "green-ihsg" : "flat-ihsg";
  const commodityBucket = commodityChangePct >= 0.5 ? "strong-commodity" : commodityChangePct <= -0.5 ? "weak-commodity" : "flat-commodity";

  return `${usdBucket}|${ihsgBucket}|${commodityBucket}`;
}

function scoreHeadlines(headlines: string[], keywords: string[]) {
  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const matched = headlines.filter((headline) => lowerKeywords.some((keyword) => headline.toLowerCase().includes(keyword)));

  if (matched.length === 0) {
    return { headlines, matchedHeadlines: [], score: 0 };
  }

  return {
    headlines,
    matchedHeadlines: matched.slice(0, 3),
    score: clamp(matched.length / 4, 0, 1),
  };
}

function buildMacroAlignment(squadKey: SquadKey, usdIdr: number, commodityChangePct: number) {
  const weakRupiah = usdIdr >= 17000;
  const commodityStrength = normalize(commodityChangePct, -3, 3);

  if (squadKey === "energy") {
    return weakRupiah ? 0.8 + commodityStrength * 0.2 : 0.45 + commodityStrength * 0.15;
  }

  if (squadKey === "cpo") {
    return weakRupiah ? 0.75 + commodityStrength * 0.15 : 0.5 + commodityStrength * 0.2;
  }

  if (squadKey === "banks") {
    return weakRupiah ? 0.42 : 0.72;
  }

  if (squadKey === "ev") {
    return 0.55 + commodityStrength * 0.1;
  }

  return 0.5 + commodityStrength * 0.05;
}

function buildTechnicalScore(rsi: number, changePct: number, threshold: number) {
  const rsiFit = 1 - Math.abs(rsi - threshold) / 35;
  const momentum = normalize(changePct, -8, 8);

  return clamp(rsiFit * 0.7 + momentum * 0.3, 0, 1);
}

function ensureRow(qTable: RlState["qTable"], stateKey: string) {
  if (!qTable[stateKey]) {
    qTable[stateKey] = {
      energy: 0,
      cpo: 0,
      banks: 0,
      ev: 0,
      speculative: 0,
    };
  }

  return qTable[stateKey] as Record<SquadKey, number>;
}

async function loadRlState(): Promise<RlState> {
  if (memoryState) {
    return structuredClone(memoryState);
  }

  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<RlState>;

    return {
      ...DEFAULT_STATE,
      ...parsed,
      policyPrefs: {
        ...DEFAULT_STATE.policyPrefs,
        ...(parsed.policyPrefs ?? {}),
      },
      history: Array.isArray(parsed.history) ? parsed.history : [],
      pendingEpisode: parsed.pendingEpisode ?? null,
      qTable: parsed.qTable ?? {},
    };
  } catch {
    memoryState = structuredClone(DEFAULT_STATE);
    return structuredClone(DEFAULT_STATE);
  }
}

async function saveRlState(state: RlState) {
  memoryState = structuredClone(state);

  try {
    await mkdir(dirname(STATE_FILE), { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    memoryState = structuredClone(state);
  }
}

function buildWhyBullets(args: {
  squad: SquadConfig;
  price: PriceSnapshot;
  macroVibe: string;
  news: NewsSnapshot;
}) {
  const { squad, price, macroVibe, news } = args;

  return {
    fundamental:
      squad.key === "banks"
        ? `Macro is ${macroVibe.toLowerCase().replace(/_/g, " ")}, so deposit franchises stay more attractive when BI expectations are stable.`
        : squad.key === "energy"
          ? `Price momentum and the live commodity tape keep exporters like this squad supported.`
          : squad.key === "cpo"
            ? `Palm-linked earnings stay levered to FCPO and weather headlines.`
            : squad.key === "ev"
              ? `Policy-sensitive names are more valuable when subsidy and roadmap chatter stays active.`
              : `Corporate-action optionality is still the main fundamental edge here.`,
    technical: `Live RSI is ${price.rsi.toFixed(1)} versus the squad threshold of ${squad.rsiThreshold}; price change is ${formatPercent(price.changePct)} over the latest session.`,
    sentiment:
      news.matchedHeadlines.length > 0
        ? `News filter caught ${news.matchedHeadlines.length} relevant Reuters headlines, including "${news.matchedHeadlines[0]}".`
        : `No strong Reuters keyword cluster yet, so sentiment is driven more by the tape than the headline stream.`,
  };
}

function qValueToScore(qValue: number) {
  return normalize(qValue, -2, 2);
}

function buildPick(args: {
  squad: SquadConfig;
  ticker: string;
  price: PriceSnapshot;
  news: NewsSnapshot;
  macroVibe: string;
  macroAlignment: number;
  technicalScore: number;
  newsScore: number;
  qValue: number;
  policyWeight: number;
}) : PickRow {
  const { squad, ticker, price, news, macroVibe, macroAlignment, technicalScore, newsScore, qValue, policyWeight } = args;
  const trustScore = Math.round(clamp(35 + macroAlignment * 18 + technicalScore * 18 + newsScore * 10 + qValueToScore(qValue) * 12 + policyWeight * 7, 0, 100));
  const expectedEdge = `${formatPercent((trustScore - 50) / 20)} vs. IHSG if ${macroVibe === "Weak_Rupiah" ? "Rupiah weakness persists" : "macro conditions hold"}`;

  return {
    ticker,
    squad: squad.name,
    trustScore,
    expectedEdge,
    stopLoss: "-2.0% hard stop in first 30 minutes",
    price: price.lastPrice,
    rsi: price.rsi,
    changePct: price.changePct,
    why: buildWhyBullets({ squad, price, macroVibe, news }),
  };
}

function updatePolicyPrefs(policyPrefs: RlState["policyPrefs"], actionSquad: SquadKey, reward: number, baseline: number, policyWeight: number) {
  const advantage = reward - baseline;
  const step = DEFAULT_STATE.policyLearningRate * advantage;

  return {
    ...policyPrefs,
    [actionSquad]: policyPrefs[actionSquad] + step * (1 - policyWeight),
  };
}

function updateQValue(currentValue: number, reward: number, nextBestValue: number, alpha: number, gamma: number) {
  return currentValue + alpha * (reward + gamma * nextBestValue - currentValue);
}

function evaluatePendingEpisode(args: {
  state: RlState;
  currentStateKey: string;
  ihsgChangePct: number;
  pendingIntraday: IntradaySnapshot | null;
  currentPrices: Map<string, PriceSnapshot>;
  currentIhsg: PriceSnapshot | null;
}) {
  const { state, currentStateKey, ihsgChangePct, pendingIntraday, currentPrices, currentIhsg } = args;
  const pending = state.pendingEpisode;

  if (!pending) {
    return { reward: null, updatedState: state };
  }

  const entryPrice = pending.entryPrice;
  const currentPrice = currentPrices.get(pending.ticker)?.lastPrice ?? entryPrice;
  const currentReturn = percentChange(currentPrice, entryPrice);
  const entryIhsg = pending.entryIhsg;
  const ihsgReturn = currentIhsg ? percentChange(currentIhsg.lastPrice, entryIhsg) : ihsgChangePct;
  const outperformancePct = currentReturn - ihsgReturn;
  const alphaReward = outperformancePct > 0 ? 1 : -1;

  const squad = squadConfigs.find((item) => item.key === pending.actionSquad);
  const squadTickers = squad?.tickers ?? [pending.ticker];
  const allSquadGreen = squadTickers.every((ticker) => (currentPrices.get(ticker)?.changePct ?? 0) > 0);
  const consistencyBonus = ihsgReturn < 0 && allSquadGreen ? 0.5 : 0;

  const drawdownPenalty = pendingIntraday && pendingIntraday.lowFirst30 <= entryPrice * 0.98 ? -1.5 : 0;
  const reward = alphaReward + consistencyBonus + drawdownPenalty;

  const qRow = ensureRow(state.qTable, pending.stateKey);
  const currentQ = qRow[pending.actionSquad];
  const nextQRow = ensureRow(state.qTable, currentStateKey);
  const nextBestValue = Math.max(...Object.values(nextQRow));
  const qAfter = updateQValue(currentQ, reward, nextBestValue, state.alpha, state.gamma);
  qRow[pending.actionSquad] = qAfter;

  const historySlice = state.history.slice(-10);
  const baseline = historySlice.length > 0 ? historySlice.reduce((sum, item) => sum + item.reward, 0) / historySlice.length : 0;
  const policyWeights = softmax(state.policyPrefs);
  const policyBefore = policyWeights[pending.actionSquad];
  const policyPrefsAfter = updatePolicyPrefs(state.policyPrefs, pending.actionSquad, reward, baseline, policyBefore);
  const policyAfterWeights = softmax(policyPrefsAfter);

  const nextHistory: RlEpisode[] = [
    ...state.history,
    {
      timestamp: new Date().toISOString(),
      stateKey: pending.stateKey,
      actionSquad: pending.actionSquad,
      ticker: pending.ticker,
      entryPrice,
      entryIhsg,
      qBefore: currentQ,
      qAfter,
      policyBefore,
      policyAfter: policyAfterWeights[pending.actionSquad],
      reward,
      alphaReward,
      consistencyBonus,
      drawdownPenalty,
      outperformancePct,
    },
  ].slice(-40);

  return {
    reward,
    updatedState: {
      ...state,
      qTable: state.qTable,
      policyPrefs: policyPrefsAfter,
      history: nextHistory,
      pendingEpisode: null,
    },
  };
}

function buildMarketContext(usdIdr: number, ihsg: PriceSnapshot | null, commodity: PriceSnapshot | null) {
  const ihsgChangePct = ihsg?.changePct ?? 0;
  const commodityChangePct = commodity?.changePct ?? 0;
  const macroVibe = usdIdr >= 17000 ? "Weak_Rupiah" : "Stable_Rupiah";
  const ihsgTrend = ihsgChangePct >= 0 ? `IHSG up ${ihsgChangePct.toFixed(1)}% on the latest session` : `IHSG down ${Math.abs(ihsgChangePct).toFixed(1)}% on the latest session`;
  const commodityTrend = commodityChangePct >= 0 ? `Commodity proxy up ${commodityChangePct.toFixed(1)}%` : `Commodity proxy down ${Math.abs(commodityChangePct).toFixed(1)}%`;

  return {
    usdIdr,
    ihsgTrend,
    commodityIndex: commodity ? commodityTrend : "Commodity proxy unavailable",
    macroVibe,
    ihsgChangePct,
    commodityChangePct,
  };
}

async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const [usdIdr, ihsg, commodity, newsHeadlines, prices] = await Promise.all([
    fetchUsdIdrRate(),
    fetchYahooPriceHistory("^JKSE"),
    fetchYahooPriceHistory("DBC"),
    fetchReutersHeadlines(),
    Promise.all(squadConfigs.flatMap((squad) => squad.tickers.map(async (ticker) => [ticker, await fetchYahooPriceHistory(`${ticker}${YAHOO_TICKER_SUFFIX}`)] as const))),
  ]);

  const priceMap = new Map<string, PriceSnapshot>();
  for (const [ticker, price] of prices) {
    if (price) {
      priceMap.set(ticker, price);
    }
  }

  return {
    usdIdr,
    ihsg,
    commodity,
    newsHeadlines,
    prices: priceMap,
  };
}

function buildSquadSnapshot(args: {
  squad: SquadConfig;
  ticker: string;
  price: PriceSnapshot;
  news: NewsSnapshot;
  macroVibe: string;
  macroAlignment: number;
  technicalScore: number;
  newsScore: number;
  qValue: number;
  policyWeight: number;
  pick: PickRow;
}): SquadSnapshot {
  const { squad, price, macroAlignment, technicalScore, newsScore, qValue, policyWeight, pick } = args;
  const rlScore = clamp(0.35 * macroAlignment + 0.25 * technicalScore + 0.15 * newsScore + 0.15 * qValueToScore(qValue) + 0.1 * policyWeight, 0, 1);
  const trust = Math.round(45 + rlScore * 50);
  const winRate = clamp(0.42 + trust / 250, 0.38, 0.76);

  return {
    ...squad,
    trust,
    winRate,
    qValue,
    policyWeight,
    rlScore: Math.round(rlScore * 100),
    catalysts: args.news.matchedHeadlines.slice(0, 2),
    headwinds: price.changePct < 0 ? ["Price is fading relative to the recent range"] : [],
    topTicker: pick.ticker,
    scoreBreakdown: {
      macro: Math.round(macroAlignment * 100),
      technical: Math.round(technicalScore * 100),
      news: Math.round(newsScore * 100),
      qLearning: Math.round(qValueToScore(qValue) * 100),
      policy: Math.round(policyWeight * 100),
    },
  };
}

export async function getGovernorSnapshot(): Promise<GovernorSnapshot> {
  noStore();

  const state = await loadRlState();
  const market = await fetchMarketSnapshot();
  const marketContext = buildMarketContext(market.usdIdr, market.ihsg, market.commodity);
  const currentStateKey = stateKeyFromMarket(marketContext.usdIdr, marketContext.ihsgChangePct, marketContext.commodityChangePct);

  const pendingIntraday = state.pendingEpisode ? await fetchYahooIntraday(`${state.pendingEpisode.ticker}${YAHOO_TICKER_SUFFIX}`) : null;
  const currentIhsgIntraday = state.pendingEpisode ? await fetchYahooIntraday("^JKSE") : null;

  const postUpdate = evaluatePendingEpisode({
    state,
    currentStateKey,
    ihsgChangePct: marketContext.ihsgChangePct,
    pendingIntraday,
    currentPrices: market.prices,
    currentIhsg: market.ihsg,
  });

  const updatedState = postUpdate.updatedState;
  const policyWeights = softmax(updatedState.policyPrefs);
  const qRow = ensureRow(updatedState.qTable, currentStateKey);
  const availableNews = market.newsHeadlines.length > 0 ? market.newsHeadlines : ["Reuters feed unavailable; running on price-only fallback"];

  const picks: PickRow[] = [];
  const squads: SquadSnapshot[] = [];

  for (const squad of squadConfigs) {
    const squadPrices = squad.tickers
      .map((ticker) => ({ ticker, price: market.prices.get(ticker) }))
      .filter((entry): entry is { ticker: string; price: PriceSnapshot } => Boolean(entry.price));

    const fallbackPrice = market.prices.get(squad.tickers[0]) ?? {
      lastPrice: 0,
      previousClose: 0,
      closes: [0, 0],
      volumes: [0, 0],
      changePct: 0,
      rsi: 50,
    };

    const news = scoreHeadlines(availableNews, squad.keywords);
    const qValue = qRow[squad.key] ?? 0;
    const policyWeight = policyWeights[squad.key];
    const macroAlignment = buildMacroAlignment(squad.key, marketContext.usdIdr, marketContext.commodityChangePct);

    let bestPick: PickRow | null = null;
    let bestScore = -Infinity;
    let bestPrice = fallbackPrice;

    for (const { ticker, price } of squadPrices.length > 0 ? squadPrices : [{ ticker: squad.tickers[0], price: fallbackPrice }]) {
      const technicalScore = buildTechnicalScore(price.rsi, price.changePct, squad.rsiThreshold);
      const tickerBonus = normalize(price.changePct, -8, 8) * 0.1 + normalize(price.rsi, 30, 85) * 0.05;
      const score = 0.35 * macroAlignment + 0.25 * technicalScore + 0.15 * news.score + 0.15 * qValueToScore(qValue) + 0.1 * policyWeight + tickerBonus;

      if (score > bestScore) {
        bestScore = score;
        bestPrice = price;
        bestPick = buildPick({
          squad,
          ticker,
          price,
          news,
          macroVibe: marketContext.macroVibe,
          macroAlignment,
          technicalScore,
          newsScore: news.score,
          qValue,
          policyWeight,
        });
      }
    }

    if (bestPick) {
      picks.push(bestPick);
      squads.push(
        buildSquadSnapshot({
          squad,
          ticker: bestPick.ticker,
          price: bestPrice,
          news,
          macroVibe: marketContext.macroVibe,
          macroAlignment,
          technicalScore: buildTechnicalScore(bestPrice.rsi, bestPrice.changePct, squad.rsiThreshold),
          newsScore: news.score,
          qValue,
          policyWeight,
          pick: bestPick,
        }),
      );
    }
  }

  const methodologySeries: MethodologyPoint[] = [
    { label: "Fundamental Only", value: Math.round(clamp(45 + (marketContext.macroVibe === "Weak_Rupiah" ? 4 : 0) + marketContext.commodityChangePct * 2, 10, 95)), color: "#64748b" },
    { label: "Technical Only", value: Math.round(clamp(50 + marketContext.ihsgChangePct * 4 + 10, 10, 95)), color: "#60a5fa" },
    { label: "RL Optimized", value: Math.round(clamp(60 + squads.reduce((sum, squad) => sum + squad.trust, 0) / Math.max(squads.length, 1) / 2, 10, 98)), color: "#2dd4bf" },
  ];

  const rewardHistory = updatedState.history.slice(-8).map((item) => item.reward);

  await saveRlState({
    ...updatedState,
    pendingEpisode: picks[0]
      ? {
          timestamp: new Date().toISOString(),
          stateKey: currentStateKey,
          actionSquad: squads[0]?.key ?? "energy",
          ticker: picks[0].ticker,
          entryPrice: picks[0].price,
          entryIhsg: market.ihsg?.lastPrice ?? picks[0].price,
        }
      : null,
  });

  return {
    generatedAt: new Date().toISOString(),
    marketContext: {
      usdIdr: marketContext.usdIdr ? `Rp ${marketContext.usdIdr.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "Unavailable",
      ihsgTrend: marketContext.ihsgTrend,
      commodityIndex: marketContext.commodityIndex,
      macroVibe: marketContext.macroVibe,
      notes: [
        `State bucket: ${currentStateKey}`,
        `Latest reward: ${updatedState.history.at(-1)?.reward?.toFixed(2) ?? "pending"}`,
        `Data stack: Yahoo Finance chart API, open ER exchange rates, Reuters RSS headlines.`,
      ],
    },
    picks,
    squads,
    methodologySeries,
    rl: {
      currentState: currentStateKey,
      qRow,
      policyWeights,
      epsilon: updatedState.epsilon,
      alpha: updatedState.alpha,
      gamma: updatedState.gamma,
      lastReward: updatedState.history.at(-1)?.reward ?? null,
      recentRewards: rewardHistory,
      pendingEpisode: updatedState.pendingEpisode,
      history: updatedState.history.slice(-8).map((item) => ({
        timestamp: item.timestamp,
        stateKey: item.stateKey,
        actionSquad: item.actionSquad,
        reward: item.reward,
        alphaReward: item.alphaReward,
        consistencyBonus: item.consistencyBonus,
        drawdownPenalty: item.drawdownPenalty,
        outperformancePct: item.outperformancePct,
      })),
    },
    sources: [
      ...REUTERS_FEEDS,
      "https://open.er-api.com/v6/latest/USD",
      "https://query1.finance.yahoo.com/v8/finance/chart/^JKSE",
      "https://query1.finance.yahoo.com/v8/finance/chart/DBC",
    ],
  };
}
