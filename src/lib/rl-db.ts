import { Pool } from "pg";

import type { SquadKey } from "@/lib/types";

export type PersistedRlEpisode = {
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

export type PersistedRlState = {
  qTable: Record<string, Record<SquadKey, number>>;
  policyPrefs: Record<SquadKey, number>;
  history: PersistedRlEpisode[];
  pendingEpisode: {
    timestamp: string;
    stateKey: string;
    actionSquad: SquadKey;
    ticker: string;
    entryPrice: number;
    entryIhsg: number;
  } | null;
  epsilon: number;
  alpha: number;
  gamma: number;
  policyLearningRate: number;
};

const STATE_ID = "rl-governor-state";
let pool: Pool | null = null;

function getPool() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return null;
  }

  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false } });
  }

  return pool;
}

async function ensureSchema(client: Pool | import("pg").PoolClient) {
  await client.query(`
    create table if not exists rl_governor_state (
      id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    );
  `);
}

function toDefaultState(defaultState: PersistedRlState): PersistedRlState {
  return structuredClone(defaultState);
}

export async function loadState(defaultState: PersistedRlState): Promise<PersistedRlState> {
  const db = getPool();

  if (!db) {
    return toDefaultState(defaultState);
  }

  const client = await db.connect();
  try {
    await ensureSchema(client);
    const result = await client.query<{ payload: PersistedRlState }>("select payload from rl_governor_state where id = $1", [STATE_ID]);

    if (result.rowCount === 0 || !result.rows[0]?.payload) {
      return toDefaultState(defaultState);
    }

    return {
      ...defaultState,
      ...result.rows[0].payload,
      qTable: result.rows[0].payload.qTable ?? defaultState.qTable,
      policyPrefs: {
        ...defaultState.policyPrefs,
        ...(result.rows[0].payload.policyPrefs ?? {}),
      },
      history: result.rows[0].payload.history ?? [],
      pendingEpisode: result.rows[0].payload.pendingEpisode ?? null,
    };
  } finally {
    client.release();
  }
}

export async function saveState(state: PersistedRlState) {
  const db = getPool();

  if (!db) {
    return;
  }

  const client = await db.connect();
  try {
    await ensureSchema(client);
    await client.query(
      `
      insert into rl_governor_state (id, payload, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (id)
      do update set payload = excluded.payload, updated_at = excluded.updated_at
      `,
      [STATE_ID, JSON.stringify(state)],
    );
  } finally {
    client.release();
  }
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}
