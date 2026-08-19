import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { createMetric, listMetrics, type MetricType } from "@/lib/metrics";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ metrics: listMetrics(userId) });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const metric = createMetric(userId, {
    name,
    type: body.type as MetricType,
    unit: typeof body.unit === "string" ? body.unit : "",
    min: Number.isFinite(body.min) ? Number(body.min) : undefined,
    max: Number.isFinite(body.max) ? Number(body.max) : undefined,
    color: typeof body.color === "string" ? body.color : "",
  });
  return NextResponse.json({ metric });
}
