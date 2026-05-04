"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Question {
  id: string;
  text: string;
  type: string;
  orderIndex: number;
}

interface TimelineEntry {
  questionId: string;
  type: string;
  text: string;
  startTime: number;
  endTime: number;
}

function InterviewScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session")!;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"idle" | "recording" | "processing">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [processingStep, setProcessingStep] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timelineRef = useRef<TimelineEntry[]>([]);
  const recordingStartRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch(`/api/session?id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions ?? []));
  }, [sessionId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "n" || e.key === "N") && phase === "recording") handleNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function getRecordingTime(): number {
    return (Date.now() - recordingStartRef.current) / 1000;
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    streamRef.current = stream;

    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream;
    }

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    recordingStartRef.current = Date.now();

    timerRef.current = setInterval(() => setElapsed(getRecordingTime()), 500);

    const q = questions[0];
    timelineRef.current = [{
      questionId: q.id,
      type: q.type,
      text: q.text,
      startTime: 0,
      endTime: 0,
    }];
    setPhase("recording");
  }

  const handleNext = useCallback(() => {
    if (phase !== "recording") return;
    const now = getRecordingTime();
    const timeline = timelineRef.current;
    if (timeline.length > 0) timeline[timeline.length - 1].endTime = now;

    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      endInterview();
      return;
    }

    const nextQ = questions[nextIndex];
    timeline.push({ questionId: nextQ.id, type: nextQ.type, text: nextQ.text, startTime: now, endTime: 0 });
    setCurrentIndex(nextIndex);
  }, [phase, currentIndex, questions]);

  async function endInterview() {
    if (phase !== "recording") return;
    setPhase("processing");
    if (timerRef.current) clearInterval(timerRef.current);

    const now = getRecordingTime();
    const timeline = timelineRef.current;
    if (timeline.length > 0) timeline[timeline.length - 1].endTime = now;

    const recorder = mediaRecorderRef.current!;
    recorder.stop();

    setProcessingStep("Saving recording...");
    await new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const fd = new FormData();
        fd.append("sessionId", sessionId);
        fd.append("recording", blob, "recording.webm");
        await fetch("/api/audio", { method: "POST", body: fd });
        resolve();
      };
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());

    setProcessingStep("Saving timeline...");
    await fetch("/api/timeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, entries: timeline }),
    });

    setProcessingStep("Slicing video segments...");
    await fetch("/api/slice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    setProcessingStep("Transcribing answers...");
    await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    setProcessingStep("Analyzing responses...");
    await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    router.push(`/analysis?session=${sessionId}`);
  }

  const currentQ = questions[currentIndex];
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      {phase === "idle" && questions.length > 0 && (
        <div className="max-w-xl w-full text-center space-y-6">
          <h1 className="text-2xl font-bold">Ready to start?</h1>
          <p className="text-gray-400">
            {questions.length} questions loaded. Your camera and microphone will be used.
            Press <kbd className="bg-[#222] px-2 py-1 rounded text-sm">N</kbd> to advance.
          </p>
          <button
            onClick={startRecording}
            className="bg-white text-black font-semibold px-8 py-3 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Start Recording
          </button>
        </div>
      )}

      {phase === "recording" && currentQ && (
        <div className="max-w-2xl w-full space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-400">Recording {formatTime(elapsed)}</span>
            </div>
            <span className="text-sm text-gray-400">{currentIndex + 1} / {questions.length}</span>
          </div>

          {/* Live video preview */}
          <div className="relative">
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-xl bg-[#111] aspect-video object-cover"
            />
            <div className="absolute bottom-3 left-3 bg-black/60 rounded-md px-2 py-1 text-xs text-red-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              LIVE
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6 space-y-2">
            <span className="text-xs uppercase tracking-widest text-gray-500">
              {currentQ.type === "followup" ? "Follow-up" : "Question"}
            </span>
            <p className="text-xl font-medium leading-relaxed">{currentQ.text}</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleNext}
              className="flex-1 bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Next <span className="text-gray-500 text-sm ml-1">(N)</span>
            </button>
            <button
              onClick={endInterview}
              className="px-6 py-3 border border-[#444] text-gray-300 rounded-lg hover:border-red-500 hover:text-red-400 transition-colors"
            >
              End Interview
            </button>
          </div>
        </div>
      )}

      {phase === "processing" && (
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white font-medium">{processingStep}</p>
          <p className="text-sm text-gray-500">Please keep this tab open</p>
        </div>
      )}
    </main>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">Loading...</div>}>
      <InterviewScreen />
    </Suspense>
  );
}
