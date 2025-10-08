"""
Astra FastAPI Application

Multi-user astrology conversational AI backend (monolith)
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="[%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info(f"Starting {settings.app_name}...")
    logger.info(f"MongoDB: {settings.mongodb_cluster}")
    logger.info(f"Environment: {'Development' if settings.debug else 'Production'}")

    # TODO: Initialize MongoDB connection
    # TODO: Start background workers

    yield

    # Shutdown
    logger.info("Shutting down...")
    # TODO: Close MongoDB connection
    # TODO: Stop background workers


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Multi-user astrology conversational AI backend",
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)

# CORS for development (Next.js app service running separately)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes (will be added incrementally)
# from app.api import auth, users, conversations, websocket
# app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
# app.include_router(users.router, prefix="/api/users", tags=["users"])
# app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
# app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


# Health check
@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "app": settings.app_name, "version": "0.1.0"}


@app.get("/")
def root():
    """Root endpoint"""
    return {"message": "Astra API", "docs": "/docs", "health": "/api/health"}


# Serve app static files (production only)
# Uncomment when pre-rendered assets are available
# if not settings.debug:
#     app.mount("/", StaticFiles(directory="app/out", html=True), name="app")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host=settings.host, port=settings.port, reload=settings.debug
    )
