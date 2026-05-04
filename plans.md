# INTERVIEW PREPPER — FULL SYSTEM SPEC (TIMESTAMP-BASED VERSION)

---

## 1. PROJECT OVERVIEW

You are building a **local-first interview preparation web app**.

### Core Idea

* AI generates **questions + expected answers**
* User answers verbally
* System records **one continuous audio session**
* Questions are mapped using **timestamps**
* Audio is **split later per question**
* Each segment is transcribed and analyzed

---

## 2. KEY DESIGN DECISION (IMPORTANT)

### OLD (WRONG)

* Record audio per question

### NEW (CORRECT)

* Record **one continuous audio file**
* Track **timestamps of each question/follow-up**
* Slice audio later

---

## 3. TECH STACK

Frontend:

* Next.js (App Router)
* Tailwind CSS

Backend:

* Next.js API routes

Database:

* SQLite + Prisma

Storage:

* Local filesystem

AI:

* Google Vertex AI (Gemini)

Audio:

* MediaRecorder API (browser)

Audio Processing:

* FFmpeg (for slicing)

---

## 4. CORE FEATURES

---

## 4.1 Dashboard (Input Screen)

### Required

* Resume upload (PDF)
* Role
* Field of study

### Optional

* Company
* Job description
* Course attachments
* Topic list

### Action

* Generate Interview

---

## 4.2 Question Generation

AI returns structured questions:

* main questions
* follow-ups
* expected answer points
* what is being tested

Stored in DB.

---

## 5. INTERVIEW SYSTEM (CRITICAL SECTION)

---

## 5.1 Start Interview

When user clicks:

### Backend creates:

* sessionId

### Frontend:

* starts **continuous recording**
* initializes:

```json
{
  "recordingStart": 0,
  "timeline": []
}
```

---

## 5.2 Timeline Tracking (CORE SYSTEM)

You DO NOT store audio per question.

You store **time ranges**.

---

### Timeline Entry Structure

```ts
type TimelineEntry = {
  id: string
  questionId: string
  type: "main" | "followup"
  text: string
  startTime: number
  endTime: number | null
}
```

---

## 5.3 Timeline Logic

### When first question appears:

```ts
startTime = currentRecordingTime
endTime = null
```

---

### When user presses NEXT:

1. Close current entry:

```ts
current.endTime = now
```

2. Start next entry:

```ts
new.startTime = now
```

---

## 5.4 Important Rule

👉 The UI controls time segmentation
👉 NOT the audio system

---

## 5.5 Example Timeline

```json
[
  {
    "id": "q1",
    "type": "main",
    "text": "Explain normalization",
    "startTime": 0,
    "endTime": 45
  },
  {
    "id": "q1_f1",
    "type": "followup",
    "text": "What is 3NF?",
    "startTime": 45,
    "endTime": 70
  }
]
```

---

## 6. AUDIO SYSTEM

---

## 6.1 Recording

* Use MediaRecorder
* Record ONE file

Save as:

```
/storage/audio/{sessionId}/full.webm
```

---

## 6.2 Stop Recording

When interview ends:

* stop recorder
* save file

---

## 7. AUDIO SEGMENTATION (POST PROCESSING)

---

## 7.1 Goal

Split full audio into per-question clips using timestamps.

---

## 7.2 Tool

Use FFmpeg

---

## 7.3 Command Pattern

```bash
ffmpeg -i full.webm -ss START -to END -c copy output.webm
```

---

## 7.4 Example

```bash
ffmpeg -i full.webm -ss 45 -to 70 -c copy q1_f1.webm
```

---

## 7.5 Output

```
/segments/q1.webm
/segments/q1_f1.webm
```

---

## 8. DATABASE DESIGN

---

### Session

```prisma
model Session {
  id        String   @id @default(uuid())
  role      String
  field     String
  company   String?
  createdAt DateTime @default(now())
}
```

---

### Question

```prisma
model Question {
  id             String @id
  sessionId      String
  text           String
  expectedPoints String
}
```

---

### Timeline Entry

```prisma
model TimelineEntry {
  id          String @id @default(uuid())
  sessionId   String
  questionId  String
  type        String
  text        String
  startTime   Float
  endTime     Float
  segmentPath String?
  transcript  String?
  analysis    String?
}
```

---

## 9. TRANSCRIPTION FLOW

---

## 9.1 For each timeline entry:

1. Load segment audio
2. Send to transcription service
3. Store result

---

## 9.2 Output Example

```json
{
  "transcript": "Normalization is the process of..."
}
```

---

## 10. ANALYSIS SYSTEM

---

## 10.1 Input to AI

* Question text
* Expected points
* Transcript

---

## 10.2 Output

```json
{
  "score": 6,
  "strengths": ["Good basic explanation"],
  "missed_points": ["No mention of 3NF"],
  "improvements": ["Add examples"],
  "ideal_answer_summary": "A complete answer should..."
}
```

---

## 11. UI FLOW

---

### Dashboard → Generate Questions

### → Interview Screen

### → Analysis Screen

---

## 12. INTERVIEW SCREEN DETAILS

---

### Shows:

* Question text
* Follow-up when needed

---

### Controls:

* Start Recording
* Next (keyboard: N)
* End Interview

---

## 13. ANALYSIS SCREEN

---

For each entry:

* Question
* Transcript
* Score
* Strengths
* Missed Points
* Improvements

---

## 14. API ENDPOINTS

---

### Generate Questions

`POST /api/generate`

---

### Start Session

`POST /api/session/start`

---

### Save Timeline

`POST /api/timeline`

---

### Upload Audio

`POST /api/audio`

---

### Slice Audio

`POST /api/slice`

---

### Transcribe

`POST /api/transcribe`

---

### Analyze

`POST /api/analyze`

---

## 15. DEVELOPMENT ORDER (STRICT)

1. Setup project
2. Dashboard UI
3. Question generation
4. Interview UI
5. Timeline tracking
6. Audio recording
7. Save full audio
8. FFmpeg slicing
9. Transcription stub
10. Analysis
11. Final UI

---

## 16. CRITICAL ENGINEERING RULES

---

### Rule 1

Never split audio during recording

---

### Rule 2

Timeline is source of truth

---

### Rule 3

Always validate timestamps

---

### Rule 4

AI must return strict JSON

---

## 17. MVP COMPLETION CHECK

---

System works if:

* Questions are generated
* Interview runs
* Timeline is stored
* Audio is recorded
* Audio is sliced correctly
* Transcripts exist
* Analysis is shown

