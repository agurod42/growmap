import { NextResponse } from "next/server";

import { syncReferenceCityPlaces } from "@/lib/services/sync-places";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const token = process.env.SYNC_CRON_TOKEN;
  if (!token) return true;
  const header = req.headers.get("authorization");
  if (!header) return false;
  const normalized = header.toLowerCase().startsWith("bearer ") ? header.slice(7) : header;
  return normalized.trim() === token;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncReferenceCityPlaces();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Failed to sync reference city places", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
