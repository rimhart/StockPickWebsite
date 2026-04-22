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

export type RlDbUsageMetrics = {
  enabled: boolean;
  stateRowExists: boolean;
  stateUpdatedAt: string | null;
  tableSizeBytes: number | null;
  databaseSizeBytes: number | null;
  configuredLimitBytes: number | null;
  usagePercentOfLimit: number | null;
  alertLevel: "ok" | "warning" | "critical" | "unavailable";
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
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

function parseNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLimitConfig() {
  const limitMb = parseNumberEnv("RL_DB_STORAGE_LIMIT_MB", 256);
  const warningThresholdPercent = parseNumberEnv("RL_DB_ALERT_WARN_PERCENT", 75);
  const criticalThresholdPercent = parseNumberEnv("RL_DB_ALERT_CRITICAL_PERCENT", 90);

  return {
    configuredLimitBytes: Math.max(1, limitMb) * 1024 * 1024,
    warningThresholdPercent: Math.max(1, warningThresholdPercent),
    criticalThresholdPercent: Math.max(1, criticalThresholdPercent),
  };
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

export async function getUsageMetrics(): Promise<RlDbUsageMetrics> {
  const db = getPool();
  const limits = getLimitConfig();

  if (!db) {
    return {
      enabled: false,
      stateRowExists: false,
      stateUpdatedAt: null,
      tableSizeBytes: null,
      databaseSizeBytes: null,
      configuredLimitBytes: limits.configuredLimitBytes,
      usagePercentOfLimit: null,
      alertLevel: "unavailable",
      warningThresholdPercent: limits.warningThresholdPercent,
      criticalThresholdPercent: limits.criticalThresholdPercent,
    };
  }

  const client = await db.connect();
  try {
    await ensureSchema(client);

    const sizeResult = await client.query<{
      table_size_bytes: string | number;
      database_size_bytes: string | number;
    }>(
      `
      select
        pg_total_relation_size('rl_governor_state') as table_size_bytes,
        pg_database_size(current_database()) as database_size_bytes
      `,
    );

    const rowStateResult = await client.query<{ updated_at: Date }>(
      "select updated_at from rl_governor_state where id = $1",
      [STATE_ID],
    );

    const tableSizeBytes = Number(sizeResult.rows[0]?.table_size_bytes ?? 0);
    const databaseSizeBytes = Number(sizeResult.rows[0]?.database_size_bytes ?? 0);
    const usagePercentOfLimit = (databaseSizeBytes / limits.configuredLimitBytes) * 100;

    const alertLevel =
      usagePercentOfLimit >= limits.criticalThresholdPercent
        ? "critical"
        : usagePercentOfLimit >= limits.warningThresholdPercent
          ? "warning"
          : "ok";

    return {
      enabled: true,
      stateRowExists: (rowStateResult.rowCount ?? 0) > 0,
      stateUpdatedAt: rowStateResult.rows[0]?.updated_at?.toISOString() ?? null,
      tableSizeBytes,
      databaseSizeBytes,
      configuredLimitBytes: limits.configuredLimitBytes,
      usagePercentOfLimit,
      alertLevel,
      warningThresholdPercent: limits.warningThresholdPercent,
      criticalThresholdPercent: limits.criticalThresholdPercent,
    };
  } catch {
    return {
      enabled: true,
      stateRowExists: false,
      stateUpdatedAt: null,
      tableSizeBytes: null,
      databaseSizeBytes: null,
      configuredLimitBytes: limits.configuredLimitBytes,
      usagePercentOfLimit: null,
      alertLevel: "unavailable",
      warningThresholdPercent: limits.warningThresholdPercent,
      criticalThresholdPercent: limits.criticalThresholdPercent,
    };
  } finally {
    client.release();
  }
}
