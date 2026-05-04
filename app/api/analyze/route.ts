import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ai, MAIN_MODEL } from "@/lib/vertex";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";

interface AnalysisResult {
  score: number;
  verdict: string;
  strengths: string[];
  missed_points: string[];
  improvements: string[];
  ideal_answer_summary: string;
  follow_up_flag: string | null;
}

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const entries = await prisma.timelineEntry.findMany({
    where: { sessionId, transcript: { not: null } },
    orderBy: { startTime: "asc" },
  });

  // Load resume if available
  const resumePath = path.join(process.cwd(), "storage", "sessions", sessionId, "resume.pdf");
  const hasResume = existsSync(resumePath);
  let resumeBase64: string | null = null;
  if (hasResume) {
    const buf = await readFile(resumePath);
    resumeBase64 = buf.toString("base64");
  }

  const results: { entryId: string; analysis: AnalysisResult }[] = [];

  for (const entry of entries) {
    if (!entry.transcript) continue;

    let expectedPoints: string[] = [];
    try {
      expectedPoints = JSON.parse(
        (await prisma.question.findFirst({ where: { id: entry.questionId } }))?.expectedPoints ?? "[]"
      );
    } catch {}

    const promptText = buildAnalysisPrompt({
      question: entry.text,
      transcript: entry.transcript,
      expectedPoints,
      role: session.role,
      company: session.company,
      hasResume,
    });

    const contents = resumeBase64
      ? [{
          parts: [
            { inlineData: { mimeType: "application/pdf", data: resumeBase64 } },
            { text: promptText },
          ],
        }]
      : promptText;

    const result = await ai.models.generateContent({
      model: MAIN_MODEL,
      contents,
      config: { responseMimeType: "application/json" },
    });

    const raw = result.text ?? "{}";

    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(raw);
    } catch {
      analysis = {
        score: 0,
        verdict: "Could not parse",
        strengths: [],
        missed_points: ["Analysis failed — try re-running"],
        improvements: [],
        ideal_answer_summary: "",
        follow_up_flag: null,
      };
    }

    await prisma.timelineEntry.update({
      where: { id: entry.id },
      data: { analysis: JSON.stringify(analysis) },
    });

    results.push({ entryId: entry.id, analysis });
  }

  return NextResponse.json({ analyzed: results.length, results });
}

function buildAnalysisPrompt({
  question,
  transcript,
  expectedPoints,
  role,
  company,
  hasResume,
}: {
  question: string;
  transcript: string;
  expectedPoints: string[];
  role: string;
  company?: string | null;
  hasResume: boolean;
}): string {
  return `You are a senior technical interviewer conducting a ${role} interview${company ? ` at ${company}` : ""}.
${hasResume ? "The candidate's resume is attached. Use it to check if their answer aligns with what they claimed in the resume." : ""}

INTERVIEW QUESTION
──────────────────
${question}

EXPECTED KEY POINTS
───────────────────
${expectedPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

CANDIDATE'S ANSWER (transcribed from speech)
─────────────────────────────────────────────
"${transcript}"

YOUR EVALUATION TASK
────────────────────
Score the answer from 1–10 using this rubric:
  9–10: Exceptional — covered all key points with depth, clarity, and examples
  7–8:  Strong — covered most key points well, minor gaps
  5–6:  Adequate — covered the basics but missed important depth or points
  3–4:  Weak — only surface-level, significant gaps
  1–2:  Poor — incorrect, irrelevant, or nearly no useful content

Be honest and specific. Do not inflate scores. Reference exact phrases from their answer.

Return ONLY valid JSON — no markdown, no explanation:
{
  "score": <integer 1–10>,
  "verdict": "<one sentence honest overall assessment>",
  "strengths": [
    "<specific thing they said well — quote or paraphrase their actual words>"
  ],
  "missed_points": [
    "<key concept or point they should have mentioned but didn't>"
  ],
  "improvements": [
    "<specific, actionable advice — what exactly to say or add next time>"
  ],
  "ideal_answer_summary": "<2-3 sentences: what a strong answer to this question looks like>",
  "follow_up_flag": "<if their answer raised a concerning claim or gap worth probing further, state it here — otherwise null>"
}`;
}
