import type { GovernorSnapshot } from "@/lib/types";

export function RlGovernorPanel({ rl }: { rl: GovernorSnapshot["rl"] }) {
  const qEntries = Object.entries(rl.qRow);
  const policyEntries = Object.entries(rl.policyWeights);
  const latestReward = rl.lastReward ?? 0;

  return (
    <div className="glass rounded-3xl p-6 shadow-glow">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">RL Governor</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Q-learning + policy gradient</h3>
        </div>
        <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">
          {rl.currentState}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Alpha" value={rl.alpha.toFixed(2)} />
        <Metric label="Gamma" value={rl.gamma.toFixed(2)} />
        <Metric label="Epsilon" value={rl.epsilon.toFixed(2)} />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Last reward</p>
        <p className={`mt-2 text-2xl font-bold ${latestReward >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {rl.lastReward === null ? "Waiting for next reward" : `${latestReward.toFixed(2)}`}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Positive reward means the selected squad beat IHSG, stayed resilient on a bloody day, or avoided the stop-loss trap.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Q-table row</p>
          <div className="mt-3 space-y-3">
            {qEntries.map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-200 capitalize">{key}</span>
                  <span className="text-slate-400">{value.toFixed(3)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-sky-400" style={{ width: `${Math.min(100, Math.max(0, (value + 2) * 25))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Policy weights</p>
          <div className="mt-3 space-y-3">
            {policyEntries.map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-200 capitalize">{key}</span>
                  <span className="text-slate-400">{(value * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${value * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Recent rewards</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {rl.recentRewards.length > 0 ? (
            rl.recentRewards.map((reward, index) => (
              <span
                key={`${reward}-${index}`}
                className={`rounded-full border px-3 py-1 text-xs ${reward >= 0 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-rose-400/30 bg-rose-400/10 text-rose-200"}`}
              >
                {reward.toFixed(2)}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">No completed episodes yet.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
