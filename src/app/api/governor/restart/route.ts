import { NextResponse } from "next/server";

import { getGovernorSnapshot, resetGovernorState } from "@/lib/rl-governor";

export const dynamic = "force-dynamic";

export async function POST() {
  await resetGovernorState();
  const snapshot = await getGovernorSnapshot();

  return NextResponse.json(
    {
      ok: true,
      message: "RL state restarted and snapshot recomputed.",
      snapshot,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
