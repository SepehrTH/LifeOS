import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { serverToday } from "@/lib/blocks";
import { dayDetail } from "@/lib/history";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const day = new URL(req.url).searchParams.get("day") ?? serverToday();
  return NextResponse.json(dayDetail(userId, day));
}
