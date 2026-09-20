"use client";

import { useState, useRef, useCallback } from "react";
import {
  ShieldCheck,
  MessageSquareWarning,
  Image as ImageIcon,
  Mic,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  X,
  FileAudio,
  Zap,
  Brain,
  Cloud,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
interface AnalysisResult {
  score: number;
  verdict: "SAFE" | "SCAM" | "SUSPICIOUS" | "ERROR";
  explanation: string;
  flags: string[];
  transcript?: string;
}

type TabId = "text" | "image" | "audio";

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */
const TABS: { id: TabId; label: string; mobileLabel: string; icon: React.ReactNode; desc: string }[] = [
  { id: "text", label: "Text & Social", mobileLabel: "Text", icon: <MessageSquareWarning className="w-4 h-4" />, desc: "Paste a suspicious SMS, WhatsApp forward, Instagram DM, email, or URL" },
  { id: "image", label: "Image / Screenshot", mobileLabel: "Image", icon: <ImageIcon className="w-4 h-4" />, desc: "Upload a payment receipt, UPI screenshot, or suspicious image" },
  { id: "audio", label: "Audio Call", mobileLabel: "Audio", icon: <Mic className="w-4 h-4" />, desc: "Upload a suspicious voice note or call recording" },
];

const SAMPLE_SCAMS = [
  {
    label: "🏦 Bank OTP",
    text: "URGENT: Your SBI account has been blocked due to KYC expiry. Click here immediately to update: http://sbi-kyc-update.xyz/verify. Enter your Aadhaar & OTP within 30 minutes or your account will be permanently closed and funds frozen. - SBI Security Team",
  },
  {
    label: "🎁 Lottery Scam",
    text: "Congratulations! 🎉 You've been selected as the winner of ₹25,00,000 in Amazon India Lucky Draw 2026! To claim your prize, send your Aadhaar number, PAN card, bank account details, and a processing fee of ₹2,999 via Paytm to verify@lottery. Offer expires in 24 hours! Ref: AZ-928471",
  },
  {
    label: "💼 Fake Job",
    text: "Hi, I'm Priya from Google HR India. We found your resume very impressive and want to offer you a Work From Home Data Entry position at ₹50,000/month. No interview needed! Just pay ₹4,500 registration fee to secure your spot. Limited seats. WhatsApp: +91-9876543210",
  },
  {
    label: "✅ Safe Message",
    text: "Hey! Are we still meeting for coffee tomorrow at 3pm? The new café near Koramangala has great reviews. Let me know if the time works for you!",
  },
];

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp";
const ACCEPTED_AUDIO_TYPES = "audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,audio/x-m4a,audio/mp3,audio/x-wav";

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const getScoreColor = (score: number) => {
  if (score <= 30) return "#34d399";
  if (score <= 60) return "#fbbf24";
  return "#f87171";
};

const getVerdictDisplay = (verdict: string) => {
  switch (verdict) {
    case "SAFE":
      return { text: "No Threat Detected", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    case "SCAM":
      return { text: "Threat Detected!", cls: "text-red-400 bg-red-500/10 border-red-500/20" };
    case "SUSPICIOUS":
      return { text: "Suspicious Content", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
    default:
      return { text: "Analysis Error", cls: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" };
  }
};

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */
function ThreatGauge({ score }: { score: number }) {
  const C = 2 * Math.PI * 45;
  const offset = C - (score / 100) * C;
  const color = getScoreColor(score);
  return (
    <div className="flex flex-col items-center shrink-0">
      <svg viewBox="0 0 120 120" className="w-24 h-24 sm:w-28 sm:h-28">
        <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={C} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.5s ease" }}
        />
        <text x="60" y="53" textAnchor="middle" dominantBaseline="central" fill="#0f172a" fontSize="26" fontWeight="bold">{score}</text>
        <text x="60" y="75" textAnchor="middle" fill="#64748b" fontSize="10">/ 100</text>
      </svg>
      <p className="text-[10px] text-slate-500 mt-0.5 tracking-wider uppercase">Threat Score</p>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Dashboard
   ═══════════════════════════════════════════ */
export default function FakeBusterDashboard() {
  /* ── State ── */
  const [activeTab, setActiveTab] = useState<TabId>("text");
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Handlers ── */
  const switchTab = (tab: TabId) => { setActiveTab(tab); setResult(null); setSelectedFile(null); setFilePreview(null); };

  const pickFile = useCallback((file: File) => {
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const r = new FileReader();
      r.onload = () => setFilePreview(r.result as string);
      r.readAsDataURL(file);
    } else {
      setFilePreview(file.name);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }, [pickFile]);
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const clearFile = () => { setSelectedFile(null); setFilePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const copyReport = () => {
    if (!result) return;
    const txt = `FakeBuster Report\n\nVerdict: ${result.verdict} (${result.score}/100)\n\n${result.explanation}\n\nRed Flags: ${result.flags.join(", ")}${result.transcript ? `\n\nTranscript: ${result.transcript}` : ""}`;
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const analyze = async () => {
    if (activeTab === "text" && !inputText.trim()) return;
    if (activeTab !== "text" && !selectedFile) return;
    setIsAnalyzing(true);
    setResult(null);

    try {
      let res: Response;
      if (activeTab === "text") {
        res = await fetch("/api/analyze/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: inputText }) });
      } else if (activeTab === "image") {
        const b64 = await fileToBase64(selectedFile!);
        res = await fetch("/api/analyze/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: b64, mediaType: selectedFile!.type }) });
      } else {
        const fd = new FormData();
        fd.append("audio", selectedFile!);
        res = await fetch("/api/analyze/audio", { method: "POST", body: fd });
      }
      const data = await res.json();
      setResult(data);
      setScanCount((c) => c + 1);
    } catch {
      setResult({ score: 0, verdict: "ERROR", explanation: "Network error — check your connection and try again.", flags: [] });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const canAnalyze = activeTab === "text" ? inputText.trim().length > 0 : !!selectedFile;

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-violet-500/20">
      {/* ── Animated Background ── */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-100/40 via-transparent to-cyan-100/30 animate-gradient-shift" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* ════════ Header ════════ */}
        <header className="border-b border-slate-200/60 backdrop-blur-xl bg-white/70 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-xl shadow-lg shadow-violet-500/20 animate-pulse-ring">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight">FakeBuster</h1>
                <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] leading-none">AWS Powered</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {scanCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                  <Zap className="w-3 h-3 text-amber-500" />
                  {scanCount} scan{scanCount !== 1 && "s"}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-[11px]">● Online</span>
            </div>
          </div>
        </header>

        {/* ════════ Hero ════════ */}
        <section className="pt-10 pb-8 sm:pt-14 sm:pb-10 text-center px-4">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-[11px] mb-5">
              <Sparkles className="w-3 h-3" />
              AWS First Commit Hackathon — Bharat Builds Tour 2026
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight max-w-3xl mx-auto text-slate-900">
              Your AI Shield Against{" "}
              <span className="gradient-text">Digital Deception</span>
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              Detect scams, deepfakes, and phishing in seconds — powered by Amazon Bedrock, S3, and Transcribe.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
            {["Amazon Bedrock", "Amazon S3", "Amazon Transcribe", "AWS Amplify"].map((s) => (
              <span key={s} className="px-2.5 py-1 text-[10px] rounded-md bg-white border border-slate-200 text-slate-500 tracking-wide shadow-sm">{s}</span>
            ))}
          </div>
        </section>

        {/* ════════ Main Scanner ════════ */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16" id="scanner">
          <div className="grid lg:grid-cols-2 gap-5">

            {/* ── INPUT PANEL ── */}
            <div className="glass rounded-2xl p-4 sm:p-6 space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/50" role="tablist" aria-label="Analysis type">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={activeTab === t.id} onClick={() => switchTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                      activeTab === t.id ? "bg-white text-violet-700 shadow border border-slate-200/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}>
                    {t.icon}
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sm:hidden">{t.mobileLabel}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">{TABS.find((t) => t.id === activeTab)?.desc}</p>

              {/* ── Text Input ── */}
              {activeTab === "text" && (
                <div className="space-y-3">
                  <textarea
                    id="text-input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste suspicious message, post, or URL here…"
                    className="w-full h-32 sm:h-36 bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none transition-all shadow-sm"
                    maxLength={5000}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Try a sample ↓</span>
                    <span className="text-[10px] text-slate-400">{inputText.length} / 5 000</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_SCAMS.map((s) => (
                      <button key={s.label} onClick={() => { setInputText(s.text); setResult(null); }}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-violet-300 transition-all shadow-sm">
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Image Upload ── */}
              {activeTab === "image" && (
                <div className="space-y-3">
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} className="hidden" id="img-upload" />
                  {!selectedFile ? (
                    <label htmlFor="img-upload" onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                      className={`flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed cursor-pointer transition-all bg-white ${
                        dragOver ? "border-violet-400 bg-violet-50" : "border-slate-300 hover:border-violet-300 hover:bg-slate-50"
                      }`}>
                      <Upload className={`w-7 h-7 mb-2 ${dragOver ? "text-violet-500" : "text-slate-400"}`} />
                      <span className="text-sm text-slate-600">Click or drag image here</span>
                      <span className="text-[10px] text-slate-400 mt-1">JPEG · PNG · WebP · GIF</span>
                    </label>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                      {filePreview && <img src={filePreview} alt="Preview" className="w-full h-36 object-contain bg-slate-100" />}
                      <button onClick={clearFile} className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 shadow-sm transition-all" aria-label="Remove file"><X className="w-4 h-4" /></button>
                      <div className="p-2 bg-slate-50 text-[11px] text-slate-600 truncate border-t border-slate-200">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Audio Upload ── */}
              {activeTab === "audio" && (
                <div className="space-y-3">
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_AUDIO_TYPES} onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} className="hidden" id="audio-upload" />
                  {!selectedFile ? (
                    <label htmlFor="audio-upload" onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                      className={`flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed cursor-pointer transition-all bg-white ${
                        dragOver ? "border-violet-400 bg-violet-50" : "border-slate-300 hover:border-violet-300 hover:bg-slate-50"
                      }`}>
                      <Mic className={`w-7 h-7 mb-2 ${dragOver ? "text-violet-500" : "text-slate-400"}`} />
                      <span className="text-sm text-slate-600">Upload voice note or recording</span>
                      <span className="text-[10px] text-slate-400 mt-1">MP3 · WAV · M4A · OGG · WebM</span>
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                      <div className="p-3 rounded-lg bg-violet-100 shrink-0"><FileAudio className="w-5 h-5 text-violet-600" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button onClick={clearFile} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all" aria-label="Remove file"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Analyze Button ── */}
              <button id="scan-button" onClick={analyze} disabled={isAnalyzing || !canAnalyze}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-35 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 active:scale-[0.98]">
                {isAnalyzing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /><span>Analyzing{activeTab === "audio" ? " (transcribing…)" : "…"}</span></>
                ) : (
                  <><ShieldCheck className="w-5 h-5" /><span>Scan for Threats</span></>
                )}
              </button>
              {activeTab === "audio" && isAnalyzing && (
                <p className="text-[10px] text-zinc-600 text-center">Audio is being transcribed with Amazon Transcribe — this may take 15–30 s…</p>
              )}
            </div>

            {/* ── RESULTS PANEL ── */}
            <div className="glass rounded-2xl p-4 sm:p-6 relative overflow-hidden min-h-[380px]">
              {/* Scan‑line overlay */}
              {isAnalyzing && (
                <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-2xl">
                  <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-scan-line" />
                </div>
              )}

              {!result && !isAnalyzing ? (
                /* Empty state */
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <ShieldCheck className="w-14 h-14 opacity-20 mb-3 animate-float" />
                  <p className="text-sm text-slate-500">Awaiting input for analysis</p>
                  <p className="text-[10px] text-slate-400 mt-1">Paste text, upload a file, or try a sample</p>
                </div>
              ) : result ? (
                /* Results */
                <div className="space-y-4 sm:space-y-5">
                  {/* Gauge + Verdict */}
                  <div className="flex items-start gap-4">
                    <ThreatGauge score={result.score} />
                    <div className="flex-1 pt-1">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                        result.verdict === "SAFE" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                        result.verdict === "SCAM" ? "text-red-700 bg-red-50 border-red-200" :
                        "text-amber-700 bg-amber-50 border-amber-200"
                      }`}>
                        {result.verdict === "SAFE" || result.verdict === "ERROR" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {getVerdictDisplay(result.verdict).text}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Analyzed via Amazon Bedrock (Claude 3 Haiku){result.transcript ? " + Amazon Transcribe + S3" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Transcript (audio) */}
                  {result.transcript && (
                    <div>
                      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Transcription (Amazon Transcribe)</h4>
                      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 italic leading-relaxed max-h-20 overflow-y-auto">
                        &ldquo;{result.transcript}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Explanation */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Analysis Report</h4>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">{result.explanation}</p>
                  </div>

                  {/* Flags */}
                  {result.flags?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Red Flags Identified</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {result.flags.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-red-50 border border-red-200 text-red-600">
                            <AlertTriangle className="w-3 h-3 shrink-0" />{f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Copy */}
                  <button onClick={copyReport}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-all">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy Report"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ════════ How It Works ════════ */}
        <section className="border-t border-slate-200 bg-white" id="how-it-works">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <h3 className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em] mb-8">How It Works</h3>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { icon: <Upload className="w-6 h-6" />, title: "1. Upload", desc: "Paste suspicious text, upload a screenshot, or drop a voice recording." },
                { icon: <Brain className="w-6 h-6" />, title: "2. AI Analysis", desc: "AWS Bedrock's Claude AI analyzes for psychological manipulation, phishing URLs, and scam patterns." },
                { icon: <ShieldCheck className="w-6 h-6" />, title: "3. Get Protected", desc: "Receive an instant threat score, detailed report, and actionable red flags in under 5 seconds." },
              ].map((step, i) => (
                <div key={i} className="glass rounded-xl p-5 text-center group hover:shadow-md transition-all duration-300 bg-slate-50/50">
                  <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-violet-100 to-cyan-100 text-violet-600 mb-3 group-hover:scale-110 transition-transform duration-300">{step.icon}</div>
                  <h4 className="font-semibold text-slate-900 text-sm mb-1.5">{step.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ AWS Architecture ════════ */}
        <section className="border-t border-slate-200" id="architecture">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <h3 className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em] mb-1.5">Built on AWS</h3>
            <p className="text-center text-slate-500 text-xs mb-8">Enterprise-grade cloud AI services</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {[
                { name: "Amazon Bedrock", desc: "AI reasoning · Claude 3 Haiku", gradient: "from-violet-100 to-violet-50" },
                { name: "Amazon S3", desc: "Secure media storage", gradient: "from-emerald-100 to-emerald-50" },
                { name: "Amazon Transcribe", desc: "Speech-to-text engine", gradient: "from-cyan-100 to-cyan-50" },
                { name: "AWS Amplify", desc: "Hosting & CI/CD", gradient: "from-amber-100 to-amber-50" },
              ].map((svc) => (
                <div key={svc.name} className="glass rounded-xl p-4 text-center hover:shadow-md transition-all group bg-white">
                  <div className={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${svc.gradient} mb-2.5 group-hover:scale-110 transition-transform duration-300`}>
                    <Cloud className="w-5 h-5 text-slate-600" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-medium text-slate-900">{svc.name}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">{svc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ Footer ════════ */}
        <footer className="border-t border-slate-200 py-6 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-1">
            <p className="text-[11px] text-slate-500">
              Built with ❤️ by <span className="text-slate-800 font-medium">Team Gawds</span> for{" "}
              <span className="text-slate-800">AWS First Commit Hackathon</span> — Bharat Builds Tour 2026
            </p>
            <p className="text-[10px] text-slate-400">Eshant Gupta · Aditya · Mayank · Arun Kumar Swami</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
