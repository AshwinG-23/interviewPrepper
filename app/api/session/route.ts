import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("id");
  if (!sessionId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      questions: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json(session);
}
