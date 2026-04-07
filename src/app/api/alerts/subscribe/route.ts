import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getUserIdFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const decoded = verifyToken(auth.replace("Bearer ", ""));
    return (decoded as any)?.userId || null;
  } catch {
    return null;
  }
}

// GET /api/alerts/subscribe — list subscriptions for current user
export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await prisma.alertSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: subs });
}

// POST /api/alerts/subscribe — add or update a subscription
export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { symbol, alertHighEnabled, alertLowEnabled, thresholdPct } = body;

  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });

  const sub = await prisma.alertSubscription.upsert({
    where: { userId_symbol: { userId, symbol: symbol.toUpperCase().trim() } },
    update: {
      alertHighEnabled: alertHighEnabled ?? true,
      alertLowEnabled: alertLowEnabled ?? true,
      thresholdPct: thresholdPct ?? 1.0,
    },
    create: {
      userId,
      symbol: symbol.toUpperCase().trim(),
      alertHighEnabled: alertHighEnabled ?? true,
      alertLowEnabled: alertLowEnabled ?? true,
      thresholdPct: thresholdPct ?? 1.0,
    },
  });

  return NextResponse.json({ success: true, data: sub });
}

// DELETE /api/alerts/subscribe?symbol=RELIANCE — remove a subscription
export async function DELETE(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });

  await prisma.alertSubscription.deleteMany({
    where: { userId, symbol: symbol.toUpperCase() },
  });

  return NextResponse.json({ success: true });
}
