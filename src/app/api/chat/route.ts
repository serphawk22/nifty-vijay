import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText, Message, StreamingTextResponse } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, pathname } = await req.json();

    console.log("== CHAT API DEBUG ==");
    console.log("Incoming Pathname:", pathname);

    console.log("== CHAT API DEBUG ==");
    console.log("Incoming Pathname:", pathname);

    // 1. Determine Context based on the Pathname
    let contextPrompt = "";

    if (pathname === "/dashboard") {
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
    } else {
      contextPrompt = `The user is browsing the TradeVision application. Pathname is ${pathname}.`;
    }

    console.log("Final Context Prompt:", contextPrompt);

    // 2. Define the System Persona
    const systemPrompt = `
    You are TradeVision AI, a highly intelligent, professional, and concise financial assistant embedded in a stock market terminal.
    You communicate clearly, using bullet points where necessary, and avoid unnecessary jargon unless asked.
    
    CURRENT CONTEXT:
    ${contextPrompt}
    
    CRITICAL RULES:
    1. If the user asks for a stock prediction or decision (especially if they are on a specific stock page), DO NOT simply say "I cannot predict the future" or "seek a financial advisor" as your entire answer. 
    2. Instead, you MUST provide a probabilistic analysis (e.g., "Based on the recent news of X, the short-term sentiment leans bullish/bearish because...") and summarize the potential risks.
    3. Keep your answers relatively concise to fit well in a small chat window.
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
