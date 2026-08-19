import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { serverToday } from "@/lib/blocks";
import { history } from "@/lib/history";
import { listMetrics, valuesInRange } from "@/lib/metrics";
import { minutesByDay, minutesByProject } from "@/lib/focus";

/** Everything the graphs need: metric values plus the day scores over the same window. */
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const days = Math.min(365, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 60));
  const scores = history(userId, days);
  const from = scores[0]?.day ?? serverToday();

  return NextResponse.json({
    days: scores,
    metrics: listMetrics(userId),
    values: valuesInRange(userId, from, serverToday()),
    focusByDay: minutesByDay(userId, from, serverToday()),
    focusByProject: minutesByProject(userId, from),
  });
}
