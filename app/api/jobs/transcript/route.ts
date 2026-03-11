import { db } from "@/lib/db";
import { formatTranscriptSegments } from "@/lib/transcript";

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

    const fakeSegments = [
      { start: 10, end: 12, text: "Bakit ginawanin nico yun?" },
      { start: 12, end: 14, text: "Ipinagmalaki niya yung kanyang pamilya." },
      { start: 14, end: 18, text: "Tapos doon na nagsimula ang mainit nilang usapan." },
      { start: 18, end: 22, text: "Maraming makaka-relate dito dahil usapang pamilya ito." },
    ];

    const formattedTranscript = formatTranscriptSegments(fakeSegments);

    const updatedJob = await db.videoJob.update({
      where: {
        id: jobId,
      },
      data: {
        transcript: formattedTranscript,
        status: "transcribed",
      },
    });

    return Response.json({
      ok: true,
      job: updatedJob,
    });
  } catch (error) {
    console.error("Transcript update error:", error);

    return Response.json(
      {
        ok: false,
        error: "Failed to generate transcript",
      },
      { status: 500 }
    );
  }
}