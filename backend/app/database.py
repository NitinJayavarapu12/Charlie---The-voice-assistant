from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
import httpx

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Force HTTP/1.1 on the PostgREST session — Render's network resets HTTP/2 streams
try:
    _old = supabase.postgrest.session
    supabase.postgrest.session = httpx.Client(
        base_url=str(_old.base_url),
        headers={k: v for k, v in _old.headers.items()},
        transport=httpx.HTTPTransport(http2=False),
    )
except Exception:
    pass
