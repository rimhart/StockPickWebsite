import type { SquadSnapshot } from "@/lib/types";

export function SectorHeatmap({ squads, generatedAt }: { squads: SquadSnapshot[]; generatedAt: string }) {
  return (
    <div className="glass rounded-3xl p-6 shadow-glow">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Sector Heatmap</p>
          <h3 className="mt-2 text-xl font-semibold text-white">RL Trust Score by Squad</h3>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
          Updated {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {squads.map((squad) => (
          <div key={squad.key} className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">{squad.name}</p>
                <p className="mt-1 text-xs text-slate-400">{squad.tickers.join(" · ")}</p>
              </div>
              <div className={`rounded-full bg-gradient-to-r ${squad.color} px-3 py-1 text-xs font-semibold text-slate-950`}>
                {squad.trust}
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-800">
              <div
                className={`h-2 rounded-full bg-gradient-to-r ${squad.color}`}
                style={{ width: `${squad.trust}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-300">{squad.trigger}</p>
            <p className="mt-2 text-xs text-slate-500">{squad.catalysts.length > 0 ? squad.catalysts.join(" · ") : "No strong matched headlines yet"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}