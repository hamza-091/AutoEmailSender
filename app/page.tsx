"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

type CV = { filename: string; mimeType: string; base64Data: string };

const TONES = ["Professional and confident", "Warm and personable", "Direct and concise"];

export default function Home() {
  const { data: session, status } = useSession();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<"generator" | "autogenie" | "history">("generator");

  // Generator states
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

  // Auto-Genie states
  const [autoKeywords, setAutoKeywords] = useState("Software Engineer");
  const [autoLocation, setAutoLocation] = useState("Pakistan");
  const [autoJobs, setAutoJobs] = useState<any[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoProgress, setAutoProgress] = useState<string[]>([]);
  const [autoStatus, setAutoStatus] = useState<"idle" | "fetching" | "matching" | "sending" | "done" | "error">("idle");

  // History log state
  const [history, setHistory] = useState<any[]>([]);

  // Load saved CV & Name & History from local storage on mount
  useEffect(() => {
    const savedCv = localStorage.getItem("emailGenieCv");
    if (savedCv) {
      try {
        setCv(JSON.parse(savedCv));
      } catch {}
    }
    const savedName = localStorage.getItem("emailGenieName");
    if (savedName) {
      setCandidateName(savedName);
    } else {
      setCandidateName("Hamza Mehmood");
    }
    const savedHistory = localStorage.getItem("emailGenieHistory");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {}
    }
  }, []);

  // Update saved name
  useEffect(() => {
    if (candidateName) localStorage.setItem("emailGenieName", candidateName);
  }, [candidateName]);

  // Auto-extract email and subject from job post (Generator view)
  useEffect(() => {
    if (!jobPost) return;
    
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = jobPost.match(emailRegex);
    if (emailMatch) {
      setRecipient(emailMatch[0]);
    }

    const subjectRegex = /(?:Subject\s*Line|Subject):\s*(.+)/i;
    const subjectMatch = jobPost.match(subjectRegex);
    if (subjectMatch) {
      setSubject(subjectMatch[1].trim());
    }
  }, [jobPost]);

  // History updater helper
  const addToHistory = (entry: {
    recipient: string;
    subject: string;
    body: string;
    jobTitle: string;
    company: string;
    category: "Manual" | "Auto";
    status: "Sent" | "Failed";
    error?: string;
    jobContent?: string;
  }) => {
    const newEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
    };
    setHistory((prev) => {
      const updated = [newEntry, ...prev];
      localStorage.setItem("emailGenieHistory", JSON.stringify(updated));
      return updated;
    });
  };

  // CV Upload functions
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

  // Generate Email function (Generator view)
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
      if (data.subject) setSubject(data.subject);
      setBody(data.body);
      setJustStamped(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Send Email function (Generator view)
  async function handleSend() {
    setError("");
    setSendResult("idle");
    if (!recipient) {
      setError("Add the recruiter's email address before sending.");
      return;
    }
    setSending(true);
    const finalBody = (candidateName && !body.includes(candidateName)) ? `${body}\n\n${candidateName}` : body;
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient,
          subject,
          body: finalBody,
          senderEmail: session?.user?.email,
          attachment: cv,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the email.");
      setSendResult("sent");
      
      addToHistory({
        recipient,
        subject,
        body: finalBody,
        jobTitle: subject || "Job Application",
        company: "",
        category: "Manual",
        status: "Sent",
        jobContent: jobPost
      });
    } catch (e: any) {
      setError(e.message);
      setSendResult("error");
      
      addToHistory({
        recipient,
        subject,
        body: finalBody,
        jobTitle: subject || "Job Application",
        company: "",
        category: "Manual",
        status: "Failed",
        error: e.message,
        jobContent: jobPost
      });
    } finally {
      setSending(false);
    }
  }

  // Helper for logging Auto-Genie logs
  function addLog(message: string) {
    setAutoProgress((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }

  // Auto-Genie core automation routine
  async function handleAutoGenie() {
    if (!session) {
      alert("Please connect your Gmail account above before running the auto-sender.");
      return;
    }
    setAutoLoading(true);
    setAutoProgress([]);
    setAutoStatus("fetching");
    setAutoJobs([]);

    try {
      addLog(`Initiating LinkedIn job search for keywords: "${autoKeywords}" in location: "${autoLocation}"...`);
      const jobsRes = await fetch(`/api/fetch-jobs?keywords=${encodeURIComponent(autoKeywords)}&location=${encodeURIComponent(autoLocation)}`);
      if (!jobsRes.ok) throw new Error("Failed to fetch jobs listing.");
      const { jobs } = await jobsRes.json();
      
      if (!jobs || jobs.length === 0) {
        addLog("No potential jobs found in search. Completed.");
        setAutoStatus("done");
        setAutoLoading(false);
        return;
      }
      
      addLog(`Found ${jobs.length} potential jobs. Starting candidate CV matching filter...`);
      
      let matchCount = 0;
      const matchedJobsList = [];
      
      // Limit search iterations to prevent API abuse/rate limits
      const jobsToProcess = jobs.slice(0, 15);
      for (let i = 0; i < jobsToProcess.length && matchCount < 5; i++) {
        const currentJob = jobsToProcess[i];
        addLog(`[${i+1}/${jobsToProcess.length}] Fetching details for "${currentJob.title}" at ${currentJob.company}...`);
        
        const descRes = await fetch(`/api/fetch-job-desc?jobId=${currentJob.id}`);
        if (!descRes.ok) {
          addLog(`Skipped: Unable to retrieve description for "${currentJob.title}".`);
          continue;
        }
        const { description } = await descRes.json();
        
        addLog(`Filtering "${currentJob.title}" through Gemini AI...`);
        const matchRes = await fetch("/api/match-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobDescription: description, candidateBackground: background }),
        });
        
        if (!matchRes.ok) {
          addLog(`Gemini match error. Skipping.`);
          continue;
        }
        const matchData = await matchRes.json();
        
        if (matchData.isMatch) {
          matchCount++;
          addLog(`⭐ Match found! Reason: ${matchData.reason}. Adding to queue.`);
          matchedJobsList.push({
            ...currentJob,
            description,
            matchReason: matchData.reason,
            status: "Matched"
          });
          setAutoJobs([...matchedJobsList]);
        } else {
          addLog(`Rejected: ${matchData.reason || "Does not match CV profile."}`);
        }
      }

      if (matchedJobsList.length === 0) {
        setAutoStatus("done");
        addLog("Auto-run completed. No matching entry-level jobs found in this batch.");
        setAutoLoading(false);
        return;
      }

      addLog(`Starting automated batch email sequence for ${matchedJobsList.length} matched roles...`);
      setAutoStatus("sending");

      for (let k = 0; k < matchedJobsList.length; k++) {
        const job = matchedJobsList[k];
        addLog(`Drafting email for "${job.title}" at ${job.company}...`);
        
        // Extract email from job post (fallback to standard recruitment placeholder if none found)
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const extractedEmail = job.description.match(emailRegex)?.[0] || "recruiter@company.com";
        
        // Generate customized email body
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobPost: job.description,
            candidateName,
            candidateBackground: background,
            tone
          }),
        });

        if (!genRes.ok) {
          addLog(`Failed to generate email for "${job.title}". Skipping.`);
          job.status = "Failed Generation";
          setAutoJobs([...matchedJobsList]);
          continue;
        }

        const genData = await genRes.json();
        const emailSubject = genData.subject || `Application - ${job.title}`;
        const emailBody = (candidateName && !genData.body.includes(candidateName)) ? `${genData.body}\n\n${candidateName}` : genData.body;

        addLog(`Sending email to ${extractedEmail}...`);

        // Send email via Gmail OAuth
        const sendRes = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: extractedEmail,
            subject: emailSubject,
            body: emailBody,
            senderEmail: session?.user?.email,
            attachment: cv
          }),
        });

        if (sendRes.ok) {
          addLog(`✅ Email successfully sent to ${extractedEmail}!`);
          job.status = "Sent";
          addToHistory({
            recipient: extractedEmail,
            subject: emailSubject,
            body: emailBody,
            jobTitle: job.title,
            company: job.company,
            category: "Auto",
            status: "Sent",
            jobContent: job.description
          });
        } else {
          addLog(`❌ Failed to send email to ${extractedEmail}.`);
          job.status = "Failed Sending";
          addToHistory({
            recipient: extractedEmail,
            subject: emailSubject,
            body: emailBody,
            jobTitle: job.title,
            company: job.company,
            category: "Auto",
            status: "Failed",
            error: "Gmail API error",
            jobContent: job.description
          });
        }
        setAutoJobs([...matchedJobsList]);
        
        // Delay between sends to avoid API rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      setAutoStatus("done");
      addLog("🎉 Automated batch execution successfully completed!");
    } catch (err: any) {
      setAutoStatus("error");
      addLog(`Fatal Error: ${err.message}`);
    } finally {
      setAutoLoading(false);
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
          Optimize your job search with AI matching. Generate polished, recruiter-ready emails manually or fetch matching jobs from LinkedIn automatically.
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

      {/* Navigation Tabs */}
      <div className="mx-auto mb-8 flex max-w-6xl justify-center border-b border-line gap-2 sm:gap-6">
        <button
          onClick={() => setActiveTab("generator")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all ${
            activeTab === "generator"
              ? "border-brass text-brass font-semibold"
              : "border-transparent text-graphite hover:text-ink"
          }`}
        >
          Manual Generator
        </button>
        <button
          onClick={() => setActiveTab("autogenie")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all ${
            activeTab === "autogenie"
              ? "border-brass text-brass font-semibold"
              : "border-transparent text-graphite hover:text-ink"
          }`}
        >
          Auto-Genie
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all ${
            activeTab === "history"
              ? "border-brass text-brass font-semibold"
              : "border-transparent text-graphite hover:text-ink"
          }`}
        >
          History Log ({history.length})
        </button>
      </div>

      {/* Tab: Manual Generator */}
      {activeTab === "generator" && (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2 animate-fade-up">
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
      )}

      {/* Tab: Auto-Genie */}
      {activeTab === "autogenie" && (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2 animate-fade-up">
          {/* Left side: Search controls & Logs Console */}
          <div className="space-y-6">
            <section className="rounded-lg border border-line bg-[#F2F0E9] p-5 shadow-sm">
              <div className="mb-3">
                <span className="font-mono text-[11px] uppercase tracking-widest text-graphite">
                  Auto Job Fetcher (LinkedIn Search)
                </span>
              </div>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-graphite">
                    Job Keywords
                  </label>
                  <input
                    value={autoKeywords}
                    onChange={(e) => setAutoKeywords(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    className="focus-ring w-full rounded-md border border-line bg-white/70 p-2 text-sm"
                    disabled={autoLoading}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-graphite">
                    Location
                  </label>
                  <input
                    value={autoLocation}
                    onChange={(e) => setAutoLocation(e.target.value)}
                    placeholder="e.g. Pakistan"
                    className="focus-ring w-full rounded-md border border-line bg-white/70 p-2 text-sm"
                    disabled={autoLoading}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-graphite">
                  Your CV Text / Relevant Background (Used for AI Matching)
                </label>
                <textarea
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  placeholder="Paste your CV highlights, skills, and background here. The Gemini matcher will use this to accept or reject scraped jobs."
                  className="focus-ring h-24 w-full resize-none rounded-md border border-line bg-white/70 p-2 text-sm"
                  disabled={autoLoading}
                />
              </div>

              <button
                onClick={handleAutoGenie}
                disabled={autoLoading}
                className="focus-ring mt-5 w-full rounded-md bg-brass py-2.5 text-sm font-medium text-white transition hover:bg-brassDark disabled:cursor-not-allowed disabled:opacity-40"
              >
                {autoLoading ? "Running Automation Pipeline..." : "Start Auto Fetch & Send (Limit 5)"}
              </button>
              
              {!session && (
                <p className="mt-2 text-center text-xs text-graphite/80">
                  ⚠️ Connect Gmail above first to automatically send matched jobs.
                </p>
              )}
            </section>

            {/* Logging Console */}
            <section className="rounded-lg border border-line bg-ink text-[#A5C4D4] p-5 shadow-sm font-mono text-xs">
              <div className="mb-3 border-b border-[#A5C4D4]/20 pb-2 flex justify-between items-center">
                <span className="uppercase tracking-widest text-[#A5C4D4]/70">Console Logs</span>
                {autoLoading && <div className="h-2 w-2 rounded-full bg-brass animate-pulse"></div>}
              </div>
              <div className="h-48 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-brass/20">
                {autoProgress.length === 0 ? (
                  <span className="text-[#A5C4D4]/40">System idle. Press Start to initiate pipeline.</span>
                ) : (
                  autoProgress.map((log, index) => (
                    <div key={index} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right side: Matched Queue Status */}
          <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <div className="mb-3">
              <span className="font-mono text-[11px] uppercase tracking-widest text-graphite">
                Current Batch Queue (Max 5 Matches)
              </span>
            </div>

            {autoJobs.length === 0 ? (
              <div className="flex h-80 flex-col items-center justify-center rounded-md border border-dashed border-line text-center text-sm text-graphite p-6">
                <p>No jobs processed in the current session yet.</p>
                <p className="text-xs text-graphite/60 mt-1">Fetched matches will appear here with sending status.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
                {autoJobs.map((job, idx) => (
                  <div key={idx} className="p-3 border border-line rounded-lg bg-white shadow-sm space-y-2 hover:border-brass/30 transition-all">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-serif text-sm font-medium text-ink leading-snug">{job.title}</h4>
                        <p className="text-xs text-graphite">{job.company} • {job.location}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full ${
                        job.status === "Sent" 
                          ? "bg-successGreen/10 text-successGreen" 
                          : job.status === "Matched" 
                          ? "bg-brass/10 text-brass" 
                          : "bg-red-500/10 text-red-500"
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-ink/80 italic line-clamp-2 bg-[#F8F6F0] p-1.5 rounded">
                      Match Reason: "{job.matchReason}"
                    </p>
                    
                    <div className="flex justify-between items-center text-[10px] text-graphite pt-1">
                      <a href={job.link} target="_blank" rel="noreferrer" className="text-brass hover:underline">
                        View on LinkedIn ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab: History */}
      {activeTab === "history" && (
        <div className="mx-auto max-w-6xl bg-paper border border-line rounded-lg p-5 shadow-sm animate-fade-up">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-graphite">
              Email Dispatch Log
            </span>
            <span className="text-xs text-graphite/80">{history.length} records found</span>
          </div>

          {history.length === 0 ? (
            <div className="flex h-52 items-center justify-center rounded-md border border-dashed border-line text-center text-sm text-graphite">
              Your email history is empty.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <HistoryItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="mx-auto mt-10 max-w-6xl text-center font-mono text-[11px] text-graphite/70">
        Nothing you paste or attach is stored — the CV lives only in your browser.
      </footer>
    </main>
  );
}

// History expanded display item
function HistoryItem({ item }: { item: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-line rounded-lg bg-white overflow-hidden transition-all shadow-sm">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer hover:bg-paper transition"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[9px] font-mono rounded-full ${
              item.category === "Auto" 
                ? "bg-purple-100 text-purple-700" 
                : "bg-blue-100 text-blue-700"
            }`}>
              {item.category}
            </span>
            <span className={`px-2 py-0.5 text-[9px] font-mono rounded-full ${
              item.status === "Sent" 
                ? "bg-successGreen/10 text-successGreen" 
                : "bg-red-500/10 text-red-500"
            }`}>
              {item.status}
            </span>
            <span className="text-[10px] text-graphite font-mono">
              {new Date(item.timestamp).toLocaleString()}
            </span>
          </div>
          <h4 className="font-serif text-sm font-medium text-ink">
            {item.subject}
          </h4>
          <p className="text-xs text-graphite">
            To: <span className="font-mono">{item.recipient}</span> {item.company && `• Company: ${item.company}`}
          </p>
        </div>
        <button className="text-xs font-mono text-brass hover:underline self-start sm:self-center">
          {expanded ? "Collapse ▲" : "Expand ▼"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-line bg-paper/30 p-4 space-y-4 text-xs leading-relaxed animate-fade-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-graphite mb-1.5">
                Sent Email Content
              </span>
              <div className="bg-white p-3 rounded border border-line font-serif text-[13px] leading-relaxed whitespace-pre-wrap select-text max-h-72 overflow-y-auto">
                {item.body}
              </div>
            </div>
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-graphite mb-1.5">
                Original Job Posting
              </span>
              <div className="bg-white p-3 rounded border border-line font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text max-h-72 overflow-y-auto text-ink/80">
                {item.jobContent || "No job posting details available."}
              </div>
            </div>
          </div>
          {item.error && (
            <p className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded">
              Error log: {item.error}
            </p>
          )}
        </div>
      )}
    </div>
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
