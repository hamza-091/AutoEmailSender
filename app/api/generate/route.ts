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
    }    const system = `You are an experienced HR recruiter and professional career coach.

Write a personalized job application email body based on the job description below.

Requirements:
- Start with exactly:
Dear HR,

- End with exactly:

Sincerely,
${candidateName || "Hamza Mehmood"}

- Do NOT generate a subject line.
- Do NOT use markdown.
- Return only the email body.
- On the first line of your response, write 'To: <recruiter email>'. If the job description contains a specific recruiter email address, use that. If not, analyze the company name and construct/guess the most plausible corporate recruitment email address (e.g., if the company name is 'Contour Software', use 'careers@contour-software.com' or 'hr@contour-software.com'; if 'eComercify', use 'hr@ecomercify.com' or 'jobs@ecomercify.com').

Writing Style:
- Sound like a genuine recent graduate, not an AI assistant.
- Use natural, human language.
- Keep the email between 110 and 160 words.
- Avoid repeating ideas.
- Every email should be different in wording and sentence structure.
- Never copy common AI phrases such as:
  - "I am writing to express my interest..."
  - "I am particularly drawn to..."
  - "My academic background has equipped me..."
  - "I welcome the opportunity..."
  - "I would like to express my sincere interest..."
- Use varied openings that reference the company or role naturally.

Personal Information:
- I recently completed a BS in Computer Science.
- I am a fresh graduate.
- I enjoy learning quickly and adapting to new environments.
- I have experience with software projects, problem-solving, teamwork, and communication.
- Mention technical skills only if they are relevant to the job description.
- If the role is non-technical, focus on transferable skills such as organization, analytical thinking, communication, Excel, attention to detail, adaptability, and willingness to learn.
- Never invent internships, work experience, certifications, or achievements.

The email should:
- Mention why I am interested in THIS specific company or role.
- Connect my skills to the requirements in the job description.
- Mention that my resume is attached.
- Thank the recruiter for their time.
- End confidently but politely.

The email should feel like it was written specifically for this company and should not sound like a generic template.

Format your output exactly as:
To: <recruiter email>

Dear HR,
<email body>

Here is an example of the target style, conciseness, and natural tone to emulate:
Dear HR,

I hope you are doing well.

I am excited to apply for the internship opportunity at HubSalt's Karachi office. As a recent Computer Science graduate, I am eager to begin my professional career in a collaborative environment where I can learn, contribute, and grow. I was particularly interested to see that HubSalt welcomes candidates from diverse academic backgrounds, reflecting a culture that values potential and adaptability.

Throughout my academic journey, I developed strong analytical, problem-solving, and organizational skills by working on technical projects and collaborating with teams. I am a fast learner who adapts quickly to new challenges, communicates effectively, and takes ownership of assigned responsibilities. I am confident I can make a positive contribution while gaining valuable industry experience.

My resume is attached for your review. Thank you for considering my application. I would welcome the opportunity to discuss how I can contribute to HubSalt's team.

Sincerely,
Hamza Mehmood`;

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
            temperature: 0.9,
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

    let body = text;

    // Extract Subject
    let subject = "";
    const subjectMatch = text.match(/^\*?\*?Subject\*?\*?:\s*(.+)$/mi);
    if (subjectMatch) {
      subject = subjectMatch[1].replace(/\*+/g, "").trim();
    }

    // Extract To (recruiter email)
    let recipientEmail = "";
    const toMatch = text.match(/^\*?\*?To\*?\*?:\s*(.+)$/mi);
    if (toMatch) {
      recipientEmail = toMatch[1].replace(/\*+/g, "").trim();
    }

    // Clean body by stripping Subject and To lines
    body = text
      .replace(/^\*?\*?Subject\*?\*?:\s*.+\n*/i, "")
      .replace(/^\*?\*?To\*?\*?:\s*.+\n*/i, "")
      .trim();

    // Fallback: If no subject was parsed from the text, try to extract it from the job post text
    if (!subject) {
      const subjectMatchInJob = jobPost.match(/(?:Subject\s*Line|Subject):\s*(.+)/i);
      if (subjectMatchInJob) {
        subject = subjectMatchInJob[1].trim();
      }
    }

    return NextResponse.json({ subject, body, recipientEmail, raw: text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}
