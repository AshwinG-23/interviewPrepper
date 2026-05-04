"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    role: "",
    field: "",
    company: "",
    jobDescription: "",
    topics: "",
    duration: "50",
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.role || !form.field) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("role", form.role);
      fd.append("field", form.field);
      fd.append("company", form.company);
      fd.append("jobDescription", form.jobDescription);
      fd.append("topics", form.topics);
      fd.append("duration", form.duration);
      if (resumeFile) fd.append("resume", resumeFile);

      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/interview?session=${data.sessionId}`);
    } catch (err) {
      alert("Failed to generate questions: " + (err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">New Interview</h1>
          <p className="text-gray-400 mt-1">Fill in your details to generate questions.</p>
        </div>
        <a href="/" className="text-sm text-gray-500 hover:text-white transition-colors">← Home</a>
      </div>

      <form onSubmit={handleGenerate} className="space-y-5">

        {/* Resume Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Resume <span className="text-gray-500 font-normal">(PDF — strongly recommended)</span>
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors ${
              resumeFile
                ? "border-white/40 bg-white/5"
                : "border-[#333] hover:border-[#555]"
            }`}
          >
            {resumeFile ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-white font-medium">{resumeFile.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="text-gray-500">
                <p>Click to upload your resume</p>
                <p className="text-xs mt-1">PDF only · Max 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <Field label="Interview Name (optional)" placeholder="e.g. Google SWE Round 1" value={form.name} onChange={(v) => set("name", v)} />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Target Role *" value={form.role} onChange={(v) => set("role", v)} required />
          <Field label="Field of Study *" value={form.field} onChange={(v) => set("field", v)} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Company (optional)" value={form.company} onChange={(v) => set("company", v)} />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Interview Duration (minutes)</label>
            <input
              type="number"
              min={10}
              max={180}
              required
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white transition-colors"
              value={form.duration}
              onChange={(e) => set("duration", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Job Description <span className="text-gray-500 font-normal">(optional — paste the full JD)</span>
          </label>
          <textarea
            rows={5}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors resize-none"
            value={form.jobDescription}
            onChange={(e) => set("jobDescription", e.target.value)}
          />
        </div>

        <Field
          label="Specific topics to focus on (optional)"
          placeholder="e.g. System design, SQL optimization, React hooks"
          value={form.topics}
          onChange={(v) => set("topics", v)}
        />

        <button
          type="submit"
          disabled={loading || !form.role || !form.field}
          className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Generating interview..." : "Generate Interview"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label, placeholder, value, onChange, required,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
