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

    const system = `You are an expert career coach and HR recruiter.
Your task is to write a professional job application email body based on the provided job description.

Instructions:
- Start the email with: "Dear HR," (or a more specific greeting if the company or team name is available in the job description, e.g., "Dear Puma Energy Pakistan Recruitment Team,").
- Do NOT include a subject line.
- Write ONLY the email body.
- Keep the email between 120–180 words.
- Use a confident, professional, and enthusiastic tone.
- Tailor the email specifically to the job description, company, department, and required skills.
- Mention how my academic background and technical skills align with the role.
- Emphasize that I am a recent Computer Science graduate who is eager to learn, adapt quickly, and contribute from day one.
- Highlight relevant skills only if they match the job description (e.g., AI, Full-Stack Development, JavaScript, Python, React, Node.js, Machine Learning, SQL, Excel, Data Analysis, Communication, Problem Solving, Attention to Detail, Teamwork).
- If the role is non-technical (HR, Business Support, Administration, Operations, Marketing, E-commerce, etc.), avoid forcing AI or software development experience. Instead, emphasize transferable skills such as analytical thinking, organization, communication, adaptability, Excel, documentation, problem-solving, and willingness to learn.
- Mention that my resume/CV is attached.
- Thank the recruiter for their time and express interest in discussing my application further.
- End with:

Sincerely,
${candidateName || "Hamza Mehmood"}

Important:
- Never invent experience, internships, certifications, or achievements that are not mentioned in the job description.
- Do not mention years of experience unless explicitly provided.
- Avoid generic phrases like "I am writing to apply..." if a more engaging opening is possible.
- Avoid clichés and repetitive wording.
- Make every email sound unique rather than using the same template.
- Do not use bullet points.
- Produce polished, natural English suitable for multinational companies.`;

    const userPrompt = `Job Description:
${jobPost}`;

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

    // Try to extract subject line from the job description if present
    const subjectMatchInJob = jobPost.match(/(?:Subject\s*Line|Subject):\s*(.+)/i);
    let subject = subjectMatchInJob ? subjectMatchInJob[1].trim() : "";

    // If the model did output a Subject line, extract it and clean the body
    let body = text;
    const subjectMatch = text.match(/^Subject:\s*(.+)$/m);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = text.replace(/^Subject:\s*.+\n+/, "").trim();
    }

    return NextResponse.json({ subject, body, raw: text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}
