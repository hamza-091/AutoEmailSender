import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";

function base64UrlEncode(str: string) {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Builds a raw RFC 2822 MIME message with an optional base64 file attachment.
function buildMimeMessage({
  to,
  from,
  subject,
  body,
  attachment,
}: {
  to: string;
  from: string;
  subject: string;
  body: string;
  attachment?: { filename: string; mimeType: string; base64Data: string } | null;
}) {
  const boundary = "email_genie_boundary_" + Math.random().toString(36).slice(2);

  const headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join("\r\n");

  const bodyPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
    "",
  ].join("\r\n");

  let attachmentPart = "";
  if (attachment) {
    attachmentPart = [
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      attachment.base64Data,
      "",
    ].join("\r\n");
  }

  const closing = `--${boundary}--`;

  return `${headers}\r\n\r\n${bodyPart}${attachmentPart}${closing}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Not signed in to Gmail. Sign in first, then try sending again." },
        { status: 401 }
      );
    }
    if (session.error === "RefreshAccessTokenError") {
      return NextResponse.json(
        { error: "Your Gmail session expired. Sign in again." },
        { status: 401 }
      );
    }

    const { to, subject, body, senderEmail, attachment } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "Missing recipient, subject, or body." },
        { status: 400 }
      );
    }

    const raw = buildMimeMessage({
      to,
      from: senderEmail || "me",
      subject,
      body,
      attachment: attachment || null,
    });

    const encodedMessage = base64UrlEncode(raw);

    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedMessage }),
      }
    );

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      return NextResponse.json(
        { error: `Gmail API error: ${errText}` },
        { status: 502 }
      );
    }

    const result = await gmailRes.json();
    return NextResponse.json({ success: true, id: result.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}
