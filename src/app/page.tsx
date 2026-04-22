export const dynamic = "force-dynamic";

import { MethodologyChart } from "@/components/MethodologyChart";
import { PickActions } from "@/components/PickActions";
import { RlGovernorPanel } from "@/components/RlGovernorPanel";
import { SectorHeatmap } from "@/components/SectorHeatmap";
import { getGovernorSnapshot } from "@/lib/rl-governor";

export default async function HomePage() {
  const snapshot = await getGovernorSnapshot();
  const topSquad = snapshot.squads.reduce((best, current) => (current.trust > best.trust ? current : best), snapshot.squads[0]);

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-20" />
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl animate-float" />
      <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl animate-pulseSlow" />

      <section className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="glass rounded-[2rem] border border-slate-700/70 p-6 shadow-glow md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">BSJP Daily Pick Engine</p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                5 stock picks, grouped by squad, weighted by a Meta-Governor RL layer.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Level 0 ingests price, volume, and news. Level 1 squad agents score local setup quality.
                Level 2 supervises capital allocation by learning which sector behaves best under the current macro vibe.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[340px] lg:grid-cols-1">
              <Stat label="Macro vibe" value={snapshot.marketContext.macroVibe} />
              <Stat label="Top trust squad" value={topSquad.name} />
              <Stat label="USD / IDR" value={snapshot.marketContext.usdIdr} />
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <InfoCard label="IHSG trend" value={snapshot.marketContext.ihsgTrend} />
            <InfoCard label="Commodity tape" value={snapshot.marketContext.commodityIndex} />
            <InfoCard label="Governor rule" value={snapshot.marketContext.notes[0] ?? "Live governor active"} />
          </div>

          <PickActions />
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="glass rounded-3xl p-6 shadow-glow">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Today&apos;s 5 BSJP Picks</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Why column included for every pick</h2>
              </div>
              <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">
                RL-optimized basket
              </div>
            </div>

            <div className="space-y-4">
              {snapshot.picks.map((pick) => (
                <article key={pick.ticker} className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">{pick.ticker}</h3>
                        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                          {pick.squad}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{pick.expectedEdge}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/80 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Trust</p>
                      <p className="mt-1 text-2xl font-bold text-white">{pick.trustScore}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-slate-700 px-2.5 py-1">Price {pick.price.toFixed(2)}</span>
                    <span className="rounded-full border border-slate-700 px-2.5 py-1">RSI {pick.rsi.toFixed(1)}</span>
                    <span className="rounded-full border border-slate-700 px-2.5 py-1">Session {pick.changePct.toFixed(1)}%</span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <WhyPill title="Fundamental" text={pick.why.fundamental} />
                    <WhyPill title="Technical" text={pick.why.technical} />
                    <WhyPill title="Sentiment" text={pick.why.sentiment} />
                  </div>

                  <p className="mt-3 text-xs text-slate-400">Stop loss policy: {pick.stopLoss}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <SectorHeatmap squads={snapshot.squads} generatedAt={snapshot.generatedAt} />
            <RlGovernorPanel rl={snapshot.rl} />
            <MethodologyChart series={snapshot.methodologySeries} />
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          {snapshot.squads.map((squad) => (
            <div key={squad.key} className="glass rounded-3xl p-5 shadow-glow">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{squad.key}</p>
              <h3 className="mt-3 text-lg font-semibold text-white">{squad.name}</h3>
              <p className="mt-2 text-sm text-slate-300">{squad.vibeBoost}</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-400">Trust score</span>
                <span className="font-semibold text-white">{squad.trust}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-800">
                <div className={`h-2 rounded-full bg-gradient-to-r ${squad.color}`} style={{ width: `${squad.trust}%` }} />
              </div>
              <p className="mt-3 text-xs text-slate-500">Historical win rate: {(squad.winRate * 100).toFixed(0)}%</p>
              <p className="mt-2 text-xs text-slate-500">Top ticker: {squad.topTicker}</p>
              <p className="mt-2 text-xs text-slate-500">Macro {squad.scoreBreakdown.macro} / Tech {squad.scoreBreakdown.technical} / News {squad.scoreBreakdown.news}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-slate-700/70 bg-slate-950/40 p-6 text-sm text-slate-300 shadow-glow">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Live sources</p>
              <p className="mt-2">{snapshot.sources.join(" | ")}</p>
            </div>
            <p className="text-slate-400">The API route mirrors this same snapshot server-side at /api/governor.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function WhyPill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-3">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{text}</p>
    </div>
  );
}