import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return Response.json({ ok: false, error: "jobId required" });
    }

    await db.videoJob.delete({
      where: { id: jobId },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "Failed to delete job" });
  }
}