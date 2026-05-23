from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.database import supabase

router = APIRouter(tags=["interviews"])


class CandidateRegister(BaseModel):
    candidate_name: str
    candidate_email: str


# Public endpoint — no auth
@router.get("/interview/{slug}")
async def get_interview_by_slug(slug: str):
    role = supabase.table("roles").select("*, companies(name, description)").eq("slug", slug).limit(1).execute()
    if not role.data:
        raise HTTPException(status_code=404, detail="Interview not found")
    return role.data[0]


@router.post("/interview/{slug}/start")
async def start_interview(slug: str, body: CandidateRegister):
    role = supabase.table("roles").select("id").eq("slug", slug).limit(1).execute()
    if not role.data:
        raise HTTPException(status_code=404, detail="Interview not found")
    role_id = role.data[0]["id"]

    existing = (
        supabase.table("interviews")
        .select("id")
        .eq("role_id", role_id)
        .eq("candidate_email", body.candidate_email)
        .in_("status", ["in_progress", "completed", "analyzing", "analyzed"])
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="already_completed")

    result = supabase.table("interviews").insert({
        "role_id": role_id,
        "candidate_name": body.candidate_name,
        "candidate_email": body.candidate_email,
        "status": "in_progress",
    }).execute()
    return result.data[0]


@router.patch("/interview/session/{interview_id}")
async def update_interview_status(interview_id: str, vapi_call_id: str = None):
    updates = {"status": "completed"}
    if vapi_call_id:
        updates["vapi_call_id"] = vapi_call_id
    supabase.table("interviews").update(updates).eq("id", interview_id).execute()
    return {"ok": True}


# Authenticated — recruiter views
@router.get("/candidates")
async def list_candidates(role_id: str = None, user=Depends(get_current_user)):
    company_res = supabase.table("companies").select("id").eq("user_id", user.id).limit(1).execute()
    company = company_res.data[0] if company_res.data else None
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    query = (
        supabase.table("interviews")
        .select("*, roles!inner(title, company_id), reports(recommendation, summary)")
        .eq("roles.company_id", company["id"])
        .order("created_at", desc=True)
    )
    if role_id:
        query = query.eq("role_id", role_id)

    result = query.execute()
    return result.data
