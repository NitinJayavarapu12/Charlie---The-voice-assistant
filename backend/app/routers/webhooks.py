import json
import google.generativeai as genai
from fastapi import APIRouter, Request, HTTPException
from app.database import supabase
from app.config import GEMINI_API_KEY

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

genai.configure(api_key=GEMINI_API_KEY)


def build_analysis_prompt(transcript: str, role_title: str, evaluation_focus: list, tone: str) -> str:
    focus_str = ", ".join(evaluation_focus)
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
  "recommendation": "Strong candidate" | "Potential candidate" | "Needs review" | "Not recommended"
}}

Return only valid JSON, no markdown.
"""


@router.post("/vapi")
async def vapi_webhook(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    message = payload.get("message", {})
    event_type = message.get("type")

    if event_type != "end-of-call-report":
        return {"ok": True}

    call = message.get("call", {})
    vapi_call_id = call.get("id")
    transcript = message.get("transcript", "")
    artifact = message.get("artifact", {})
    transcript = artifact.get("transcript", transcript)

    if not vapi_call_id:
        return {"ok": True}

    # Find the interview by vapi_call_id
    interview_result = (
        supabase.table("interviews")
        .select("*, roles(title, evaluation_focus, tone)")
        .eq("vapi_call_id", vapi_call_id)
        .limit(1)
        .execute()
    )

    if not interview_result.data:
        return {"ok": True, "message": "Interview not found for this call_id"}

    interview = interview_result.data[0]
    interview_id = interview["id"]
    role = interview["roles"]

    # Save transcript
    supabase.table("transcripts").upsert({
        "interview_id": interview_id,
        "content": transcript,
    }).execute()

    # Update interview status
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
        # Strip markdown code fences if present
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
    }).execute()

    # Mark as analyzed
    supabase.table("interviews").update({"status": "analyzed"}).eq("id", interview_id).execute()

    return {"ok": True}
