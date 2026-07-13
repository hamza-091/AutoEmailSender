import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { jobDescription, candidateBackground } = await req.json();

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Missing jobDescription" },
        { status: 400 }
      );
    }

    const trimmedDescription = jobDescription.length > 1200 
      ? jobDescription.slice(0, 1200) + "\n...[trimmed for length]..." 
      : jobDescription;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing GEMINI_API_KEY. Add it in your environment variables." },
        { status: 500 }
      );
    }

    const system = `You are an expert HR matching algorithm. Your job is to analyze a job description and decide if it matches a candidate's background.
You must output a JSON object with two fields:
- "isMatch": boolean (true if it's a good match, false otherwise)
- "reason": string (a concise explanation of why it matches or why it was rejected, under 30 words)

Rules for matching:
- The candidate's name is Hamza Mehmood, a recent Computer Science graduate from Karachi, Pakistan, who is eager to learn, adapt quickly, and contribute from day one.
- Location constraints:
  - If the job is ONSITE or HYBRID: It MUST be located in Karachi, Pakistan. Reject all onsite/hybrid jobs in other cities (e.g. Lahore, Islamabad, Sialkot, etc.) or other countries.
  - If the job is REMOTE: It can be located anywhere in Pakistan or worldwide (as long as it allows remote work from Pakistan).
- Role constraints:
  - Favor junior, entry-level, graduate, associate, or internship roles.
  - Reject senior, lead, principal, or mid-to-senior roles requiring multiple years of experience (e.g. 3+, 5+, or 8+ years of experience) unless the description explicitly states it is open to fresh graduates.
- Match candidate background context if provided: "${candidateBackground || ""}"`;

    const userPrompt = `Job Description to evaluate:
"""
${trimmedDescription}
"""`;

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
            temperature: 0.2,
            responseMimeType: "application/json",
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
      return NextResponse.json({ isMatch: false, reason: "Empty response from Gemini matcher." });
    }

    const parsed = JSON.parse(text);
    return NextResponse.json({
      isMatch: !!parsed.isMatch,
      reason: parsed.reason || ""
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
