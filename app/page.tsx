"use client";

import { useEffect, useMemo, useState } from "react";

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

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusClasses(status: string) {
  switch (status) {
    case "queued":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "transcribed":
      return "border-sky-500/20 bg-sky-500/10 text-sky-200";
    case "clips_ready":
      return "border-violet-500/20 bg-violet-500/10 text-violet-200";
    case "clips_rendered":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    default:
      return "border-zinc-700 bg-zinc-800 text-zinc-200";
  }
}

export default function HomePage() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

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
      } else {
        console.error(data.error);
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
      } else {
        console.error(data.error);
      }
    } catch (error) {
      console.error("Generate clips error:", error);
    }
  }

  async function renderClips(jobId: string) {
    try {
      const res = await fetch("/api/jobs/render", {
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
      } else {
        console.error(data.error);
      }
    } catch (error) {
      console.error("Render clips error:", error);
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

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full px-4 py-4 sm:px-6 lg:px-8" style={{ maxWidth: 1200 }}>
        <div className="rounded-[28px] border border-white/10 bg-zinc-900 shadow-2xl">
          <div className="border-b border-white/10 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">AI clip workflow</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Viral Clip Studio</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Minimal workspace for transcript, clip ideas, and rendered previews.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:w-[420px]">
                <div className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Jobs</p>
                  <p className="mt-1 text-xl font-semibold">{jobs.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Rendered</p>
                  <p className="mt-1 text-xl font-semibold">
                    {jobs.filter((job) => job.status === "clips_rendered").length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Clips</p>
                  <p className="mt-1 text-xl font-semibold">
                    {jobs.reduce((sum, job) => sum + (job.clips?.length ?? 0), 0)}
                  </p>
                </div>
                <div className="col-span-3 rounded-2xl border border-white/10 bg-zinc-950 px-3 py-3 sm:col-span-1">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Source</p>
                  <p className="mt-1 truncate text-sm font-medium text-zinc-200">
                    {file ? "Upload" : youtubeUrl.trim() ? "YouTube" : "Idle"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <section className="rounded-3xl border border-white/10 bg-zinc-950 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">New job</h2>
                    <p className="mt-1 text-xs text-zinc-400">Start with one source only.</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-300">
                    Input
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-200">YouTube URL</label>
                    <input
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-400/50"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-200">Upload video</label>
                    <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900 p-4">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full cursor-pointer text-sm text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Selected</p>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-200">{activeSourceLabel}</p>
                  </div>

                  <button
                    onClick={handleStart}
                    disabled={loading}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                  >
                    {loading ? "Creating..." : "Create processing job"}
                  </button>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-950 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">Recent jobs</h3>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-300">
                    {jobs.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {jobs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-500">
                      No jobs yet.
                    </div>
                  ) : (
                    jobs.slice(0, 4).map((job) => (
                      <div
                        key={job.id}
                        className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium text-white">{job.sourceName}</p>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] ${getStatusClasses(job.status)}`}>
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
                <details className="rounded-3xl border border-white/10 bg-zinc-950 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-white">Latest response</summary>
                  <pre className="mt-3 max-h-56 overflow-auto rounded-2xl border border-white/10 bg-zinc-900 p-4 text-xs leading-6 text-zinc-300">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              )}
            </aside>

            <section>
              {featuredJob ? (
                <article className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
                  <div className="border-b border-white/10 px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="truncate text-2xl font-semibold text-white">{featuredJob.sourceName}</h2>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${getStatusClasses(featuredJob.status)}`}>
                            {formatStatusLabel(featuredJob.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">
                          Focused workspace for the latest job so you do not need to scroll through everything.
                        </p>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Created</p>
                            <p className="mt-1 text-sm font-medium text-zinc-200">
                              {new Date(featuredJob.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Transcript</p>
                            <p className="mt-1 text-sm font-medium text-zinc-200">
                              {featuredJob.transcript ? "Available" : "Not generated"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Clips</p>
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
                          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-40"
                        >
                          Generate clips
                        </button>
                        <button
                          onClick={() => renderClips(featuredJob.id)}
                          disabled={!featuredJob.clips || featuredJob.clips.length === 0}
                          className="rounded-2xl border border-sky-500/20 bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:opacity-40"
                        >
                          Render clips
                        </button>
                        <button
                          onClick={() => deleteJob(featuredJob.id)}
                          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15"
                        >
                          Delete job
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-4">
                      {featuredJob.transcript && (
                        <details className="rounded-3xl border border-white/10 bg-zinc-900 p-4" open>
                          <summary className="cursor-pointer text-sm font-semibold text-white">
                            Transcript
                          </summary>
                          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                            {featuredJob.transcript}
                          </pre>
                        </details>
                      )}

                      {featuredJob.clips && featuredJob.clips.length > 0 ? (
                        <div className="grid gap-3 lg:grid-cols-3">
                          {featuredJob.clips.slice(0, 3).map((clip, index) => (
                            <div
                              key={index}
                              className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900"
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
                                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-300">
                                    {clip.start}
                                  </span>
                                </div>

                                <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">
                                  {clip.reason}
                                </p>
                              </div>

                              {clip.outputPath ? (
                                <div className="border-t border-white/10 bg-black">
                                  <video controls className="aspect-[9/12] w-full bg-black object-cover">
                                    <source src={clip.outputPath} type="video/mp4" />
                                    Your browser does not support the video tag.
                                  </video>
                                </div>
                              ) : (
                                <div className="border-t border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
                                  Render this job to preview the clip.
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-900 px-4 py-12 text-center text-sm text-zinc-500">
                          Generate clip suggestions to populate the minimal preview area.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <section className="rounded-3xl border border-white/10 bg-zinc-900 p-4">
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
                              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-zinc-300"
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white">
                                {index + 1}
                              </div>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      {recentJobs.length > 0 && (
                        <section className="rounded-3xl border border-white/10 bg-zinc-900 p-4">
                          <h3 className="text-sm font-semibold text-white">More recent jobs</h3>
                          <div className="mt-3 space-y-2">
                            {recentJobs.map((job) => (
                              <div
                                key={job.id}
                                className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="truncate text-sm font-medium text-white">{job.sourceName}</p>
                                  <span className={`rounded-full border px-2.5 py-1 text-[10px] ${getStatusClasses(job.status)}`}>
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
                <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-950 px-6 py-16 text-center">
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
    </main>
  );
}