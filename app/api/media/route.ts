import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { existsSync } from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  const file = req.nextUrl.searchParams.get("file");

  if (!sessionId || !file) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Prevent path traversal
  const baseDir = path.join(process.cwd(), "storage", "sessions", sessionId);
  const filePath = path.join(baseDir, file);
  if (!filePath.startsWith(baseDir)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace("bytes=", "").split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createReadStream(filePath, { start, end });
    const body = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(body, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/webm",
      },
    });
  }

  const stream = createReadStream(filePath);
  const body = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": "video/webm",
      "Accept-Ranges": "bytes",
    },
  });
}
