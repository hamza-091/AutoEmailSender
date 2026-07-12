import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { jobPost, candidateName, candidateBackground, tone } = await req.json();

    if (!jobPost || typeof jobPost !== "string" || jobPost.trim().length < 20) {
      return NextResponse.json(
        { error: "Paste the full job post first — a few words isn't enough to write a good email." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing ANTHROPIC_API_KEY. Add it in your Vercel project settings." },
        { status: 500 }
      );
    }

    const system = `You write short, polished, highly professional job-application emails that get recruiters to open the CV attached. Rules:
- Output ONLY the email: a subject line, then the body. No preamble, no explanation, no markdown, no quotes around it.
- Format exactly as:
Subject: <subject line>

<email body>
- Keep it tight: 120-180 words in the body. Recruiters skim.
- No generic filler ("I am writing to express my interest..."). Open with something specific to the role or company from the job post.
- Mention 1-2 concrete, relevant skills or achievements tied to what the job post actually asks for. Never invent facts not given by the candidate background.
- Close with a clear, low-friction call to action (e.g. availability for a call) and a professional sign-off.
- Match the requested tone but never sound robotic, salesy, or over-the-top.
- No emojis. No exclamation marks unless truly natural.`;

    const userPrompt = `JOB POST:
"""
${jobPost}
"""

CANDIDATE NAME: ${candidateName || "the candidate"}
CANDIDATE BACKGROUND / KEY POINTS TO USE (only use facts given here, don't invent anything):
"""
${candidateBackground || "No extra background given — keep the email role-focused and let the attached CV carry the details."}
"""

DESIRED TONE: ${tone || "professional and confident"}

Write the email now, following the system rules exactly.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 600,
        system,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Claude API error: ${errText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.content
      ?.map((block: any) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "Empty response from model." }, { status: 502 });
    }

    const subjectMatch = text.match(/^Subject:\s*(.+)$/m);
    const subject = subjectMatch ? subjectMatch[1].trim() : "";
    const body = text.replace(/^Subject:\s*.+\n+/, "").trim();

    return NextResponse.json({ subject, body, raw: text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}
