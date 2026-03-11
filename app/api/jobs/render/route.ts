import { db } from '@/lib/db';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);
let subtitleFilterSupportPromise: Promise<boolean> | null = null;

type ClipRecord = {
  title: string;
  start: string;
  end: string;
  reason: string;
  outputPath?: string;
};

type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

type CaptionStyleSettings = {
  fontSize: number;
  marginV: number;
  outline: number;
  textColor: string;
  outlineColor: string;
  bold: boolean;
  textTransform: 'original' | 'uppercase' | 'sentence' | 'title' | 'lowercase';
};

const DEFAULT_CAPTION_STYLE: CaptionStyleSettings = {
  fontSize: 72,
  marginV: 220,
  outline: 3,
  textColor: '#FFFFFF',
  outlineColor: '#000000',
  bold: true,
  textTransform: 'original',
};

function timeToSeconds(t: string) {
  const [hh, mm, ss] = t.split(':').map(Number);
  return hh * 3600 + mm * 60 + ss;
}

function parseTranscriptSegments(transcript: string | null | undefined): TranscriptSegment[] {
  if (!transcript) return [];

  return transcript
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\s-\s(\d{2}:\d{2}:\d{2})\]\s(.+)$/);
      if (!match) return null;

      return {
        start: timeToSeconds(match[1]),
        end: timeToSeconds(match[2]),
        text: match[3].trim(),
      };
    })
    .filter((segment): segment is TranscriptSegment => Boolean(segment));
}

function escapeAssText(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{|\}/g, '')
    .replace(/\r?\n/g, '\\N')
    .trim();
}

function wrapSubtitleText(text: string, fontSize: number) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const words = normalized.split(' ');
  const maxCharsPerLine = clamp(Math.floor(2200 / fontSize), 12, 30);
  const maxLines = fontSize >= 100 ? 3 : 2;
  const lines: string[] = [];
  let currentLine = '';

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

  const usedWords = lines.join(' ').split(' ').filter(Boolean).length;
  const remainingWords = words.slice(usedWords);

  if (currentLine) {
    const finalLineWords = currentLine.split(' ').concat(remainingWords);
    lines.push(finalLineWords.join(' '));
  } else if (remainingWords.length > 0) {
    lines.push(remainingWords.join(' '));
  }

  return lines.slice(0, maxLines).join('\n');
}

function formatAssTime(totalSeconds: number) {
  const normalized = Math.max(0, totalSeconds);
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const seconds = Math.floor(normalized % 60);
  const centiseconds = Math.round((normalized - Math.floor(normalized)) * 100);

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0'
  )}.${String(Math.min(99, centiseconds)).padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeColor(input: unknown, fallback: string) {
  if (typeof input !== 'string') return fallback;
  const value = input.trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

function assColorFromHex(hex: string) {
  const normalized = hex.replace('#', '');
  const red = normalized.slice(0, 2);
  const green = normalized.slice(2, 4);
  const blue = normalized.slice(4, 6);
  return `&H00${blue}${green}${red}`.toUpperCase();
}

function applyTextTransform(
  text: string,
  transform: CaptionStyleSettings['textTransform']
) {
  const normalized = text.trim();
  if (!normalized) return normalized;

  switch (transform) {
    case 'uppercase':
      return normalized.toUpperCase();
    case 'lowercase':
      return normalized.toLowerCase();
    case 'sentence': {
      const lower = normalized.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    case 'title':
      return normalized.replace(/\w\S*/g, (word) => {
        const lower = word.toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      });
    default:
      return normalized;
  }
}

function parseCaptionStyleSettings(value: unknown): CaptionStyleSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_CAPTION_STYLE;
  }

  const candidate = value as Record<string, unknown>;

  return {
    fontSize: clamp(
      typeof candidate.fontSize === 'number' ? candidate.fontSize : DEFAULT_CAPTION_STYLE.fontSize,
      28,
      140
    ),
    marginV: clamp(
      typeof candidate.marginV === 'number' ? candidate.marginV : DEFAULT_CAPTION_STYLE.marginV,
      80,
      420
    ),
    outline: clamp(
      typeof candidate.outline === 'number' ? candidate.outline : DEFAULT_CAPTION_STYLE.outline,
      0,
      8
    ),
    textColor: normalizeColor(candidate.textColor, DEFAULT_CAPTION_STYLE.textColor),
    outlineColor: normalizeColor(candidate.outlineColor, DEFAULT_CAPTION_STYLE.outlineColor),
    bold:
      typeof candidate.bold === 'boolean' ? candidate.bold : DEFAULT_CAPTION_STYLE.bold,
    textTransform:
      candidate.textTransform === 'uppercase' ||
      candidate.textTransform === 'sentence' ||
      candidate.textTransform === 'title' ||
      candidate.textTransform === 'lowercase' ||
      candidate.textTransform === 'original'
        ? candidate.textTransform
        : DEFAULT_CAPTION_STYLE.textTransform,
  };
}

function buildSubtitleSegments(
  transcriptSegments: TranscriptSegment[],
  clipStartSeconds: number,
  clipEndSeconds: number,
  clipTitle: string
) {
  const overlappingSegments = transcriptSegments.filter(
    (segment) => segment.end > clipStartSeconds && segment.start < clipEndSeconds
  );

  const subtitleSegments =
    overlappingSegments.length > 0
      ? overlappingSegments.map((segment) => ({
          start: Math.max(0, segment.start - clipStartSeconds),
          end: Math.max(0.2, Math.min(clipEndSeconds, segment.end) - clipStartSeconds),
          text: segment.text,
        }))
      : [
          {
            start: 0,
            end: Math.min(3, Math.max(0.2, clipEndSeconds - clipStartSeconds)),
            text: clipTitle,
          },
        ];

  return subtitleSegments;
}

function buildAssContent(
  transcriptSegments: TranscriptSegment[],
  clipStartSeconds: number,
  clipEndSeconds: number,
  clipTitle: string,
  captionStyle: CaptionStyleSettings
) {
  const subtitleSegments = buildSubtitleSegments(
    transcriptSegments,
    clipStartSeconds,
    clipEndSeconds,
    clipTitle
  );

  const events = subtitleSegments
    .map((segment) => {
      const start = formatAssTime(segment.start);
      const end = formatAssTime(segment.end);
      const text = escapeAssText(
        wrapSubtitleText(
          applyTextTransform(segment.text, captionStyle.textTransform),
          captionStyle.fontSize
        )
      );
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join('\n');

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Arial,${captionStyle.fontSize},${assColorFromHex(
    captionStyle.textColor
  )},${assColorFromHex(captionStyle.textColor)},${assColorFromHex(
    captionStyle.outlineColor
  )},&H64000000,${captionStyle.bold ? '-1' : '0'},0,0,0,100,100,0,0,1,${
    captionStyle.outline
  },0,2,60,60,${captionStyle.marginV},0

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${events}
`;
}

function escapeSubtitleFilterPath(filePath: string) {
  return filePath
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

async function ffmpegSupportsSubtitleBurnIn() {
  if (!subtitleFilterSupportPromise) {
    subtitleFilterSupportPromise = execFileAsync('ffmpeg', ['-hide_banner', '-filters'])
      .then(({ stdout, stderr }) => {
        const filters = `${stdout}\n${stderr}`;
        return filters.includes(' subtitles ') || filters.includes(' ass ');
      })
      .catch(() => false);
  }

  return subtitleFilterSupportPromise;
}

export async function POST(req: Request) {
  try {
    const { jobId, captionStyle } = await req.json();

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

    const clips = job.clips as ClipRecord[];

    const rendersDir = path.join(process.cwd(), 'public', 'renders');
    await mkdir(rendersDir, { recursive: true });

    const normalizedSourcePath = job.sourcePath.replace(/^\//, '');
    const inputPath = path.join(process.cwd(), 'public', normalizedSourcePath);
    const transcriptSegments = parseTranscriptSegments(job.transcript);
    const resolvedCaptionStyle = parseCaptionStyleSettings(captionStyle);
    const supportsSubtitleBurnIn = await ffmpegSupportsSubtitleBurnIn();

    if (!supportsSubtitleBurnIn) {
      throw new Error(
        'Your FFmpeg build cannot burn subtitles into video. Install FFmpeg with libass/subtitles filter support, then retry.'
      );
    }

    const subtitlesTempDir = await mkdtemp(path.join(os.tmpdir(), 'viral-clip-subs-'));

    try {
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];

        const startSeconds = timeToSeconds(clip.start);
        const endSeconds = timeToSeconds(clip.end);
        const duration = endSeconds - startSeconds;

        if (!Number.isFinite(duration) || duration <= 0) {
          throw new Error(`Invalid clip duration for clip ${i + 1}`);
        }

        const outputName = `${job.id}-clip-${i + 1}-vertical.mp4`;
        const outputPath = path.join(rendersDir, outputName);
        const subtitlePath = path.join(subtitlesTempDir, `${job.id}-clip-${i + 1}.ass`);
        const assContent = buildAssContent(
          transcriptSegments,
          startSeconds,
          endSeconds,
          clip.title,
          resolvedCaptionStyle
        );
        const escapedSubtitlePath = escapeSubtitleFilterPath(subtitlePath);
        const escapedFontsDir = escapeSubtitleFilterPath('/System/Library/Fonts/Supplemental');
        const filterComplex =
          '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10[bg];' +
          '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];' +
          `[bg][fg]overlay=(W-w)/2:(H-h)/2[base];` +
          `[base]subtitles='${escapedSubtitlePath}':fontsdir='${escapedFontsDir}',format=yuv420p[v]`;

        await writeFile(subtitlePath, assContent, 'utf8');

        try {
          const { stderr } = await execFileAsync('ffmpeg', [
            '-y',
            '-ss',
            String(startSeconds),
            '-i',
            inputPath,
            '-t',
            String(duration),
            '-filter_complex',
            filterComplex,
            '-map',
            '[v]',
            '-map',
            '0:a?',
            '-c:v',
            'libx264',
            '-preset',
            'medium',
            '-crf',
            '23',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-movflags',
            '+faststart',
            outputPath,
          ]);

          if (stderr) {
            console.log(`FFMPEG clip ${i + 1} stderr:`, stderr);
          }
        } catch (ffmpegError) {
          const message =
            ffmpegError instanceof Error ? ffmpegError.message : 'Unknown ffmpeg error';
          const stderr =
            typeof ffmpegError === 'object' &&
            ffmpegError !== null &&
            'stderr' in ffmpegError &&
            typeof (ffmpegError as { stderr?: string }).stderr === 'string'
              ? (ffmpegError as { stderr?: string }).stderr
              : '';

          throw new Error(
            `FFmpeg failed on clip ${i + 1}: ${message}${stderr ? ` | ${stderr}` : ''}`
          );
        }

        clip.outputPath = `/renders/${outputName}`;
      }
    } finally {
      await rm(subtitlesTempDir, { recursive: true, force: true });
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

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to render clips',
      },
      { status: 500 }
    );
  }
}
