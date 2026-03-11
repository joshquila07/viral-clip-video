"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Film,
  FolderClock,
  Inbox,
  Loader2,
  Sparkles,
  Upload,
  Youtube,
} from "lucide-react";

type Clip = {
  title: string;
  start: string;
  end: string;
  reason: string;
  outputPath?: string;
};

type Job = {
  id: string;
  sourceType: string;
  sourceName: string;
  youtubeUrl: string | null;
  status: string;
  transcript: string | null;
  clips: Clip[] | null;
  createdAt: string;
};

type ApiResult = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

type CaptionStyle = {
  fontSize: number;
  marginV: number;
  outline: number;
  textColor: string;
  outlineColor: string;
  bold: boolean;
  textTransform: "original" | "uppercase" | "sentence" | "title" | "lowercase";
};

type RenderNotice = {
  tone: "success" | "error" | "info";
  message: string;
};

const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 72,
  marginV: 220,
  outline: 4,
  textColor: "#FFFFFF",
  outlineColor: "#000000",
  bold: true,
  textTransform: "original",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapPreviewText(text: string, fontSize: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const words = normalized.split(" ");
  const maxCharsPerLine = clamp(Math.floor(2200 / fontSize), 12, 30);
  const maxLines = fontSize >= 100 ? 3 : 2;
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxCharsPerLine || currentLine.length === 0) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  const usedWords = lines.join(" ").split(" ").filter(Boolean).length;
  const remainingWords = words.slice(usedWords);

  if (currentLine) {
    lines.push(currentLine.split(" ").concat(remainingWords).join(" "));
  } else if (remainingWords.length > 0) {
    lines.push(remainingWords.join(" "));
  }

  return lines.slice(0, maxLines).join("\n");
}

function applyPreviewTextTransform(
  text: string,
  transform: CaptionStyle["textTransform"]
) {
  const normalized = text.trim();
  if (!normalized) return normalized;

  switch (transform) {
    case "uppercase":
      return normalized.toUpperCase();
    case "lowercase":
      return normalized.toLowerCase();
    case "sentence": {
      const lower = normalized.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    case "title":
      return normalized.replace(/\w\S*/g, (word) => {
        const lower = word.toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      });
    default:
      return normalized;
  }
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusClasses(status: string) {
  switch (status) {
    case "queued":
      return "bg-amber-500/12 text-amber-200 ring-1 ring-inset ring-amber-500/20";
    case "transcribed":
      return "bg-sky-500/12 text-sky-200 ring-1 ring-inset ring-sky-500/20";
    case "clips_ready":
      return "bg-violet-500/12 text-violet-200 ring-1 ring-inset ring-violet-500/20";
    case "clips_rendered":
      return "bg-emerald-500/12 text-emerald-200 ring-1 ring-inset ring-emerald-500/20";
    default:
      return "bg-zinc-800 text-zinc-200 ring-1 ring-inset ring-white/10";
  }
}

export default function HomePage() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [renderingJobId, setRenderingJobId] = useState<string | null>(null);
  const [renderNotice, setRenderNotice] = useState<RenderNotice | null>(null);

  const activeSourceLabel = useMemo(() => {
    if (file) return file.name;
    if (youtubeUrl.trim()) return youtubeUrl.trim();
    return "No source selected";
  }, [file, youtubeUrl]);

  const featuredJob = jobs[0] ?? null;
  const recentJobs = jobs.slice(1, 5);

  async function loadJobs() {
    try {
      const res = await fetch("/api/jobs/list");
      const data = await res.json();

      if (data.ok) {
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error("Load jobs error:", error);
    }
  }

  async function generateTranscript(jobId: string) {
    try {
      const res = await fetch("/api/jobs/transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json();
      setResult(data);

      if (data.ok) {
        await loadJobs();
      }
    } catch (error) {
      console.error("Generate transcript error:", error);
    }
  }

  async function deleteJob(jobId: string) {
    const res = await fetch("/api/jobs/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId }),
    });

    const data = await res.json();
    setResult(data);

    if (data.ok) {
      await loadJobs();
    }
  }

  async function generateClips(jobId: string) {
    try {
      const res = await fetch("/api/jobs/clips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json();
      setResult(data);

      if (data.ok) {
        await loadJobs();
      }
    } catch (error) {
      console.error("Generate clips error:", error);
    }
  }

  async function renderClips(jobId: string) {
    try {
      setRenderingJobId(jobId);
      setRenderNotice({
        tone: "info",
        message: "Rendering clips with burned-in captions. This can take a minute.",
      });

      const res = await fetch("/api/jobs/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId, captionStyle }),
      });

      const data = await res.json();
      setResult(data);

      if (data.ok) {
        await loadJobs();
        setRenderNotice({
          tone: "success",
          message: "Render complete. Your clips were exported successfully.",
        });
      } else {
        setRenderNotice({
          tone: "error",
          message:
            typeof data.error === "string"
              ? data.error
              : "Rendering failed. Check the latest response for details.",
        });
      }
    } catch (error) {
      console.error("Render clips error:", error);
      setRenderNotice({
        tone: "error",
        message: "Rendering failed. Check the terminal or latest response for details.",
      });
    } finally {
      setRenderingJobId(null);
    }
  }

  async function handleStart() {
    try {
      setLoading(true);

      const formData = new FormData();
      if (youtubeUrl) formData.append("youtubeUrl", youtubeUrl);
      if (file) formData.append("file", file);

      const res = await fetch("/api/jobs/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);

      if (data.ok) {
        setYoutubeUrl("");
        setFile(null);
        await loadJobs();
      }
    } catch (error) {
      console.error("Start error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  const isRenderingFeaturedJob = featuredJob ? renderingJobId === featuredJob.id : false;
  const previewScale = 0.19;
  const previewText = wrapPreviewText(
    applyPreviewTextTransform(
      "Tapos doon na nagsimula ang mainit mainit nilang usapan.",
      captionStyle.textTransform
    ),
    captionStyle.fontSize
  );
  const previewFontSize = Math.max(12, Math.round(captionStyle.fontSize * previewScale));
  const previewMarginBottom = Math.round(captionStyle.marginV * previewScale);
  const previewOutline = Math.max(1, Math.round(captionStyle.outline * previewScale));

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-[32px] bg-zinc-900 shadow-2xl ring-1 ring-white/10">
          <div className="px-5 pb-5 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-zinc-400 ring-1 ring-white/10">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI clip workflow
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Viral Clip Studio
                </h1>
                <p className="mt-3 text-sm leading-6 text-zinc-400 sm:text-base">
                  A cleaner workspace for transcript, clip ideas, and rendered
                  previews.
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-[420px]">
                <div className="rounded-2xl bg-zinc-950 px-4 py-3 ring-1 ring-white/10">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Film className="h-4 w-4" />
                    <p className="text-[11px] uppercase tracking-[0.18em]">
                      Jobs
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold">{jobs.length}</p>
                </div>
                <div className="rounded-2xl bg-zinc-950 px-4 py-3 ring-1 ring-white/10">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-[11px] uppercase tracking-[0.18em]">
                      Rendered
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold">
                    {jobs.filter((job) => job.status === "clips_rendered").length}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-950 px-4 py-3 ring-1 ring-white/10">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <FolderClock className="h-4 w-4" />
                    <p className="text-[11px] uppercase tracking-[0.18em]">
                      Clips
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold">
                    {jobs.reduce((sum, job) => sum + (job.clips?.length ?? 0), 0)}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-950 px-4 py-3 ring-1 ring-white/10">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Upload className="h-4 w-4" />
                    <p className="text-[11px] uppercase tracking-[0.18em]">
                      Source
                    </p>
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-zinc-200">
                    {file ? "Upload" : youtubeUrl.trim() ? "YouTube" : "Idle"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <section className="rounded-3xl bg-zinc-950 p-4 ring-1 ring-white/10">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">New job</h2>
                      <p className="mt-1 text-xs text-zinc-400">
                        Start with one source only.
                      </p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-zinc-300 ring-1 ring-white/10">
                      Input
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
                        <Youtube className="h-4 w-4" />
                        YouTube URL
                      </label>
                      <input
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>

                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
                        <Upload className="h-4 w-4" />
                        Upload video
                      </label>

                      <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-900 p-5">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="mb-3 rounded-full bg-white/5 p-3 ring-1 ring-white/10">
                            <Inbox className="h-5 w-5 text-zinc-300" />
                          </div>
                          <p className="text-sm font-medium text-white">
                            Drag and drop video here
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            or choose a local file to start rendering tests
                          </p>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            className="mt-4 block w-full cursor-pointer text-sm text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        Selected
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-200">
                        {activeSourceLabel}
                      </p>
                    </div>

                    <button
                      onClick={handleStart}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {loading ? "Creating..." : "Create processing job"}
                    </button>
                  </div>
                </section>

                <section className="rounded-3xl bg-zinc-950 p-4 ring-1 ring-white/10">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">Caption style</h2>
                      <p className="mt-1 text-xs text-zinc-400">
                        Applied the next time you render clips.
                      </p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-zinc-300 ring-1 ring-white/10">
                      Burn-in
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-zinc-200">Font size</span>
                          <span className="text-xs text-zinc-500">{captionStyle.fontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="28"
                          max="140"
                          value={captionStyle.fontSize}
                          onChange={(e) =>
                            setCaptionStyle((current) => ({
                              ...current,
                              fontSize: Number(e.target.value),
                            }))
                          }
                          className="mt-3 w-full accent-white"
                        />
                      </label>

                      <label className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-zinc-200">Bottom offset</span>
                          <span className="text-xs text-zinc-500">{captionStyle.marginV}px</span>
                        </div>
                        <input
                          type="range"
                          min="80"
                          max="420"
                          step="10"
                          value={captionStyle.marginV}
                          onChange={(e) =>
                            setCaptionStyle((current) => ({
                              ...current,
                              marginV: Number(e.target.value),
                            }))
                          }
                          className="mt-3 w-full accent-white"
                        />
                      </label>

                      <label className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-zinc-200">Outline</span>
                          <span className="text-xs text-zinc-500">{captionStyle.outline}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="8"
                          value={captionStyle.outline}
                          onChange={(e) =>
                            setCaptionStyle((current) => ({
                              ...current,
                              outline: Number(e.target.value),
                            }))
                          }
                          className="mt-3 w-full accent-white"
                        />
                      </label>

                      <label className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                        <span className="text-sm font-medium text-zinc-200">Weight</span>
                        <select
                          value={captionStyle.bold ? "bold" : "regular"}
                          onChange={(e) =>
                            setCaptionStyle((current) => ({
                              ...current,
                              bold: e.target.value === "bold",
                            }))
                          }
                          className="mt-3 w-full rounded-xl bg-zinc-950 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10"
                        >
                          <option value="bold">Bold</option>
                          <option value="regular">Regular</option>
                        </select>
                      </label>

                      <label className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                        <span className="text-sm font-medium text-zinc-200">Character style</span>
                        <select
                          value={captionStyle.textTransform}
                          onChange={(e) =>
                            setCaptionStyle((current) => ({
                              ...current,
                              textTransform: e.target.value as CaptionStyle["textTransform"],
                            }))
                          }
                          className="mt-3 w-full rounded-xl bg-zinc-950 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10"
                        >
                          <option value="original">Original</option>
                          <option value="uppercase">ALL CAPS</option>
                          <option value="sentence">First Letter Capital</option>
                          <option value="title">Title Case</option>
                          <option value="lowercase">lowercase</option>
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                        <span className="text-sm font-medium text-zinc-200">Text color</span>
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="color"
                            value={captionStyle.textColor}
                            onChange={(e) =>
                              setCaptionStyle((current) => ({
                                ...current,
                                textColor: e.target.value.toUpperCase(),
                              }))
                            }
                            className="h-10 w-14 rounded-lg border-0 bg-transparent p-0"
                          />
                          <span className="text-xs text-zinc-500">{captionStyle.textColor}</span>
                        </div>
                      </label>

                      <label className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                        <span className="text-sm font-medium text-zinc-200">Outline color</span>
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="color"
                            value={captionStyle.outlineColor}
                            onChange={(e) =>
                              setCaptionStyle((current) => ({
                                ...current,
                                outlineColor: e.target.value.toUpperCase(),
                              }))
                            }
                            className="h-10 w-14 rounded-lg border-0 bg-transparent p-0"
                          />
                          <span className="text-xs text-zinc-500">{captionStyle.outlineColor}</span>
                        </div>
                      </label>
                    </div>

                    <div className="rounded-2xl bg-zinc-900 px-4 py-4 ring-1 ring-white/10">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        Preview
                      </p>
                      <div className="mt-3 aspect-[9/16] rounded-2xl bg-zinc-950 p-4 ring-1 ring-white/10">
                        <div className="flex h-full items-end justify-center">
                          <p
                            className="max-w-[88%] whitespace-pre-line text-center leading-tight"
                            style={{
                              color: captionStyle.textColor,
                              fontSize: `${previewFontSize}px`,
                              fontWeight: captionStyle.bold ? 700 : 400,
                              marginBottom: `${previewMarginBottom}px`,
                              textShadow:
                                captionStyle.outline > 0
                                  ? `0 0 ${previewOutline}px ${captionStyle.outlineColor},
                                     0 0 ${previewOutline * 2}px ${captionStyle.outlineColor}`
                                  : "none",
                            }}
                          >
                            {previewText}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl bg-zinc-950 p-4 ring-1 ring-white/10">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold">Recent jobs</h3>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-zinc-300 ring-1 ring-white/10">
                      {jobs.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {jobs.length === 0 ? (
                      <div className="rounded-2xl bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-500 ring-1 ring-white/10">
                        No jobs yet.
                      </div>
                    ) : (
                      jobs.slice(0, 4).map((job) => (
                        <div
                          key={job.id}
                          className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-medium text-white">
                              {job.sourceName}
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] ${getStatusClasses(
                                job.status
                              )}`}
                            >
                              {formatStatusLabel(job.status)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {result && (
                  <details className="rounded-3xl bg-zinc-950 p-4 ring-1 ring-white/10">
                    <summary className="cursor-pointer text-sm font-semibold text-white">
                      Latest response
                    </summary>
                    <pre className="mt-3 max-h-56 overflow-auto rounded-2xl bg-zinc-900 p-4 text-xs leading-6 text-zinc-300 ring-1 ring-white/10">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                )}
              </aside>

              <section>
                {featuredJob ? (
                  <article className="overflow-hidden rounded-3xl bg-zinc-950 ring-1 ring-white/10">
                    {renderNotice && (
                      <div
                        className={`border-b px-4 py-3 text-sm sm:px-5 ${
                          renderNotice.tone === "success"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                            : renderNotice.tone === "error"
                              ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
                              : "border-sky-500/20 bg-sky-500/10 text-sky-100"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {renderNotice.tone === "info" && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          <span>{renderNotice.message}</span>
                        </div>
                      </div>
                    )}
                    <div className="px-4 py-4 sm:px-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="truncate text-2xl font-semibold text-white">
                              {featuredJob.sourceName}
                            </h2>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-medium ${getStatusClasses(
                                featuredJob.status
                              )}`}
                            >
                              {formatStatusLabel(featuredJob.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">
                            Focused workspace for the latest job.
                          </p>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                                Created
                              </p>
                              <p className="mt-1 text-sm font-medium text-zinc-200">
                                {new Date(featuredJob.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                                Transcript
                              </p>
                              <p className="mt-1 text-sm font-medium text-zinc-200">
                                {featuredJob.transcript ? "Available" : "Not generated"}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
                              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                                Clips
                              </p>
                              <p className="mt-1 text-sm font-medium text-zinc-200">
                                {featuredJob.clips?.length ?? 0} suggestions
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 xl:w-[220px] xl:grid-cols-1">
                          <button
                            onClick={() => generateTranscript(featuredJob.id)}
                            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                          >
                            Generate transcript
                          </button>
                          <button
                            onClick={() => generateClips(featuredJob.id)}
                            disabled={!featuredJob.transcript}
                            className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                          >
                            Generate clips
                          </button>
                          <button
                            onClick={() => renderClips(featuredJob.id)}
                            disabled={
                              !featuredJob.clips ||
                              featuredJob.clips.length === 0 ||
                              isRenderingFeaturedJob
                            }
                            className="rounded-2xl bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-100 ring-1 ring-sky-500/20 transition hover:bg-sky-500/20 disabled:opacity-40"
                          >
                            <span className="flex items-center justify-center gap-2">
                              {isRenderingFeaturedJob && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              {isRenderingFeaturedJob ? "Rendering..." : "Render clips"}
                            </span>
                          </button>
                          <button
                            onClick={() => deleteJob(featuredJob.id)}
                            className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 ring-1 ring-rose-500/20 transition hover:bg-rose-500/15"
                          >
                            Delete job
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 border-t border-white/10 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="space-y-4">
                        {featuredJob.transcript && (
                          <details className="rounded-3xl bg-zinc-900 p-4 ring-1 ring-white/10" open>
                            <summary className="cursor-pointer text-sm font-semibold text-white">
                              Transcript
                            </summary>
                            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                              {featuredJob.transcript}
                            </pre>
                          </details>
                        )}

                        {featuredJob.clips && featuredJob.clips.length > 0 ? (
                          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                            {featuredJob.clips.slice(0, 3).map((clip, index) => (
                              <div
                                key={index}
                                className="overflow-hidden rounded-3xl bg-zinc-900 ring-1 ring-white/10"
                              >
                                <div className="px-4 py-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                        Clip {index + 1}
                                      </p>
                                      <h3 className="mt-2 line-clamp-2 text-base font-semibold text-white">
                                        {clip.title}
                                      </h3>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-zinc-300 ring-1 ring-white/10">
                                      {clip.start}
                                    </span>
                                  </div>

                                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">
                                    {clip.reason}
                                  </p>
                                </div>

                                {clip.outputPath ? (
                                  <div className="border-t border-white/10 bg-black">
                                    <video
                                      controls
                                      className="aspect-[9/12] w-full bg-black object-cover"
                                    >
                                      <source src={clip.outputPath} type="video/mp4" />
                                      Your browser does not support the video tag.
                                    </video>
                                  </div>
                                ) : (
                                  <div className="border-t border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
                                    {isRenderingFeaturedJob
                                      ? "Rendering clip preview..."
                                      : "Render this job to preview the clip."}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-3xl bg-zinc-900 px-4 py-12 text-center text-sm text-zinc-500 ring-1 ring-dashed ring-white/10">
                            Generate clip suggestions to populate the preview area.
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <section className="rounded-3xl bg-zinc-900 p-4 ring-1 ring-white/10">
                          <h3 className="text-sm font-semibold text-white">Workflow</h3>
                          <div className="mt-3 space-y-2">
                            {[
                              "Create source job",
                              "Generate transcript",
                              "Generate clip suggestions",
                              "Render MP4 outputs",
                              "Upgrade to 9:16 TikTok next",
                            ].map((item, index) => (
                              <div
                                key={item}
                                className="flex items-center gap-3 rounded-2xl bg-zinc-950 px-3 py-3 text-sm text-zinc-300 ring-1 ring-white/10"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-white ring-1 ring-white/10">
                                  {index + 1}
                                </div>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </section>

                        {recentJobs.length > 0 && (
                          <section className="rounded-3xl bg-zinc-900 p-4 ring-1 ring-white/10">
                            <h3 className="text-sm font-semibold text-white">More recent jobs</h3>
                            <div className="mt-3 space-y-2">
                              {recentJobs.map((job) => (
                                <div
                                  key={job.id}
                                  className="rounded-2xl bg-zinc-950 px-4 py-3 ring-1 ring-white/10"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="truncate text-sm font-medium text-white">
                                      {job.sourceName}
                                    </p>
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-[10px] ${getStatusClasses(
                                        job.status
                                      )}`}
                                    >
                                      {formatStatusLabel(job.status)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                      </div>
                    </div>
                  </article>
                ) : (
                  <div className="rounded-3xl bg-zinc-950 px-6 py-16 text-center ring-1 ring-dashed ring-white/10">
                    <p className="text-lg font-medium text-zinc-200">No jobs yet</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Create your first job from the left panel.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
