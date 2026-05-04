import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ai, MAIN_MODEL } from "@/lib/vertex";

interface AnalysisResult {
  score: number;
  strengths: string[];
  missed_points: string[];
  improvements: string[];
  ideal_answer_summary: string;
}

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const entries = await prisma.timelineEntry.findMany({
    where: { sessionId, transcript: { not: null } },
  });

  const results: { entryId: string; analysis: AnalysisResult }[] = [];

  for (const entry of entries) {
    if (!entry.transcript) continue;

    const result = await ai.models.generateContent({
      model: MAIN_MODEL,
      contents: buildAnalysisPrompt(entry.text, entry.transcript),
      config: { responseMimeType: "application/json" },
    });

    const raw = result.text ?? "{}";

    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(raw);
    } catch {
      analysis = {
        score: 0,
        strengths: [],
        missed_points: ["Could not parse analysis"],
        improvements: ["Try again"],
        ideal_answer_summary: "",
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

function buildAnalysisPrompt(question: string, transcript: string): string {
  return `You are an expert technical interviewer evaluating a candidate's answer.

Question: ${question}
Candidate's Answer: ${transcript}

Return ONLY valid JSON matching this exact schema:
{
  "score": <integer 1-10>,
  "strengths": ["what the candidate did well"],
  "missed_points": ["key concepts not covered"],
  "improvements": ["specific actionable suggestions"],
  "ideal_answer_summary": "A concise summary of what a complete answer should include"
}

Be honest and constructive. No markdown, no explanation — only the JSON object.`;
}
