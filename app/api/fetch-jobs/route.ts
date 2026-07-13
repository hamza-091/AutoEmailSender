import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const keywords = searchParams.get("keywords") || "Software Engineer";
    const location = searchParams.get("location") || "Pakistan";

    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&sortBy=DD&f_TPR=r2592000`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `LinkedIn search failed with status ${res.status}` },
        { status: res.status }
      );
    }

    const html = await res.text();
    const jobs = [];
    const cardRegex = /<div[^>]*class="[^"]*job-search-card[^"]*"[^>]*data-entity-urn="urn:li:jobPosting:(\d+)"[\s\S]*?<\/div>\s*<\/div>/g;
    
    let match;
    while ((match = cardRegex.exec(html)) !== null) {
      const cardHtml = match[0];
      const id = match[1];
      
      const titleMatch = cardHtml.match(/<h3[^>]*class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/);
      const title = titleMatch ? titleMatch[1].trim() : "";
      
      const companyMatch = cardHtml.match(/<a[^>]*class="hidden-nested-link"[^>]*>([\s\S]*?)<\/a>/);
      const company = companyMatch ? companyMatch[1].trim() : "";
      
      const locationMatch = cardHtml.match(/<span[^>]*class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/);
      const location = locationMatch ? locationMatch[1].trim() : "";
      
      const linkMatch = cardHtml.match(/<a[^>]*class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/);
      const link = linkMatch ? linkMatch[1].trim() : "";
      
      jobs.push({ id, title, company, location, link });
    }

    return NextResponse.json({ jobs });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
