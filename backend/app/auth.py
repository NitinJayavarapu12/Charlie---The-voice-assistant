from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from jose.utils import base64url_decode
from app.config import SUPABASE_JWT_SECRET
import json

security = HTTPBearer()


class _User:
    def __init__(self, id: str):
        self.id = id


def _token_alg(token: str) -> str:
    try:
        header = json.loads(base64url_decode(token.split(".")[0] + "=="))
        return header.get("alg", "HS256")
    except Exception:
        return "HS256"


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    alg = _token_alg(token)
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=[alg],
            options={"verify_aud": False},
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return _User(id=user_id)
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}")
