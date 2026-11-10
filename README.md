# AI-Interviewer-AI-Powered-Technical-Interview-Platform
AI-powered technical interview platform that generates personalized questions from GitHub projects, conducts voice interviews, and provides AI-based scoring and feedback.

AI-powered technical interview platform that conducts personalized
voice interviews based on a candidate's GitHub projects.

## ✨ Features

- 🤖 AI-generated technical interview questions
- 🧠 Personalized questions using GitHub repositories
- 🎙️ Real-time speech-to-text with Deepgram
- 🔊 Browser-based AI voice responses
- 💬 Automatic interview transcript
- 📊 AI-based interview evaluation
- ⭐ Technical score from 0–10
- 📝 AI-generated feedback
- 🗄️ PostgreSQL database with Prisma ORM
- 🔗 GitHub API integration
- 🚀 REST API backend
- ⚡ Bun-powered development environment

## 🏗️ Architecture

Candidate
   ↓
GitHub URL
   ↓
GitHub API
   ↓
Repository Metadata
   ↓
Gemini
   ↓
Personalized Interview Question
   ↓
Browser Voice
   ↓
Deepgram Speech-to-Text
   ↓
Candidate Answer
   ↓
PostgreSQL + Prisma
   ↓
Gemini Evaluation
   ↓
Score + Feedback

## 🛠️ Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Axios
- Browser SpeechSynthesis API

### Backend
- Bun
- Express.js
- TypeScript
- Prisma
- PostgreSQL

### AI & Voice
- Google Gemini API
- Deepgram Speech-to-Text

### APIs
- GitHub REST API

## 📁 Project Structure

ai-interviewer/
├── apps/
│   ├── backend/
│   │   ├── interviewer.ts
│   │   ├── result.ts
│   │   ├── scrapers/
│   │   │   └── github.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── db.ts
│   │   └── index.ts
│   │
│   └── frontend/
│       └── src/
│           ├── components/
│           └── lib/
│
├── package.json
└── README.md

## ⚙️ Environment Variables

Create:

apps/backend/.env

DATABASE_URL="your_postgresql_connection_string"
GEMINI_API_KEY="your_gemini_api_key"
DEEPGRAM_API_KEY="your_deepgram_api_key"
OPENAI_KEY="optional_openai_key"   # only for the OpenAI Realtime route

See `apps/backend/.env.example`.

## ☁️ Deployment

Dockerfiles for both apps, a `docker-compose.yml` and a Render blueprint (`render.yaml`) are included.
See [DEPLOYMENT.md](DEPLOYMENT.md) for Render, Docker Compose and other hosts.

## 🚀 Installation

### 1. Clone the repository

git clone YOUR_GITHUB_REPOSITORY_URL

cd ai-interviewer

### 2. Install dependencies

bun install

### 3. Configure environment variables

Create `apps/backend/.env` and add the required API keys.

### 4. Generate Prisma client

cd apps/backend

bunx prisma generate

### 5. Run migrations

bunx prisma migrate dev

### 6. Start the application

From the project root:

bun run dev

Frontend:
http://localhost:3000

Backend:
http://localhost:3001

## 🔄 How It Works

### 1. Candidate Registration

The candidate provides their GitHub profile URL.

### 2. GitHub Analysis

The backend retrieves the candidate's public repositories and extracts:

- Repository name
- Description
- Full repository name
- Star count

### 3. Personalized Question Generation

Repository information and previous interview responses are sent to
Gemini.

Gemini generates a technical question based on the candidate's projects.

### 4. Voice Interview

The question is spoken using the browser's SpeechSynthesis API.

The candidate's microphone audio is streamed to Deepgram.

### 5. Response Storage

Candidate responses are stored in PostgreSQL through Prisma.

### 6. Adaptive Interview

Previous questions and answers are provided to Gemini so that subsequent
questions can explore different technical areas.

### 7. Evaluation

After the interview, Gemini evaluates the transcript based on:

- Technical knowledge
- Project understanding
- Problem solving
- Communication
- Accuracy
- Depth of responses

The candidate receives:

**Score:** 0–10

**Feedback:** Detailed AI-generated interview feedback.

## 🗄️ Database

The application uses PostgreSQL with Prisma ORM.

### Interview

Stores:

- Interview ID
- GitHub metadata
- Interview status
- Score
- Feedback

### Message

Stores:

- Message ID
- Interview ID
- Speaker type
- Message content
- Timestamp

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/pre-interview` | Create interview |
| POST | `/api/v1/interview/question/:interviewId` | Generate next question |
| POST | `/api/v1/session/user/response/:interviewId` | Save candidate response |
| GET | `/api/v1/deepgram-token` | Generate temporary Deepgram token |
| GET | `/api/v1/result/:interviewId` | Get interview result |

## 🔐 Security

API keys are stored in environment variables and should never be committed
to Git.

Add `.env` to `.gitignore`.

Never expose:

- `GEMINI_API_KEY`
- `DEEPGRAM_API_KEY`
- `DATABASE_URL`

## 📌 Current Limitations

- Browser SpeechSynthesis behavior can vary between browsers.
- Voice activity/answer segmentation can affect transcript boundaries.
- Gemini free-tier quotas can limit question generation/evaluation.
- GitHub analysis currently uses publicly available repository metadata.

## 🔮 Future Improvements

- Resume parsing and NLP analysis
- Job-description matching
- TF-IDF keyword extraction
- Named Entity Recognition
- Sentiment analysis
- Improved voice activity detection
- Better answer segmentation
- Interview difficulty adaptation
- Authentication
- Interview history dashboard
- Deployment
- Automated interview analytics

## 👨‍💻 Author

**Sanskar Verma**

Computer Science (AI) Graduate

---

⭐ If you find this project useful, consider giving it a star!
