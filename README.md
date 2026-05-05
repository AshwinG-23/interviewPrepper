# Interview Prepper

AI-powered mock interview app. Records your video + audio, transcribes your answers, and gives per-question analysis with scores, strengths, and improvements.

---

## Quick Setup

### Linux
```bash
# 1. Install FFmpeg
sudo apt update && sudo apt install -y ffmpeg

# 2. Install Node dependencies
npm install

# 3. Set up the database
npx prisma db push

# 4. Configure environment
cp .env.example .env
# Edit .env with your Google Cloud project details

# 5. Authenticate with Google Cloud
gcloud auth application-default login

# 6. Start the app
npm run dev
```

### macOS
No Xcode, Homebrew, or system FFmpeg needed. FFmpeg is bundled inside npm.

```bash
# 1. Install Node.js via nvm (no admin rights needed)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 20
nvm use 20

# 2. Install Google Cloud CLI
curl -fsSL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-arm.tar.gz -o /tmp/gcloud.tar.gz
# Intel Mac: replace "darwin-arm" with "darwin-x86_64" in the URL above
tar -xzf /tmp/gcloud.tar.gz -C ~
~/google-cloud-sdk/install.sh --quiet --usage-reporting=false
source ~/google-cloud-sdk/path.bash.inc

# 3. Authenticate with Google Cloud
gcloud auth application-default login --project=YOUR_PROJECT_ID

# 4. Install Node dependencies (FFmpeg downloads automatically here)
npm install

# 5. Set up environment and database
cp .env.example .env
# Edit .env with your Google Cloud project details
npx prisma db push

# 6. Start the app
npm run dev
```

### Windows
```powershell
# 1. Install FFmpeg (via winget)
winget install Gyan.FFmpeg

# 2. Install Node dependencies
npm install

# 3. Set up the database
npx prisma db push

# 4. Configure environment
copy .env.example .env
# Edit .env with your Google Cloud project details

# 5. Authenticate with Google Cloud
gcloud auth application-default login

# 6. Start the app
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Use nvm on macOS — no Xcode needed |
| FFmpeg | — | Bundled automatically via `npm install` |
| gcloud CLI | Any | For Vertex AI auth |
| Google Cloud project | — | With Vertex AI API enabled |

---

## Configuration

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL="file:./dev.db"

GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

GEMINI_MODEL=gemini-2.5-pro
```

### Getting your Google Cloud project ID
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Your project ID is shown in the top bar
3. Make sure **Vertex AI API** is enabled: APIs & Services → Enable APIs → search "Vertex AI"

### Authentication
Run once on your machine:
```bash
gcloud auth application-default login
```
This stores credentials locally. No service account file needed.

---

## How It Works

1. **Dashboard** — Enter role, field, company, job description, topics, and interview duration
2. **Question Generation** — Gemini 2.5 Pro generates a set of questions sized to your time slot
3. **Interview** — One continuous video+audio recording; timestamps mark each question
4. **Processing** (automatic after interview ends):
   - Video saved to `storage/sessions/{id}/recording.webm`
   - Timeline saved to DB
   - FFmpeg slices video into per-question segments
   - Gemini 2.5 Flash transcribes each segment
   - Gemini 2.5 Pro analyzes each answer
5. **Analysis** — Per-question video playback, transcript, score (1–10), strengths, missed points, improvements

---

## File Storage

```
storage/
  sessions/
    {sessionId}/
      recording.webm        ← full interview recording
      segments/
        {entryId}.webm      ← per-question clip
```

All storage is local — nothing is uploaded to the cloud except AI requests.

---

## Development

```bash
npm run dev          # start dev server
npm run build        # production build
npm run db:studio    # open Prisma Studio (DB browser)
npm run db:push      # sync schema to DB
```
