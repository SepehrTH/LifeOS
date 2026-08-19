import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { serverToday } from "@/lib/blocks";
import {
  addManualSession,
  minutesByProject,
  runningSession,
  sessionsSince,
  startSession,
  stopSession,
} from "@/lib/focus";

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = serverToday();
  const weekStart = shiftDay(today, -6);
  const sessions = sessionsSince(userId, weekStart);
  const finished = sessions.filter((s) => !s.running);

  return NextResponse.json({
    today,
    running: runningSession(userId),
    sessions,
    totals: {
      today: finished.filter((s) => s.day === today).reduce((n, s) => n + s.minutes, 0),
      week: finished.reduce((n, s) => n + s.minutes, 0),
      byProject: minutesByProject(userId, weekStart),
    },
  });
}

/** start / stop the timer, or add a session by hand. */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const projectId = typeof body.projectId === "string" ? body.projectId : "";

  if (body.action === "start") {
    return NextResponse.json({ session: startSession(userId, projectId) });
  }

  if (body.action === "stop") {
    const running = runningSession(userId);
    if (!running) return NextResponse.json({ session: null });
    return NextResponse.json({ session: stopSession(userId, running.id) });
  }

  const minutes = Number(body.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return NextResponse.json({ error: "minutes required" }, { status: 400 });
  }

  const session = addManualSession(userId, {
    projectId,
    minutes,
    day: typeof body.day === "string" ? body.day.slice(0, 10) : undefined,
    note: typeof body.note === "string" ? body.note.slice(0, 200) : "",
  });
  return NextResponse.json({ session });
}
