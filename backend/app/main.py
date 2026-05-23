from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import companies, roles, interviews, reports, webhooks

app = FastAPI(title="Charlie API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router)
app.include_router(roles.router)
app.include_router(interviews.router)
app.include_router(reports.router)
app.include_router(webhooks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
