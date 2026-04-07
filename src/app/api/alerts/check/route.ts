import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAlertEmail } from "@/lib/mailer";

// Force dynamic execution for this periodic check
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Simple cron-secret check to prevent unauthorized public execution
  const { searchParams } = new URL(request.url);
  const cronSecret = searchParams.get("cron_secret");
  
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized cron execution." }, { status: 401 });
  }

  try {
    // 1. Fetch all active (untriggered) target price alerts
    const activeAlerts = await prisma.priceAlert.findMany({
      where: { isTriggered: false },
      include: { user: true }
    });

    if (activeAlerts.length === 0) {
      return NextResponse.json({ success: true, message: "No active customized price alerts to process." });
    }

    // 2. Extract unique symbols
    const uniqueSymbols = Array.from(new Set(activeAlerts.map(a => a.symbol)));

    // 3. Setup origin to call our internal quotes API
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    // 4. Batch fetch current prices for these symbols
    const quotesRes = await fetch(`${baseUrl}/api/stocks/quotes?symbols=${encodeURIComponent(uniqueSymbols.join(","))}`);
    const quotesData = await quotesRes.json();
    
    if (!quotesData.success || !quotesData.data) {
       return NextResponse.json({ success: false, error: "Failed to fetch current quotes for active alerts." }, { status: 500 });
    }

    const currentQuotes = quotesData.data;
    let triggeredCount = 0;

    // 5. Evaluate limits
    for (const alert of activeAlerts) {
       const quote = currentQuotes.find((q: any) => q.symbol === alert.symbol);
       if (!quote) continue;

       const currentPrice = quote.last_price;
       let triggerHit = false;

       if (alert.direction === "ABOVE" && currentPrice >= alert.targetPrice) {
         triggerHit = true;
       } else if (alert.direction === "BELOW" && currentPrice <= alert.targetPrice) {
         triggerHit = true;
       }

       if (triggerHit) {
         // It hit the target! Change state and send email.
         await prisma.priceAlert.update({
           where: { id: alert.id },
           data: { 
             isTriggered: true, 
             triggeredAt: new Date() 
           }
         });

         await sendAlertEmail({
           to: alert.user.email,
           symbol: alert.symbol,
           name: quote.companyName || quote.longName || alert.symbol,
           currentPrice: currentPrice,
           fiftyTwoWeekHigh: currentPrice, // Fallback for email template if target price hit
           fiftyTwoWeekLow: currentPrice,
           alertType: "TARGET_PRICE"
         });

         triggeredCount++;
       }
    }

    return NextResponse.json({ 
      success: true, 
      scanned: activeAlerts.length,
      triggered: triggeredCount
    });

  } catch (error) {
    console.error("[Target Alerts Check] Error:", error);
    return NextResponse.json({ success: false, error: "Cron cycle failed." }, { status: 500 });
  }
}
