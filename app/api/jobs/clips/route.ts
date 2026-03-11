import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return Response.json(
        {
          ok: false,
          error: "jobId is required",
        },
        { status: 400 }
      );
    }

    const job = await db.videoJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return Response.json(
        {
          ok: false,
          error: "Job not found",
        },
        { status: 404 }
      );
    }

    if (!job.transcript) {
      return Response.json(
        {
          ok: false,
          error: "Transcript is required before generating clips",
        },
        { status: 400 }
      );
    }

    const fakeClips = [
      {
        title: "Family Argument Moment",
        start: "00:00:10",
        end: "00:00:22",
        reason: "Emotional and relatable family conflict.",
      },
      {
        title: "Proud of the Family",
        start: "00:00:12",
        end: "00:00:18",
        reason: "Strong emotional statement that can hook viewers.",
      },
      {
        title: "Mainit na Usapan",
        start: "00:00:14",
        end: "00:00:22",
        reason: "Good short-form tension moment for TikTok style clips.",
      },
    ];

    const updatedJob = await db.videoJob.update({
      where: { id: jobId },
      data: {
        clips: fakeClips,
        status: "clips_ready",
      },
    });

    return Response.json({
      ok: true,
      job: updatedJob,
    });
  } catch (error) {
    console.error("Generate clips error:", error);

    return Response.json(
      {
        ok: false,
        error: "Failed to generate clips",
      },
      { status: 500 }
    );
  }
}