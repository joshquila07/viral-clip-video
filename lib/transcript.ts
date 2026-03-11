function formatTime(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [hrs, mins, secs]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

export function formatTranscriptSegments(
  segments: { start: number; end: number; text: string }[]
) {
  return segments
    .map((seg) => {
      return `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${seg.text.trim()}`;
    })
    .join("\n");
}