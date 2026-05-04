import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mkdir } from "fs/promises";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const entries = await prisma.timelineEntry.findMany({ where: { sessionId } });
  const fullRecording = path.join(process.cwd(), "storage", "sessions", sessionId, "recording.webm");
  const segDir = path.join(process.cwd(), "storage", "sessions", sessionId, "segments");
  await mkdir(segDir, { recursive: true });

  const results: { entryId: string; segmentPath: string }[] = [];

  for (const entry of entries) {
    if (entry.endTime === null) continue;

    const outPath = path.join(segDir, `${entry.id}.webm`);
    await sliceVideo(fullRecording, outPath, entry.startTime, entry.endTime);

    await prisma.timelineEntry.update({
      where: { id: entry.id },
      data: { segmentPath: outPath },
    });

    results.push({ entryId: entry.id, segmentPath: outPath });
  }

  return NextResponse.json({ sliced: results.length, results });
}

function sliceVideo(input: string, output: string, start: number, end: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(start)
      .setDuration(end - start)
      .outputOptions("-c copy")
      .output(output)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}
