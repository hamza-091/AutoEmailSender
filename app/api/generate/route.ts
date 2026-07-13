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

    const trimmedJobPost = jobPost.length > 2500
      ? jobPost.slice(0, 2500) + "\n...[trimmed for length]..."
      : jobPost;

    const userKey = req.headers.get("x-gemini-key");
    const apiKey = userKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Gemini API Key. Please enter your Gemini API Key in the settings at the top of the page." },
        { status: 400 }
      );
    }    const system = `You are an expert job application assistant.

Your task is to write a SHORT, professional email for a job application.

You will receive the job description.

Rules:
- Length: 120–180 words maximum.
- Keep it direct and professional.
- Do NOT use markdown.
- Do NOT use buzzwords or exaggerated language.
- Never invent skills or experience that are not present in my CV (BS in Computer Science from Bahria University, fresh graduate, fast learning, software projects, problem-solving, teamwork, communication).
- Mention only the most relevant skills for the job.
- If the job asks for technologies I have only academic or limited exposure to, say "familiar with" or "eager to develop hands-on experience" instead of claiming expertise.
- If the company location matches Karachi or is remote, mention I am available to join immediately.
- Mention that my CV is attached.
- Include my portfolio link (https://devhamza.tech) only if the role is technical (Software, AI, Web, Frontend, Backend, Full-Stack, Data Science, Machine Learning, DevOps, UI/UX). Do not include it for non-technical roles.
- Do not mention CGPA unless the job description specifically asks for it.
- Never mention certifications unless they are directly relevant.
- Avoid repeating information.
- The email should sound natural and written by a person.

Adaptation rules:
- AI/ML roles → Highlight Python, Machine Learning, OpenAI APIs, LangChain, AI Voice Agent, Data Science Internship.
- Frontend roles → Highlight React, Next.js, JavaScript, Tailwind CSS, responsive web applications.
- Backend roles → Highlight Node.js, REST APIs, MongoDB, MySQL.
- Full-Stack roles → Highlight React, Next.js, Node.js, MongoDB, API development, deployment.
- Data roles → Highlight Python, Data Science Internship, SQL, Machine Learning, data preprocessing.
- E-commerce roles → Highlight E-Commerce Listing Internship, Excel/Google Sheets familiarity, attention to detail.
- WordPress roles → Highlight Fiverr WordPress project and client communication.
- IT Support roles → Highlight technical problem-solving, adaptability, computer science background.

Always use this exact structure:
Subject: <Job Title>
To: <recruiter email>
Company: <Company>

Dear Hiring Team,

I am writing to apply for the <Job Title> position at <Company>. I recently completed my BS in Computer Science from Bahria University and am excited about the opportunity to contribute to your team.

(Write 2–3 sentences that connect my most relevant experience and skills to the job requirements.)

I have attached my CV for your review. (If technical role, append: "You can also view my portfolio at https://devhamza.tech.")

Thank you for your time and consideration. I look forward to hearing from you.

Kind regards,

Hamza Mehmood
+92 311 2823179

Instructions for variables:
- Extract the <Job Title> and <Company> from the job description.
- Under 'Company: <Company>', write the hiring company name extracted from the job description.
- Under 'To: <recruiter email>', extract the email from the job post. If none is found, guess the most plausible corporate recruitment email address (e.g., hr@company.com or careers@company.com).

Here is an example of the target style, structure, and tone to emulate:
Subject: Web Developer
To: hr@hubsalt.com
Company: HubSalt

Dear Hiring Team,

I am writing to apply for the Web Developer position at HubSalt. I recently completed my BS in Computer Science from Bahria University and am excited about the opportunity to contribute to your team.

During my studies, I focused on building responsive web applications using JavaScript and React. I have academic experience collaborating on software projects, where I developed strong problem-solving and communication skills. Being based in Karachi, I am available to join your onsite team immediately and am eager to adapt to your development workflow.

I have attached my CV for your review. You can also view my portfolio at https://devhamza.tech.

Thank you for your time and consideration. I look forward to hearing from you.

Kind regards,

Hamza Mehmood
+92 311 2823179`;

    const userPrompt = `Job Description:
${trimmedJobPost}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
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

    // Extract Company
    let companyName = "";
    const companyMatch = text.match(/^\*?\*?Company\*?\*?:\s*(.+)$/mi);
    if (companyMatch) {
      companyName = companyMatch[1].replace(/\*+/g, "").trim();
    }

    // Clean body by stripping Subject, To, and Company lines
    body = text
      .replace(/^\*?\*?Subject\*?\*?:\s*.+\n*/i, "")
      .replace(/^\*?\*?To\*?\*?:\s*.+\n*/i, "")
      .replace(/^\*?\*?Company\*?\*?:\s*.+\n*/i, "")
      .trim();

    // Fallback: If no subject was parsed from the text, try to extract it from the job post text
    if (!subject) {
      const subjectMatchInJob = jobPost.match(/(?:Subject\s*Line|Subject):\s*(.+)/i);
      if (subjectMatchInJob) {
        subject = subjectMatchInJob[1].trim();
      }
    }

    return NextResponse.json({ subject, body, recipientEmail, company: companyName, raw: text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}
