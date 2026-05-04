import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ai, MAIN_MODEL } from "@/lib/vertex";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

interface QuestionItem {
  text: string;
  expectedPoints: string[];
  tests: string;
  followups: Array<{ text: string; expectedPoints: string[] }>;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const name          = (formData.get("name") as string)?.trim() || null;
  const role          = formData.get("role") as string;
  const field         = formData.get("field") as string;
  const company       = (formData.get("company") as string) || null;
  const jobDescription = (formData.get("jobDescription") as string) || null;
  const topics        = (formData.get("topics") as string) || null;
  const duration      = parseInt((formData.get("duration") as string) || "50");
  const resumeFile    = formData.get("resume") as File | null;

  if (!role || !field) {
    return NextResponse.json({ error: "Role and field are required" }, { status: 400 });
  }

  // Build Gemini content — multimodal if resume provided
  const promptText = buildPrompt({ role, field, company, jobDescription, topics, duration, hasResume: !!resumeFile });

  let resumeBase64: string | null = null;
  if (resumeFile) {
    const buffer = Buffer.from(await resumeFile.arrayBuffer());
    resumeBase64 = buffer.toString("base64");
  }

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

  let parsed: { questions: QuestionItem[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 500 });
  }

  const sessionName =
    name ||
    new Date().toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const session = await prisma.session.create({
    data: { name: sessionName, role, field, company, jobDesc: jobDescription, duration },
  });

  // Save resume PDF for future reference
  if (resumeBase64 && resumeFile) {
    const sessionDir = path.join(process.cwd(), "storage", "sessions", session.id);
    await mkdir(sessionDir, { recursive: true });
    const buffer = Buffer.from(resumeBase64, "base64");
    await writeFile(path.join(sessionDir, "resume.pdf"), buffer);
  }

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
  role, field, company, jobDescription, topics, duration, hasResume,
}: {
  role: string;
  field: string;
  company?: string | null;
  jobDescription?: string | null;
  topics?: string | null;
  duration: number;
  hasResume: boolean;
}): string {
  const mainCount = Math.max(3, Math.min(10, Math.round(duration / 8)));
  const followupCount = duration >= 60 ? 2 : 1;
  const minsPerQuestion = Math.round(duration / mainCount);

  return `You are a senior technical interviewer preparing for a ${duration}-minute interview.

CANDIDATE PROFILE
─────────────────
Target Role: ${role}
Field of Study: ${field}
${company ? `Company: ${company}` : ""}
${jobDescription ? `\nJOB DESCRIPTION\n───────────────\n${jobDescription}` : ""}
${topics ? `\nFOCUS AREAS REQUESTED\n─────────────────────\n${topics}` : ""}
${hasResume ? `\nThe candidate's resume is attached above as a PDF. Read it carefully.` : ""}

YOUR TASK
─────────
Generate exactly ${mainCount} main interview questions with exactly ${followupCount} follow-up(s) each.
This interview is ${duration} minutes — each main question + follow-up(s) should take ~${minsPerQuestion} minutes including the candidate's answer time. Do not generate more.

QUESTION DESIGN RULES
─────────────────────
${hasResume ? `1. At least 60% of main questions must directly reference something specific from the resume — a project, technology, role, achievement, or claim. Name them explicitly in the question (e.g. "In your project X, you mentioned using Y...").
2. The remaining questions should be role/JD-aligned technical or behavioural questions.
3. Follow-ups should probe deeper into the candidate's answer — either verify a resume claim or push for depth on the main question.` : `1. Questions must be specific and role-appropriate, not generic.
2. Follow-ups should probe for deeper understanding or real-world application.`}
4. Cover a good spread: technical depth, system design or architecture thinking, problem-solving process, and at least one behavioural question.
5. expectedPoints must be concrete — specific concepts, methods, or outcomes the candidate should mention. At least 4 points per question.
6. The "tests" field must name the specific skill being evaluated (e.g. "Database indexing knowledge", "System scalability thinking").

OUTPUT FORMAT
─────────────
Return ONLY valid JSON — no markdown, no explanation:
{
  "questions": [
    {
      "text": "Full question text",
      "expectedPoints": ["point 1", "point 2", "point 3", "point 4"],
      "tests": "Specific skill being evaluated",
      "followups": [
        {
          "text": "Follow-up question",
          "expectedPoints": ["point 1", "point 2", "point 3"]
        }
      ]
    }
  ]
}`;
}
