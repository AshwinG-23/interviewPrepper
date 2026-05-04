import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { existsSync } from "fs";
import path from "path";
import AnalysisClient from "./AnalysisClient";

async function AnalysisContent({ sessionId }: { sessionId: string }) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return <p className="p-8 text-gray-500">Session not found.</p>;

  const rawEntries = await prisma.timelineEntry.findMany({
    where: { sessionId },
    orderBy: { startTime: "asc" },
  });

  const entries = rawEntries.map((e) => {
    const segPath = path.join(
      process.cwd(), "storage", "sessions", sessionId, "segments", `${e.id}.webm`
    );
    return {
      id: e.id,
      type: e.type,
      text: e.text,
      transcript: e.transcript,
      analysis: e.analysis,
      startTime: e.startTime,
      endTime: e.endTime,
      hasSegment: existsSync(segPath),
    };
  });

  return (
    <AnalysisClient
      session={{ ...session, createdAt: session.createdAt.toISOString() }}
      entries={entries}
    />
  );
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ session: string }>;
}) {
  const { session } = await searchParams;
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">Loading analysis...</div>}>
      <AnalysisContent sessionId={session} />
    </Suspense>
  );
}
