import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ai, MAIN_MODEL } from "@/lib/vertex";

interface GenerateBody {
  name?: string;
  role: string;
  field: string;
  company?: string;
  jobDescription?: string;
  topics?: string;
  duration?: number;
}

interface QuestionItem {
  text: string;
  expectedPoints: string[];
  tests: string;
  followups: Array<{ text: string; expectedPoints: string[] }>;
}

export async function POST(req: NextRequest) {
  const body: GenerateBody = await req.json();
  const { role, field, company, jobDescription, topics, duration = 50 } = body;

  const sessionName =
    body.name?.trim() ||
    new Date().toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const prompt = buildPrompt({ role, field, company, jobDescription, topics, duration });

  const result = await ai.models.generateContent({
    model: MAIN_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const raw = result.text ?? "{}";

  let parsed: { questions: QuestionItem[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 500 });
  }

  const session = await prisma.session.create({
    data: {
      name: sessionName,
      role,
      field,
      company: company || null,
      jobDesc: jobDescription || null,
      duration,
    },
  });

  let orderIndex = 0;
  for (const q of parsed.questions) {
    const mainQ = await prisma.question.create({
      data: {
        sessionId: session.id,
        text: q.text,
        expectedPoints: JSON.stringify(q.expectedPoints),
        type: "main",
        orderIndex: orderIndex++,
      },
    });
    for (const fu of q.followups ?? []) {
      await prisma.question.create({
        data: {
          sessionId: session.id,
          text: fu.text,
          expectedPoints: JSON.stringify(fu.expectedPoints),
          type: "followup",
          parentId: mainQ.id,
          orderIndex: orderIndex++,
        },
      });
    }
  }

  return NextResponse.json({ sessionId: session.id });
}

function buildPrompt({
  role, field, company, jobDescription, topics, duration,
}: GenerateBody): string {
  // Estimate question count from duration: ~7-8 mins per main question (including follow-ups and thinking time)
  const mainQuestionCount = Math.max(3, Math.min(10, Math.round(duration! / 8)));
  const followupsPerQuestion = duration! >= 60 ? 2 : 1;

  return `You are an expert technical interviewer conducting a ${duration}-minute interview.

Role: ${role}
Field of Study: ${field}
${company ? `Company: ${company}` : ""}
${jobDescription ? `Job Description:\n${jobDescription}` : ""}
${topics ? `Focus Topics: ${topics}` : ""}

TIME CONSTRAINT — CRITICAL:
This interview is exactly ${duration} minutes long. You must generate exactly ${mainQuestionCount} main questions with ${followupsPerQuestion} follow-up(s) each.
Each main question + follow-ups should take roughly ${Math.round(duration! / mainQuestionCount)} minutes including the candidate's answer time.
Do NOT generate more questions than this — the interviewer will not have time to ask them.

Return ONLY valid JSON matching this exact schema:
{
  "questions": [
    {
      "text": "Main question text",
      "expectedPoints": ["key point 1", "key point 2"],
      "tests": "What skill this evaluates",
      "followups": [
        {
          "text": "Follow-up question",
          "expectedPoints": ["expected point"]
        }
      ]
    }
  ]
}

Cover a good mix: technical depth, problem-solving, and role-specific skills. No markdown, no explanation — only the JSON object.`;
}
