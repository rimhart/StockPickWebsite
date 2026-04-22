import { AutoRefresh } from "@/components/AutoRefresh";
import { getRlAdminSnapshot } from "@/lib/rl-admin";

export const dynamic = "force-dynamic";

function formatBytes(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  const units = ["B", "KB", "MB", "GB"];
  let current = value;
  let unitIndex = 0;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  return `${current.toFixed(2)} ${units[unitIndex]}`;
}

function alertClass(level: "ok" | "warning" | "critical" | "unavailable") {
  if (level === "critical") {
    return "border-rose-400/40 bg-rose-500/10 text-rose-200";
  }

  if (level === "warning") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-200";
  }

  if (level === "ok") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
  }

  return "border-slate-600 bg-slate-800/50 text-slate-300";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requiredToken = process.env.ADMIN_TOKEN;
  const providedToken = typeof params.token === "string" ? params.token : Array.isArray(params.token) ? params.token[0] : "";

  if (requiredToken && providedToken !== requiredToken) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="glass rounded-3xl p-8 shadow-glow">
          <h1 className="text-2xl font-semibold text-white">Unauthorized</h1>
          <p className="mt-3 text-sm text-slate-300">Provide a valid token in the URL query. Example: /admin?token=YOUR_ADMIN_TOKEN</p>
        </div>
      </main>
    );
  }

  const snapshot = await getRlAdminSnapshot();
  const usagePercent = snapshot.usage.usagePercentOfLimit;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AutoRefresh seconds={30} />
      <div className="glass rounded-3xl p-6 shadow-glow">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Admin Monitor</p>
            <h1 className="mt-2 text-3xl font-bold text-white">RL State and Postgres Limit Monitor</h1>
            <p className="mt-2 text-sm text-slate-300">This page auto-refreshes every 30 seconds. Last snapshot: {new Date(snapshot.generatedAt).toLocaleString()}</p>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs ${alertClass(snapshot.usage.alertLevel)}`}>
            Usage Alert: {snapshot.usage.alertLevel.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card label="DB enabled" value={snapshot.usage.enabled ? "Yes" : "No"} />
        <Card label="Database size" value={formatBytes(snapshot.usage.databaseSizeBytes)} />
        <Card label="Configured limit" value={formatBytes(snapshot.usage.configuredLimitBytes)} />
        <Card label="Usage of limit" value={usagePercent === null ? "N/A" : `${usagePercent.toFixed(2)}%`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="glass rounded-3xl p-6 shadow-glow">
          <h2 className="text-xl font-semibold text-white">Reward History (Latest 20)</h2>
          <div className="mt-4 space-y-2">
            {snapshot.recentRewards.length === 0 ? (
              <p className="text-sm text-slate-400">No episodes yet.</p>
            ) : (
              snapshot.recentRewards.map((item) => (
                <div key={`${item.timestamp}-${item.actionSquad}`} className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-slate-200">{item.actionSquad.toUpperCase()} @ {item.stateKey}</span>
                    <span className={item.reward >= 0 ? "text-emerald-300" : "text-rose-300"}>{item.reward.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="glass rounded-3xl p-6 shadow-glow">
          <h2 className="text-xl font-semibold text-white">Current RL State</h2>
          <div className="mt-4 space-y-3">
            <DataLine label="Pending Episode" value={snapshot.state.pendingEpisode ? "Yes" : "No"} />
            <DataLine label="History entries" value={String(snapshot.state.history.length)} />
            <DataLine label="Alpha" value={snapshot.state.alpha.toFixed(2)} />
            <DataLine label="Gamma" value={snapshot.state.gamma.toFixed(2)} />
            <DataLine label="Epsilon" value={snapshot.state.epsilon.toFixed(2)} />
            <DataLine label="Warn threshold" value={`${snapshot.usage.warningThresholdPercent}%`} />
            <DataLine label="Critical threshold" value={`${snapshot.usage.criticalThresholdPercent}%`} />
            <DataLine label="State row present" value={snapshot.usage.stateRowExists ? "Yes" : "No"} />
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-glow">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function DataLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}
