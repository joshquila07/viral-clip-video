import { db } from '@/lib/db';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const youtubeUrl = formData.get('youtubeUrl');
    const file = formData.get('file');

    const hasYoutubeUrl = typeof youtubeUrl === 'string' && youtubeUrl.trim().length > 0;
    const uploadedFile = file instanceof File ? file : null;

    if (!hasYoutubeUrl && !uploadedFile) {
      return Response.json(
        { ok: false, error: 'Please provide a YouTube URL or upload a file.' },
        { status: 400 }
      );
    }

    const sourceType = hasYoutubeUrl ? 'youtube' : 'upload';
    const sourceName = uploadedFile ? uploadedFile.name : 'YouTube Import';

    let sourcePath: string | null = null;

    if (uploadedFile) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadsDir, { recursive: true });

      const safeName = sanitizeFileName(uploadedFile.name);
      const uniqueName = `${Date.now()}-${safeName}`;
      const absoluteFilePath = path.join(uploadsDir, uniqueName);

      const bytes = await uploadedFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      await writeFile(absoluteFilePath, buffer);

      sourcePath = `/uploads/${uniqueName}`;
    }

    const job = await db.videoJob.create({
      data: {
        sourceType,
        sourceName,
        youtubeUrl: hasYoutubeUrl ? youtubeUrl.trim() : null,
        sourcePath,
        status: 'queued',
      },
    });

    return Response.json({ ok: true, job });
  } catch (error) {
    console.error('Create job error:', error);

    return Response.json(
      { ok: false, error: 'Failed to create job.' },
      { status: 500 }
    );
  }
}