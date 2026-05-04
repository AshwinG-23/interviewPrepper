import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Interview Prepper</h1>
          <p className="text-gray-400 mt-2">AI-powered mock interviews with real-time feedback</p>
        </div>
        <Link
          href="/dashboard"
          className="bg-white text-black font-semibold px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm whitespace-nowrap"
        >
          + New Interview
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">No interviews yet.</p>
          <p className="text-sm mt-1">Start your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Past Interviews</h2>
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/analysis?session=${s.id}`}
              className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-4 hover:border-[#444] transition-colors group"
            >
              <div className="space-y-0.5">
                <p className="font-medium group-hover:text-white transition-colors">{s.name}</p>
                <p className="text-sm text-gray-400">
                  {s.role} · {s.field}
                  {s.company ? ` · ${s.company}` : ""}
                </p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-sm text-gray-400">{s.duration} min</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {new Date(s.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
