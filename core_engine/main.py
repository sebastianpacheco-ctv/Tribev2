from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core_engine.api.routes import diagnostics

app = FastAPI(
    title="TRIBE v2 Core Engine",
    description="Brain-inspired predictive foundation model API for creative diagnostics.",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(diagnostics.router, prefix="/api/v1/diagnostics", tags=["diagnostics"])

@app.get("/")
async def root():
    return {
        "status": "online",
        "engine": "TRIBE v2",
        "version": "2.0.0"
    }
