import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch job description, status ${res.status}` },
        { status: res.status }
      );
    }

    const html = await res.text();
    
    // Look for description container
    const matchMarkup = html.match(/<div class="show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/);
    let descriptionText = "";
    
    if (matchMarkup) {
      descriptionText = matchMarkup[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    } else {
      const matchSection = html.match(/<section class="description[^>]*>([\s\S]*?)<\/section>/);
      if (matchSection) {
        descriptionText = matchSection[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      } else {
        // Fallback: strip the entire HTML
        descriptionText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      }
    }

    return NextResponse.json({ description: descriptionText });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
