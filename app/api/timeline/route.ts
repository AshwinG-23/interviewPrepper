import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface TimelineEntry {
  questionId: string;
  type: string;
  text: string;
  startTime: number;
  endTime: number;
}

export async function POST(req: NextRequest) {
  const { sessionId, entries }: { sessionId: string; entries: TimelineEntry[] } = await req.json();

  if (!sessionId || !entries?.length) {
    return NextResponse.json({ error: "Missing sessionId or entries" }, { status: 400 });
  }

  await prisma.timelineEntry.deleteMany({ where: { sessionId } });

  const created = await prisma.timelineEntry.createMany({
    data: entries.map((e) => ({
      sessionId,
      questionId: e.questionId,
      type: e.type,
      text: e.text,
      startTime: e.startTime,
      endTime: e.endTime,
    })),
  });

  return NextResponse.json({ saved: created.count });
}
