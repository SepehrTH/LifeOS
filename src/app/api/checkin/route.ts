import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { serverToday } from "@/lib/blocks";
import { scoreFor } from "@/lib/history";
import { listMetrics, setValue, valuesForDay } from "@/lib/metrics";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const day = new URL(req.url).searchParams.get("day") ?? serverToday();
  return NextResponse.json({
    day,
    metrics: listMetrics(userId),
    values: valuesForDay(userId, day),
    score: scoreFor(userId, day),
  });
}

/** Saves one metric's value for a day. */
export async function PUT(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const day = typeof body.day === "string" ? body.day.slice(0, 10) : serverToday();
  const metricId = String(body.metricId ?? "");

  const ok = setValue(userId, metricId, day, {
    num: body.num === null || body.num === undefined ? null : Number(body.num),
    text: typeof body.text === "string" ? body.text : "",
  });
  if (!ok) return NextResponse.json({ error: "unknown metric" }, { status: 404 });

  return NextResponse.json({ ok, score: scoreFor(userId, day) });
}
