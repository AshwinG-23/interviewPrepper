import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const sessionId = formData.get("sessionId") as string;
  const file = formData.get("recording") as File;

  if (!sessionId || !file) {
    return NextResponse.json({ error: "Missing sessionId or recording" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "storage", "sessions", sessionId);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(dir, "recording.webm");
  await writeFile(filePath, buffer);

  return NextResponse.json({ path: filePath });
}
