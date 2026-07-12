"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

type CV = { filename: string; mimeType: string; base64Data: string };

const TONES = ["Professional and confident", "Warm and personable", "Direct and concise"];

export default function Home() {
  const { data: session, status } = useSession();

  const [jobPost, setJobPost] = useState("");
  const [candidateName, setCandidateName] = useState("Hamza Mehmood");
  const [background, setBackground] = useState("");
  const [tone, setTone] = useState(TONES[0]);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [justStamped, setJustStamped] = useState(false);

  const [cv, setCv] = useState<CV | null>(null);
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"idle" | "sent" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-extract email from job post
  useEffect(() => {
    if (!jobPost) return;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = jobPost.match(emailRegex);
    if (match) {
      setRecipient(match[0]);
    }
  }, [jobPost]);

  // Load a previously-saved CV so the user only has to upload it once.
  useEffect(() => {
    const saved = localStorage.getItem("emailGenieCv");
    if (saved) {
      try {
        setCv(JSON.parse(saved));
      } catch {}
    }
    const savedName = localStorage.getItem("emailGenieName");
    if (savedName) {
      setCandidateName(savedName);
    } else {
      setCandidateName("Hamza Mehmood");
    }
  }, []);

  useEffect(() => {
    if (candidateName) localStorage.setItem("emailGenieName", candidateName);
  }, [candidateName]);

  function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(",")[1];
      const newCv = { filename: file.name, mimeType: file.type || "application/pdf", base64Data };
      setCv(newCv);
      localStorage.setItem("emailGenieCv", JSON.stringify(newCv));
    };
    reader.readAsDataURL(file);
  }

  function clearCv() {
    setCv(null);
    localStorage.removeItem("emailGenieCv");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleGenerate() {
    setError("");
    setSendResult("idle");
    setLoading(true);
    setJustStamped(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPost, candidateName, candidateBackground: background, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSubject(data.subject);
      setBody(data.body);
      setJustStamped(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    setError("");
    setSendResult("idle");
    if (!recipient) {
      setError("Add the recruiter's email address before sending.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient,
          subject,
          body: candidateName ? `${body}\n\n${candidateName}` : body,
          senderEmail: session?.user?.email,
          attachment: cv,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the email.");
      setSendResult("sent");
    } catch (e: any) {
      setError(e.message);
      setSendResult("error");
    } finally {
      setSending(false);
    }
  }

  const canGenerate = jobPost.trim().length > 20 && !loading;
  const canSend = subject && body && recipient && !sending && session;

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8 lg:px-16">
      {/* Header */}
      <header className="mx-auto mb-10 flex max-w-6xl flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-brass">
          <SealIcon className="h-6 w-6" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-graphite">
            Email Genie
          </span>
        </div>
        <h1 className="font-serif text-3xl font-medium text-ink sm:text-4xl">
          Turn a job post into a letter worth opening
        </h1>
        <p className="max-w-xl text-sm text-graphite">
          Paste the listing on the left. Get a tight, recruiter-ready email on the right —
          then send it straight from your Gmail, CV attached.
        </p>
      </header>

      {/* Auth strip */}
      <div className="mx-auto mb-8 flex max-w-6xl justify-center">
        {status === "loading" ? null : session ? (
          <div className="flex items-center gap-3 rounded-full border border-line bg-white/60 px-4 py-1.5 text-xs text-graphite">
            <span>
              Connected as <span className="font-medium text-ink">{session.user?.email}</span>
            </span>
            <button onClick={() => signOut()} className="text-brassDark hover:underline focus-ring">
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="focus-ring flex items-center gap-2 rounded-full border border-ink bg-ink px-5 py-2 text-sm font-medium text-paper transition hover:bg-slate"
          >
            <GoogleIcon className="h-4 w-4" />
            Connect Gmail to send directly
          </button>
        )}
      </div>

      {/* Two-pane workspace */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Raw input pane */}
        <section className="rounded-lg border border-line bg-[#F2F0E9] p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-graphite">
              01 — Job post
            </span>
          </div>
          <textarea
            value={jobPost}
            onChange={(e) => setJobPost(e.target.value)}
            placeholder="Paste the full job listing here — title, responsibilities, requirements, company name..."
            className="focus-ring h-52 w-full resize-none rounded-md border border-line bg-white/70 p-3 font-mono text-[13px] leading-relaxed text-ink placeholder:text-graphite/60"
          />

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-graphite">
                Your name
              </label>
              <input
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Hamza Khan"
                className="focus-ring w-full rounded-md border border-line bg-white/70 p-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-graphite">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="focus-ring w-full rounded-md border border-line bg-white/70 p-2 text-sm"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-graphite">
              Relevant background (optional — real facts only, the model won't invent any)
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="e.g. 2 years React/Next.js freelance, built an AI voice-calling agent for hospital intake, ran a small dev agency..."
              className="focus-ring h-20 w-full resize-none rounded-md border border-line bg-white/70 p-2 text-sm"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="focus-ring mt-4 w-full rounded-md bg-brass py-2.5 text-sm font-medium text-white transition hover:bg-brassDark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Writing…" : "Generate email"}
          </button>
        </section>

        {/* Polished output pane */}
        <section className="relative rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-graphite">
              02 — Your email
            </span>
            {justStamped && <SealIcon className="h-6 w-6 animate-seal text-brass" />}
          </div>

          {!subject && !body ? (
            <div className="flex h-52 items-center justify-center rounded-md border border-dashed border-line text-center text-sm text-graphite">
              Your polished email will appear here.
            </div>
          ) : (
            <div className="animate-fade-up space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-graphite">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="focus-ring w-full rounded-md border border-line bg-white p-2 font-serif text-base"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-graphite">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="focus-ring h-52 w-full resize-none rounded-md border border-line bg-white p-3 font-serif text-[15px] leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* CV + send panel */}
          <div className="mt-5 border-t border-line pt-4">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-graphite">
              03 — Attach &amp; send
            </span>

            <div className="mb-3 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleCvUpload}
                className="hidden"
                id="cv-upload"
              />
              {cv ? (
                <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink">
                  <PaperclipIcon className="h-3.5 w-3.5 text-brass" />
                  {cv.filename}
                  <button onClick={clearCv} className="text-graphite hover:text-ink focus-ring">
                    ×
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="cv-upload"
                  className="focus-ring cursor-pointer rounded-full border border-dashed border-line px-3 py-1.5 text-xs text-graphite hover:border-brass hover:text-brassDark"
                >
                  + Attach your CV (saved for next time)
                </label>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="recruiter@company.com"
                className="focus-ring flex-1 rounded-md border border-line bg-white p-2 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="focus-ring rounded-md bg-ink px-5 py-2 text-sm font-medium text-paper transition hover:bg-slate disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send from Gmail"}
              </button>
            </div>

            {!session && (
              <p className="mt-2 text-xs text-graphite">
                Connect Gmail above first — the email sends from your own account, nothing is
                stored on a server.
              </p>
            )}
            {sendResult === "sent" && (
              <p className="mt-2 text-xs font-medium text-successGreen">
                Sent — check your Gmail Sent folder.
              </p>
            )}
            {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
          </div>
        </section>
      </div>

      <footer className="mx-auto mt-10 max-w-6xl text-center font-mono text-[11px] text-graphite/70">
        Nothing you paste or attach is stored — the CV lives only in your browser.
      </footer>
    </main>
  );
}

function SealIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.3-1.7 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.9 2.4 2.7 6.6 2.7 11.7S6.9 21 12 21c6.9 0 9.2-4.8 9.2-7.3 0-.5-.05-.9-.13-1.3H12z"
      />
    </svg>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M17 7l-7 7a3 3 0 004.2 4.2l7-7a5 5 0 00-7-7l-7 7a7 7 0 009.9 9.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
