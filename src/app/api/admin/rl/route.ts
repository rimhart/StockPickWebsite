import { NextResponse } from "next/server";

import { getRlAdminSnapshot } from "@/lib/rl-admin";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const requiredToken = process.env.ADMIN_TOKEN;

  if (!requiredToken) {
    return true;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token") ?? "";

  return bearer === requiredToken || queryToken === requiredToken;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getRlAdminSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
