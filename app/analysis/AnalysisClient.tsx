"use client";

interface AnalysisResult {
  score: number;
  verdict: string;
  strengths: string[];
  missed_points: string[];
  improvements: string[];
  ideal_answer_summary: string;
  follow_up_flag: string | null;
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
  const scores = entries
    .map((e) => { try { return JSON.parse(e.analysis ?? "").score; } catch { return null; } })
    .filter((s): s is number => s !== null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null;

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
        <a href="/" className="px-4 py-2 border border-[#333] rounded-lg text-gray-300 hover:border-white hover:text-white transition-colors text-sm">
          ← Home
        </a>
      </div>

      {/* Overall score banner */}
      {avgScore !== null && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Overall Score</p>
            <p className="text-gray-300 text-sm">Average across {scores.length} answered question{scores.length !== 1 ? "s" : ""}</p>
          </div>
          <ScoreBadge score={avgScore} size="lg" />
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-gray-500">No entries found for this session.</p>
      ) : (
        <div className="space-y-6">
          {entries.map((entry, i) => {
            let analysis: AnalysisResult | null = null;
            if (entry.analysis) { try { analysis = JSON.parse(entry.analysis); } catch {} }

            const videoUrl = entry.hasSegment
              ? `/api/media?session=${session.id}&file=segments/${entry.id}.webm`
              : null;

            return (
              <div key={entry.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <span className="text-xs uppercase tracking-widest text-gray-500 mb-1 block">
                      {entry.type === "followup" ? "↳ Follow-up" : `Question ${i + 1}`}
                    </span>
                    <p className="font-medium text-lg leading-snug">{entry.text}</p>
                  </div>
                  {analysis && <ScoreBadge score={analysis.score} size="md" />}
                </div>

                {/* Verdict */}
                {analysis?.verdict && (
                  <p className="text-sm text-gray-400 italic border-l-2 border-[#333] pl-3">
                    {analysis.verdict}
                  </p>
                )}

                {/* Video */}
                {videoUrl && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Your Recording</p>
                    <video src={videoUrl} controls className="w-full rounded-lg bg-black aspect-video" preload="metadata" />
                  </div>
                )}

                {/* Transcript */}
                {entry.transcript && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Your Answer</p>
                    <p className="text-gray-300 text-sm leading-relaxed bg-[#111] rounded-lg p-3">
                      {entry.transcript}
                    </p>
                  </div>
                )}

                {/* Analysis sections */}
                {analysis && (
                  <div className="space-y-3 pt-3 border-t border-[#2a2a2a]">
                    {analysis.strengths.length > 0 && (
                      <Section label="Strengths" items={analysis.strengths} color="green" />
                    )}
                    {analysis.missed_points.length > 0 && (
                      <Section label="Missed Points" items={analysis.missed_points} color="red" />
                    )}
                    {analysis.improvements.length > 0 && (
                      <Section label="How to Improve" items={analysis.improvements} color="yellow" />
                    )}
                    {analysis.ideal_answer_summary && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Ideal Answer</p>
                        <p className="text-gray-400 text-sm leading-relaxed">{analysis.ideal_answer_summary}</p>
                      </div>
                    )}
                    {analysis.follow_up_flag && (
                      <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3">
                        <p className="text-xs uppercase tracking-widest text-yellow-600 mb-1">Worth Probing Further</p>
                        <p className="text-yellow-300 text-sm">{analysis.follow_up_flag}</p>
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

function ScoreBadge({ score, size }: { score: number; size: "md" | "lg" }) {
  const color =
    score >= 8 ? "text-green-400 border-green-800" :
    score >= 5 ? "text-yellow-400 border-yellow-800" :
    "text-red-400 border-red-800";
  const dim = size === "lg" ? "w-20 h-20 text-2xl" : "w-14 h-14 text-lg";
  return (
    <div className={`flex-shrink-0 rounded-full border-2 flex items-center justify-center font-bold ${color} ${dim}`}>
      {score}/10
    </div>
  );
}

function Section({ label, items, color }: { label: string; items: string[]; color: string }) {
  const dot = color === "green" ? "bg-green-500" : color === "red" ? "bg-red-500" : "bg-yellow-500";
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <ul className="space-y-1.5">
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
