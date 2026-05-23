from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.database import supabase

router = APIRouter(prefix="/companies", tags=["companies"])


class CompanyCreate(BaseModel):
    name: str
    website: str = ""
    description: str = ""


class CompanyUpdate(BaseModel):
    name: str = None
    website: str = None
    description: str = None


@router.get("/me")
async def get_my_company(user=Depends(get_current_user)):
    result = supabase.table("companies").select("*").eq("user_id", user.id).limit(1).execute()
    return result.data[0] if result.data else None


@router.post("/")
async def create_company(body: CompanyCreate, user=Depends(get_current_user)):
    existing = supabase.table("companies").select("id").eq("user_id", user.id).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Company already exists")
    result = supabase.table("companies").insert({
        "user_id": user.id,
        "name": body.name,
        "website": body.website,
        "description": body.description,
    }).execute()
    return result.data[0]


@router.patch("/me")
async def update_company(body: CompanyUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = supabase.table("companies").update(updates).eq("user_id", user.id).execute()
    return result.data[0]
