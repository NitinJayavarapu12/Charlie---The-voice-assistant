import httpx

# Patch httpx before supabase imports so every Client it creates uses HTTP/1.1.
# Render's network resets HTTP/2 streams to Supabase (StreamReset error_code:1).
_orig_sync = httpx.Client.__init__
_orig_async = httpx.AsyncClient.__init__

def _http1_sync(self, *args, **kwargs):
    kwargs.setdefault("transport", httpx.HTTPTransport(http2=False))
    _orig_sync(self, *args, **kwargs)

def _http1_async(self, *args, **kwargs):
    kwargs.setdefault("transport", httpx.AsyncHTTPTransport(http2=False))
    _orig_async(self, *args, **kwargs)

httpx.Client.__init__ = _http1_sync
httpx.AsyncClient.__init__ = _http1_async

from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
