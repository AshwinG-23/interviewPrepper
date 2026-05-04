import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ai, AUDIO_MODEL } from "@/lib/vertex";
import { readFile } from "fs/promises";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  const entries = await prisma.timelineEntry.findMany({
    where: { sessionId, segmentPath: { not: null } },
    orderBy: { startTime: "asc" },
  });

  const context = session
    ? `This is a ${session.role} technical interview${session.company ? ` for ${session.company}` : ""}.`
    : "This is a technical interview.";

  const results: { entryId: string; transcript: string }[] = [];

  for (const entry of entries) {
    if (!entry.segmentPath) continue;

    const audioBuffer = await readFile(entry.segmentPath);
    const base64Audio = audioBuffer.toString("base64");

    const result = await ai.models.generateContent({
      model: AUDIO_MODEL,
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "audio/webm", data: base64Audio } },
          {
            text: `${context} The question being answered is: "${entry.text}"

Transcribe the candidate's spoken answer accurately and completely.
- Preserve the natural flow of speech including hesitations if they affect meaning
- Fix obvious verbal filler ("um", "uh") only if they add noise — keep meaningful pauses
- Do not summarise or interpret — transcribe exactly what was said
- If the audio is silent or inaudible, return: "[No response recorded]"
- Return only the transcription, nothing else`,
          },
        ],
      }],
    });

    const transcript = result.text?.trim() ?? "[No response recorded]";

    await prisma.timelineEntry.update({
      where: { id: entry.id },
      data: { transcript },
    });

    results.push({ entryId: entry.id, transcript });
  }

  return NextResponse.json({ transcribed: results.length, results });
}
