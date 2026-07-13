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
Your task is to write a professional job application email based on the provided job description.

Instructions:
- Start the email with: "Dear HR," (or a more specific greeting if the company or team name is available in the job description, e.g., "Dear Puma Energy Pakistan Recruitment Team,").
- Always include a subject line at the very beginning of your response, prefixed with 'Subject:'. If the job post explicitly mentions a specific subject line format, use that exact format. Otherwise, generate an appropriate, professional, and concise subject line (e.g., 'Job Application: [Job Title] - [Candidate Name]' or similar).
- On the second line, write 'To: <recruiter email>'. If the job description contains a specific recruiter email address, use that. If not, analyze the company name and construct/guess the most plausible corporate recruitment email address (e.g., if the company name is 'Contour Software', use 'careers@contour-software.com' or 'hr@contour-software.com'; if 'eComercify', use 'hr@ecomercify.com' or 'jobs@ecomercify.com').
- Keep the email extremely concise, personalized, and strictly under 170 words (ideally between 100-150 words). Avoid longer, generic cover-letter-like emails. Recruiters scan emails quickly (10-20 seconds), so being concise has a stronger impact.
- Avoid long, winding sentences (especially the first sentence). Get to the point quickly.
- Avoid overused generic phrases and standard clichés (e.g., instead of repeating 'analytical thinking and problem-solving skills' or calling yourself a generic 'quick learner', describe your qualities naturally and confidently).
- Avoid repetition. Do not repeat the idea that you are eager to learn and contribute across multiple paragraphs (mention it once and move on).
- Use a confident, professional, and enthusiastic tone that reads naturally, which is what recruiters prefer, without overstating your experience.
- Tailor the email specifically to the job description, company, department, and required skills.
- Mention how my academic background and technical skills align with the role.
- Emphasize that I am a recent Computer Science graduate who is eager to learn, adapt quickly, and contribute.
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
- Make every email sound unique rather than using the same template.
- Do not use bullet points.
- Produce polished, natural English suitable for multinational companies.
- Output ONLY the email: a subject line, then the recruiter email, then the body. No preamble, no explanation, no markdown, no quotes around it. Format exactly as:
Subject: <subject line>
To: <recruiter email>

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
