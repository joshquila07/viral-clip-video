import { formatTranscriptSegments } from "@/lib/transcript";

export async function GET() {
  const fakeSegments = [
    { start: 10, end: 12, text: "Bakit ginawanin nico yun?" },
    { start: 12, end: 14, text: "Ipinagmalaki niya yung kanyang pamilya." },
    { start: 14, end: 18, text: "Tapos doon na nagsimula ang mainit nilang usapan." },
  ];

  const formattedTranscript = formatTranscriptSegments(fakeSegments);

  return Response.json({
    ok: true,
    transcript: formattedTranscript,
  });
}