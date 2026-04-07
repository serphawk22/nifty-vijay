import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText, Message } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, pathname } = await req.json();

    console.log("== CHAT API DEBUG ==");
    console.log("Incoming Pathname:", pathname);

    // 1. Determine Context based on the Pathname
    let contextPrompt = "";

    if (pathname === "/dashboard" || pathname === "/") {
      contextPrompt = `
      The user is currently on the main 'Dashboard' of the TradeVision stock market application.
      They are looking at general market trends, the NIFTY 50 index chart, and global market news.
      Provide insights relevant to the broad Indian stock market.
      `;
    } else if (pathname?.startsWith("/stock/")) {
      const parts = pathname.split("/");
      const symbol = decodeURIComponent(parts[parts.length - 1]);

      console.log("Detected Stock Context:", symbol);

      // Fetch recent news for this specific stock to inject into the AI's brain
      let newsContext = "";
      try {
        const apiKey = process.env.NEWS_API_KEY;
        if (apiKey) {
          const res = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(symbol)}&language=en&sortBy=publishedAt&pageSize=3&apiKey=${apiKey}`);
          if (res.ok) {
            const data = await res.json();
            if (data.articles && data.articles.length > 0) {
              const headlines = data.articles.map((a: any) => `- ${a.title} (${a.source?.name})`).join("\n");
              newsContext = `\nRecent news headlines for ${symbol}:\n${headlines}`;
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch news context for AI:", e);
      }

      contextPrompt = `
      The user is currently analyzing the individual stock: ${symbol}.
      Your job is to act as a definitive AI equity analyst. If the user asks for a prediction, analysis, or decision on this stock, 
      you MUST provide a nuanced prediction based on the following recent news and general market logic.
      ${newsContext}
      `;
    } else if (pathname === "/volume-analysis") {
      contextPrompt = `
       The user is currently on the 'Volume Analysis' page.
       They are looking at a dual-axis chart comparing stock Price against Trading Volume over time.
       Help them understand how volume precedes price movements, or answer questions about accumulation/distribution.
       `;
    } else if (pathname === "/screener") {
      contextPrompt = `
       The user is currently on the 'Stock Screener' page.
       They are filtering and scanning the Nifty 500 for potential trading opportunities based on volume, price, or performance metrics.
       Help them identify what makes a good screening setup.
       `;

    } else if (pathname?.startsWith("/world-stocks")) {
      const regionMatch = pathname.match(/region=([a-z]+)/);
      const region = regionMatch ? regionMatch[1] : "us";
      const regionNames: Record<string, string> = { us: "United States (S&P 500 companies)", europe: "Europe", asia: "Asia & Pacific", uk: "United Kingdom" };
      const regionLabel = regionNames[region] || region;
      contextPrompt = `
       The user is on the 'World Stocks' page, currently viewing the '${regionLabel}' region.
       They are browsing major global equities with live prices, market caps, P/E ratios, and daily changes.
       Help them understand global market dynamics, how to compare international stocks, and what drives price movements in that region.
       `;
    } else {
      contextPrompt = `The user is browsing the TradeVision application. Pathname is ${pathname}.`;
    }

    // 2. Define the System Persona
    const systemPrompt = `
    You are Cutie AI, a highly intelligent, professional, and concise financial assistant embedded in a stock market terminal.
    You communicate clearly, using bullet points where necessary.
    
    CURRENT CONTEXT:
    ${contextPrompt}
    
    NAVIGATION ABILITIES:
    - You can help users open ANY stock page directly.
    - If a user asks to see a stock or page, you should explain you are opening it and then append a special command at the end of your message.
    - Format: [NAVIGATE:SYMBOL,REGION]
    - Examples:
      - For Apple (US): [NAVIGATE:AAPL,us]
      - For Reliance (India): [NAVIGATE:RELIANCE,in]
      - For NIFTY 50 (India): [NAVIGATE:NIFTY 50,in]
    - Always prefer the correct ticker symbol. For Indian stocks, if unsure, use common capital letters (e.g. INFY, TCS, RELIANCE).
    
    CRITICAL RULES:
    1. If the user asks for a stock prediction or decision, DO NOT say "I cannot predict the future". Provide a probabilistic analysis based on available context.
    2. Keep your answers relatively concise to fit well in a small chat window.
    3. Use the [NAVIGATE:...] tag whenever appropriate.
    `;

    // 3. Stream the response using the Vercel AI SDK
    const result = await streamText({
      // @ts-ignore - version mismatch between ai and @ai-sdk/openai due to legacy-peer-deps
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: messages as Message[],
    });

    return result.toAIStreamResponse();
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
