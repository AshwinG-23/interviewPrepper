"use client";

interface AnalysisResult {
  score: number;
  strengths: string[];
  missed_points: string[];
  improvements: string[];
  ideal_answer_summary: string;
}

interface Entry {
  id: string;
  type: string;
  text: string;
  transcript: string | null;
  analysis: string | null;
  startTime: number;
  endTime: number | null;
  hasSegment: boolean;
}

interface Session {
  id: string;
  name: string | null;
  role: string;
  field: string;
  company: string | null;
  duration: number;
  createdAt: string;
}

export default function AnalysisClient({ session, entries }: { session: Session; entries: Entry[] }) {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{session.name ?? "Interview Analysis"}</h1>
          <p className="text-gray-400 mt-1">
            {session.role} · {session.field}
            {session.company ? ` · ${session.company}` : ""} · {session.duration} min
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {new Date(session.createdAt).toLocaleString("en-US", {
              month: "long", day: "numeric", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <a
          href="/"
          className="px-4 py-2 border border-[#333] rounded-lg text-gray-300 hover:border-white hover:text-white transition-colors text-sm"
        >
          ← Home
        </a>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500">No entries found for this session.</p>
      ) : (
        <div className="space-y-6">
          {entries.map((entry, i) => {
            let analysis: AnalysisResult | null = null;
            if (entry.analysis) {
              try { analysis = JSON.parse(entry.analysis); } catch {}
            }

            const videoUrl = entry.hasSegment
              ? `/api/media?session=${session.id}&file=segments/${entry.id}.webm`
              : null;

            return (
              <div key={entry.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-gray-500 mb-1 block">
                      {entry.type === "followup" ? "Follow-up" : `Q${i + 1}`}
                    </span>
                    <p className="font-medium text-lg">{entry.text}</p>
                  </div>
                  {analysis && <ScoreBadge score={analysis.score} />}
                </div>

                {videoUrl && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Your Recording</p>
                    <video
                      src={videoUrl}
                      controls
                      className="w-full rounded-lg bg-black aspect-video"
                      preload="metadata"
                    />
                  </div>
                )}

                {entry.transcript && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Transcript</p>
                    <p className="text-gray-300 text-sm leading-relaxed bg-[#111] rounded-lg p-3">
                      {entry.transcript}
                    </p>
                  </div>
                )}

                {analysis && (
                  <div className="space-y-3 pt-2 border-t border-[#2a2a2a]">
                    {analysis.strengths.length > 0 && (
                      <Section label="Strengths" items={analysis.strengths} color="green" />
                    )}
                    {analysis.missed_points.length > 0 && (
                      <Section label="Missed Points" items={analysis.missed_points} color="red" />
                    )}
                    {analysis.improvements.length > 0 && (
                      <Section label="Improvements" items={analysis.improvements} color="yellow" />
                    )}
                    {analysis.ideal_answer_summary && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Ideal Answer</p>
                        <p className="text-gray-400 text-sm leading-relaxed">{analysis.ideal_answer_summary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "text-green-400 border-green-800" :
    score >= 5 ? "text-yellow-400 border-yellow-800" :
    "text-red-400 border-red-800";
  return (
    <div className={`flex-shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center font-bold text-lg ${color}`}>
      {score}/10
    </div>
  );
}

function Section({ label, items, color }: { label: string; items: string[]; color: string }) {
  const dot = color === "green" ? "bg-green-500" : color === "red" ? "bg-red-500" : "bg-yellow-500";
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
