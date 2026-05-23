from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.database import supabase

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{interview_id}")
async def get_report(interview_id: str, user=Depends(get_current_user)):
    company_res = supabase.table("companies").select("id").eq("user_id", user.id).limit(1).execute()
    company = company_res.data[0] if company_res.data else None
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    interview_res = (
        supabase.table("interviews")
        .select("*, roles!inner(title, company_id, description, evaluation_focus, tone)")
        .eq("id", interview_id)
        .eq("roles.company_id", company["id"])
        .limit(1)
        .execute()
    )
    if not interview_res.data:
        raise HTTPException(status_code=404, detail="Interview not found")

    report_res = supabase.table("reports").select("*").eq("interview_id", interview_id).limit(1).execute()
    transcript_res = supabase.table("transcripts").select("content").eq("interview_id", interview_id).limit(1).execute()

    return {
        "interview": interview_res.data[0],
        "report": report_res.data[0] if report_res.data else None,
        "transcript": transcript_res.data[0]["content"] if transcript_res.data else None,
    }
