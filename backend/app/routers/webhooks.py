import json
import google.generativeai as genai
from fastapi import APIRouter, Request, HTTPException
from app.database import supabase
from app.config import GEMINI_API_KEY

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

genai.configure(api_key=GEMINI_API_KEY)


def build_analysis_prompt(transcript: str, role_title: str, evaluation_focus: list, tone: str) -> str:
    focus_str = ", ".join(evaluation_focus) if evaluation_focus else "general skills"
    return f"""You are an expert hiring analyst. Analyze this interview transcript for a "{role_title}" role.

The interviewer used a "{tone}" tone and evaluated: {focus_str}.

TRANSCRIPT:
{transcript}

Return a JSON object with exactly these fields:
{{
  "summary": "2-3 sentence overall summary of the candidate",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "behavioral_insights": "paragraph analyzing communication style, seriousness, and professionalism",
  "recommendation": "Strong candidate" | "Potential candidate" | "Needs review" | "Not recommended",
  "skill_scores": {{
    "Skill Name": 4
  }},
  "questions_and_answers": [
    {{"question": "Question the interviewer asked", "answer_summary": "Brief summary of candidate's response", "score": 4}}
  ]
}}

For skill_scores: score each of these skills 1-5 based on the transcript: {focus_str}. Use the exact skill names listed.
For questions_and_answers: list every question the AI interviewer asked with a 1-sentence answer summary and a score 1-5.
Return only valid JSON, no markdown.
"""


@router.post("/vapi")
async def vapi_webhook(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    message = payload.get("message", payload)
    event_type = message.get("type")

    if event_type != "end-of-call-report":
        return {"ok": True}

    call = message.get("call", {})
    vapi_call_id = call.get("id")
    metadata = call.get("metadata", {})
    interview_id_from_metadata = metadata.get("interview_id") if metadata else None

    artifact = message.get("artifact", {})
    transcript = artifact.get("transcript") or message.get("transcript", "")

    # Look up interview — prefer metadata interview_id to avoid race condition
    if interview_id_from_metadata:
        interview_result = (
            supabase.table("interviews")
            .select("*, roles(title, evaluation_focus, tone)")
            .eq("id", interview_id_from_metadata)
            .limit(1)
            .execute()
        )
    elif vapi_call_id:
        interview_result = (
            supabase.table("interviews")
            .select("*, roles(title, evaluation_focus, tone)")
            .eq("vapi_call_id", vapi_call_id)
            .limit(1)
            .execute()
        )
    else:
        return {"ok": True, "message": "No interview identifier found"}

    if not interview_result.data:
        return {"ok": True, "message": "Interview not found"}

    interview = interview_result.data[0]
    interview_id = interview["id"]
    role = interview["roles"]

    # Save transcript
    supabase.table("transcripts").upsert({
        "interview_id": interview_id,
        "content": transcript,
    }).execute()

    # Update interview status to analyzing
    supabase.table("interviews").update({"status": "analyzing"}).eq("id", interview_id).execute()

    # Generate report with Gemini
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = build_analysis_prompt(
            transcript=transcript,
            role_title=role["title"],
            evaluation_focus=role.get("evaluation_focus", []),
            tone=role.get("tone", "professional"),
        )
        response = model.generate_content(prompt)
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        report_data = json.loads(raw)
    except Exception as e:
        supabase.table("interviews").update({"status": "completed"}).eq("id", interview_id).execute()
        return {"ok": False, "error": str(e)}

    # Save report
    supabase.table("reports").upsert({
        "interview_id": interview_id,
        "summary": report_data.get("summary", ""),
        "strengths": report_data.get("strengths", []),
        "weaknesses": report_data.get("weaknesses", []),
        "behavioral_insights": report_data.get("behavioral_insights", ""),
        "recommendation": report_data.get("recommendation", "Needs review"),
        "skill_scores": report_data.get("skill_scores", {}),
        "questions_and_answers": report_data.get("questions_and_answers", []),
    }).execute()

    # Mark as analyzed
    supabase.table("interviews").update({"status": "analyzed"}).eq("id", interview_id).execute()

    return {"ok": True}
