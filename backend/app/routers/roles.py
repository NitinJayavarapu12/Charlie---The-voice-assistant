from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from slugify import slugify
import secrets
from app.auth import get_current_user
from app.database import supabase

router = APIRouter(prefix="/roles", tags=["roles"])


class RoleCreate(BaseModel):
    title: str
    description: str
    evaluation_focus: List[str]
    tone: str  # "professional" | "conversational" | "challenging"


def get_company_for_user(user_id: str):
    result = supabase.table("companies").select("id").eq("user_id", user_id).limit(1).execute()
    return result.data[0] if result.data else None


@router.get("/")
async def list_roles(user=Depends(get_current_user)):
    company = get_company_for_user(user.id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    result = supabase.table("roles").select("*, interviews(count)").eq("company_id", company["id"]).order("created_at", desc=True).execute()
    return result.data


@router.post("/")
async def create_role(body: RoleCreate, user=Depends(get_current_user)):
    company = get_company_for_user(user.id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found. Create a company profile first.")
    slug = slugify(body.title) + "-" + secrets.token_urlsafe(4)
    result = supabase.table("roles").insert({
        "company_id": company["id"],
        "title": body.title,
        "description": body.description,
        "evaluation_focus": body.evaluation_focus,
        "tone": body.tone,
        "slug": slug,
    }).execute()
    return result.data[0]


@router.get("/{role_id}")
async def get_role(role_id: str, user=Depends(get_current_user)):
    company = get_company_for_user(user.id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    result = supabase.table("roles").select("*").eq("id", role_id).eq("company_id", company["id"]).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Role not found")
    return result.data[0]


@router.delete("/{role_id}")
async def delete_role(role_id: str, user=Depends(get_current_user)):
    company = get_company_for_user(user.id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    supabase.table("roles").delete().eq("id", role_id).eq("company_id", company["id"]).execute()
    return {"ok": True}
