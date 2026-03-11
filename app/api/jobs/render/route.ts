import { db } from '@/lib/db';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

function timeToSeconds(t: string) {
  const [hh, mm, ss] = t.split(':').map(Number);
  return hh * 3600 + mm * 60 + ss;
}

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return Response.json({ ok: false, error: 'jobId required' }, { status: 400 });
    }

    const job = await db.videoJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return Response.json({ ok: false, error: 'Job not found' }, { status: 404 });
    }

    if (!job.sourcePath) {
      return Response.json({ ok: false, error: 'No source video for this job' }, { status: 400 });
    }

    if (!job.clips) {
      return Response.json({ ok: false, error: 'No clip suggestions found' }, { status: 400 });
    }

    const clips: any[] = job.clips as any[];

    const rendersDir = path.join(process.cwd(), 'public', 'renders');
    await mkdir(rendersDir, { recursive: true });

    const inputPath = path.join(process.cwd(), 'public', job.sourcePath);

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];

      const startSeconds = timeToSeconds(clip.start);
      const endSeconds = timeToSeconds(clip.end);
      const duration = endSeconds - startSeconds;

      const outputName = `${job.id}-clip-${i + 1}.mp4`;
      const outputPath = path.join(rendersDir, outputName);

      await execFileAsync('ffmpeg', [
        '-y',
        '-ss', String(startSeconds),
        '-i', inputPath,
        '-t', String(duration),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        outputPath,
      ]);

      clip.outputPath = `/renders/${outputName}`;
    }

    const updatedJob = await db.videoJob.update({
      where: { id: jobId },
      data: {
        clips,
        status: 'clips_rendered',
      },
    });

    return Response.json({ ok: true, job: updatedJob });
  } catch (error) {
    console.error('Render clips error:', error);

    return Response.json({ ok: false, error: 'Failed to render clips' }, { status: 500 });
  }
}