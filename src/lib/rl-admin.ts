import { unstable_noStore as noStore } from "next/cache";

import { getUsageMetrics, loadState } from "@/lib/rl-db";
import type { PersistedRlState, RlDbUsageMetrics } from "@/lib/rl-db";

function getDefaultState(): PersistedRlState {
  return {
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
}

export type RlAdminSnapshot = {
  generatedAt: string;
  state: PersistedRlState;
  usage: RlDbUsageMetrics;
  recentRewards: Array<{
    timestamp: string;
    reward: number;
    stateKey: string;
    actionSquad: string;
  }>;
};

export async function getRlAdminSnapshot(): Promise<RlAdminSnapshot> {
  noStore();

  const [state, usage] = await Promise.all([
    loadState(getDefaultState()),
    getUsageMetrics(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    state,
    usage,
    recentRewards: state.history.slice(-20).map((episode) => ({
      timestamp: episode.timestamp,
      reward: episode.reward,
      stateKey: episode.stateKey,
      actionSquad: episode.actionSquad,
    })),
  };
}
