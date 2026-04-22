import { NextResponse } from "next/server";

import { getGovernorSnapshot } from "@/lib/rl-governor";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getGovernorSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
