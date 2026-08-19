import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { serverToday } from "@/lib/blocks";
import { history } from "@/lib/history";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const days = Math.min(400, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 182));
  return NextResponse.json({ today: serverToday(), days: history(userId, days) });
}
