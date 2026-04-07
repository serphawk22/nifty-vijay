import { NextResponse } from "next/server";
import Parser from "rss-parser";

export const revalidate = 300; // Cache for 5 mins

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "in";
  const apiKey = process.env.NEWS_API_KEY;

  // 1. Try NewsAPI (Primary)
  if (apiKey) {
    try {
      const queryStr = region === "us" 
        ? "S&P 500 OR NASDAQ OR wall street OR US markets" 
        : "Indian stock market OR NSE OR BSE";
        
      const query = encodeURIComponent(queryStr);
      const res = await fetch(`https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`, {
        next: { revalidate: 300 }
      });

      if (res.ok) {
        const data = await res.json();
        const news = (data.articles || []).map((item: any) => ({
          title: item.title,
          link: item.url,
          pubDate: item.publishedAt,
          contentSnippet: item.description,
          source: item.source?.name || 'News API',
          id: item.url || item.publishedAt,
        }));

        if (news.length > 0) {
          return NextResponse.json({ success: true, data: news });
        }
      } else {
        console.warn(`NewsAPI primary failed with status: ${res.status}. Falling back to RSS...`);
      }
    } catch (error) {
      console.error("NewsAPI primary request failed:", error);
    }
  }

  // 2. Fallback to RSS (Google News) if NewsAPI fails or is unavailable
  try {
    const parser = new Parser();
    const rssQuery = region === "us" ? "US+stock+market" : "Indian+stock+market";
    const rssUrl = `https://news.google.com/rss/search?q=${rssQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
    
    const feed = await parser.parseURL(rssUrl);
    
    const news = (feed.items || []).map((item: any) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet: item.contentSnippet || item.content,
      source: item.source || 'Google News',
      id: item.guid || item.link,
    }));

    return NextResponse.json({ success: true, data: news });
  } catch (rssError) {
    console.error("RSS fallback also failed:", rssError);
    return NextResponse.json(
      { success: false, error: "Failed to fetch news data from all sources.", data: [] },
      { status: 500 }
    );
  }
}
