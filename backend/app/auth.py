from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from app.config import SUPABASE_URL

security = HTTPBearer()
_jwks_cache: dict | None = None


class _User:
    def __init__(self, id: str):
        self.id = id


def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        with httpx.Client(http2=False) as client:
            resp = client.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "RS256")
        kid = header.get("kid")

        keys = _get_jwks().get("keys", [])
        if kid:
            keys = [k for k in keys if k.get("kid") == kid]

        last_err: Exception = Exception("No keys found")
        for key_data in keys:
            try:
                payload = jwt.decode(token, key_data, algorithms=[alg], options={"verify_aud": False})
                user_id = payload.get("sub")
                if not user_id:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
                return _User(id=user_id)
            except JWTError as e:
                last_err = e

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token verification failed: {last_err}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Auth error: {str(e)}")
