import { db } from "@/lib/db";

export async function GET() {
  try {
    const jobs = await db.videoJob.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return Response.json({ ok: true, jobs });
  } catch (error) {
    console.error("List jobs error:", error);

    return Response.json(
      {
        ok: false,
        error: "Failed to load jobs",
      },
      { status: 500 }
    );
  }
}