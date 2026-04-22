import type { MethodologyPoint } from "@/lib/types";

export function MethodologyChart({ series }: { series: MethodologyPoint[] }) {
  const maxValue = Math.max(...series.map((item) => item.value));

  return (
    <div className="glass rounded-3xl p-6 shadow-glow">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Methodology Battle</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Fundamental vs Technical vs RL</h3>
        </div>
        <div className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          Live comparative edge
        </div>
      </div>

      <div className="space-y-4">
        {series.map((item) => {
          const width = `${(item.value / maxValue) * 100}%`;

          return (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-200">{item.label}</span>
                <span className="text-slate-400">{item.value}% win-rate proxy</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800/90">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width, background: item.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}