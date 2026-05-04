import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ai, AUDIO_MODEL } from "@/lib/vertex";
import { readFile } from "fs/promises";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const entries = await prisma.timelineEntry.findMany({
    where: { sessionId, segmentPath: { not: null } },
  });

  const results: { entryId: string; transcript: string }[] = [];

  for (const entry of entries) {
    if (!entry.segmentPath) continue;

    const audioBuffer = await readFile(entry.segmentPath);
    const base64Audio = audioBuffer.toString("base64");

    const result = await ai.models.generateContent({
      model: AUDIO_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "audio/webm", data: base64Audio } },
            { text: "Transcribe this audio recording accurately. Return only the spoken text, no timestamps or labels." },
          ],
        },
      ],
    });

    const transcript = result.text?.trim() ?? "";

    await prisma.timelineEntry.update({
      where: { id: entry.id },
      data: { transcript },
    });

    results.push({ entryId: entry.id, transcript });
  }

  return NextResponse.json({ transcribed: results.length, results });
}
