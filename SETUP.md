# Charlie — Setup Guide

## 1. Supabase

1. Go to supabase.com → New project
2. In SQL Editor, run the full contents of `backend/schema.sql`
3. Go to Authentication → Providers → enable **Google** (add OAuth credentials from Google Cloud Console)
4. Note your **Project URL** and **anon key** (Settings → API) and **service_role key**

## 2. Vapi

1. Go to vapi.ai → sign up → Dashboard
2. Create a new **Assistant**:
   - Name: `Charlie Interviewer`
   - System prompt (paste this):
     ```
     You are Charlie, an AI interviewer conducting a first-round interview for the role of {{role_title}} at {{company_name}}.

     Your interview tone: {{tone}}.

     {{jd_context}}

     Interview guidelines:
     - Introduce yourself: "Hi, I'm Charlie, an AI interviewer. I'll be conducting your first-round interview for the {{role_title}} position. This should take about 5–10 minutes."
     - Open with a technical question based on the guidance above.
     - After each candidate response, dynamically decide what to ask next:
       - Topic drill: if they mention a specific technology, tool, or concept, follow up with a deeper technical probe on that topic
       - Quality check: if the answer is vague, surface-level, or lacks concrete examples, ask a follow-up to test real understanding
       - Advance: if the answer is strong, move to a different technical area
       - Behavioral blend: naturally weave in 1–2 behavioral questions when they'd reveal something meaningful about work style or collaboration
     - Ask 4–6 questions total, leading with technical depth
     - If the candidate is silent or gives no response to a question, say: "Let me move on — I'll note that question as unanswered." Then ask the next question.
     - Close with: "That's all I have for today. Thank you for your time — the team will review your interview and be in touch."

     Evaluate the candidate on: {{evaluation_focus}}.

     Keep your tone {{tone}}. Do not reveal you are an AI if not directly asked.
     ```
   - Voice: pick any (Aria or similar)
   - Under **Variables**, ensure these template variables are registered: `role_title`, `company_name`, `tone`, `evaluation_focus`, `jd_context`
   - Under **Server URL**: leave blank for now (you'll set this after deploying or using ngrok)
3. Note your **Assistant ID** and **Public Key** (from the dashboard)

## 3. Gemini

1. Go to aistudio.google.com → Get API key
2. Note your **Gemini API key**

## 4. Environment files

**backend/.env** (copy from `.env.example`):
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...service_role_key
GEMINI_API_KEY=AIza...
FRONTEND_URL=http://localhost:5173
```

**frontend/.env** (copy from `.env.example`):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...anon_key
VITE_API_URL=http://localhost:8000
VITE_VAPI_PUBLIC_KEY=your_vapi_public_key
VITE_VAPI_ASSISTANT_ID=your_vapi_assistant_id
```

## 5. Vapi Webhook (for receiving transcripts)

The webhook needs a public URL. Use **ngrok** during development:
```bash
ngrok http 8000
# Copy the https URL e.g. https://abc123.ngrok.io
```
Then in Vapi dashboard → your Assistant → Server URL:
```
https://abc123.ngrok.io/webhooks/vapi
```

## 6. Run the app

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173

## 7. Demo flow

1. Sign in with Google → fill company profile
2. Create a role (e.g. "Sales Associate") → copy the interview link
3. Open the link in incognito → enter name + email → Start Interview
4. Complete the voice interview with Vapi
5. Webhook fires → Gemini generates report
6. Back in dashboard → Candidates tab → click "View report"
