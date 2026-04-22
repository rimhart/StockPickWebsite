"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function PickActions() {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  async function handleCheckNow() {
    setMessage("Refreshing picks...");
    startTransition(() => {
      router.refresh();
    });
    setTimeout(() => setMessage("Updated with latest market snapshot."), 800);
  }

  async function handleRestartRl() {
    setMessage("Restarting RL state...");

    try {
      const response = await fetch("/api/governor/restart", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Restart request failed");
      }

      startTransition(() => {
        router.refresh();
      });
      setMessage("RL state restarted. Picks recalculated from fresh state.");
    } catch {
      setMessage("Could not restart RL state. Please try again.");
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleCheckNow}
          disabled={isPending}
          className="rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Check What To Buy Now
        </button>
        <button
          type="button"
          onClick={handleRestartRl}
          disabled={isPending}
          className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Restart RL And Recompute
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-400">{message || "Use Check Now for latest picks, or Restart RL if you want a clean learning cycle."}</p>
    </div>
  );
}
