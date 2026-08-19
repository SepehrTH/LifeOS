import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { listDeadlines } from "@/lib/blocks";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ deadlines: listDeadlines(userId) });
}
