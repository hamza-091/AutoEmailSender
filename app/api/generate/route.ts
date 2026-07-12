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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing GEMINI_API_KEY. Add it in your environment variables." },
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
- Mention 1-2 concrete, relevant skills or achievements from the candidate background. If the candidate background is empty, do not invent or fabricate specific experience or facts; instead, keep the email focused on your enthusiasm for the role's requirements as listed in the job post, and explicitly mention that your full background is detailed in the attached CV.
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Gemini API error: ${errText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "Empty response from Gemini model." }, { status: 502 });
    }

    const subjectMatch = text.match(/^Subject:\s*(.+)$/m);
    const subject = subjectMatch ? subjectMatch[1].trim() : "";
    const body = text.replace(/^Subject:\s*.+\n+/, "").trim();

    return NextResponse.json({ subject, body, raw: text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}
