import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

// Helper to authenticate
function getUserFromToken(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = extractTokenFromHeader(authHeader);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return { id: payload.userId };
}

export async function GET(request: Request) {
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) return NextResponse.json({ success: false, error: "Symbol required" }, { status: 400 });

  try {
    const alerts = await prisma.priceAlert.findMany({
      where: {
        userId: user.id,
        symbol: symbol,
        isTriggered: false
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    console.error("GET PriceAlert error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { symbol, targetPrice, direction } = await request.json();

    if (!symbol || !targetPrice || !direction) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    // Limit active alerts per user per stock to prevent spam
    const existing = await prisma.priceAlert.count({
      where: { userId: user.id, symbol, isTriggered: false }
    });

    if (existing >= 5) {
      return NextResponse.json({ success: false, error: "Maximum 5 active price alerts per stock." }, { status: 400 });
    }

    const alert = await prisma.priceAlert.create({
      data: {
        userId: user.id,
        symbol,
        targetPrice: parseFloat(targetPrice),
        direction
      }
    });

    return NextResponse.json({ success: true, alert });
  } catch (error) {
    console.error("POST PriceAlert error:", error);
    return NextResponse.json({ success: false, error: "Failed to create alert" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

  try {
    await prisma.priceAlert.delete({
      where: { id, userId: user.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE PriceAlert error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
