import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.logging_config import configure_logging, request_id_ctx
from app.api.v1 import router as v1_router

# Configure logging before anything else so all module-level loggers inherit it
configure_logging()

logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(title="Math Buddy API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# Request logging middleware
# Assigns a unique request_id per request, logs entry/exit with timing,
# and attaches X-Request-ID to the response for correlation in logs.
# ---------------------------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request_id_ctx.set(request_id)
    start = time.perf_counter()

    logger.info(
        "Request started",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host if request.client else "unknown",
        },
    )

    response = await call_next(request)

    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
    log_fn = logger.warning if response.status_code >= 400 else logger.info
    log_fn(
        "Request completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "elapsed_ms": elapsed_ms,
        },
    )

    response.headers["X-Request-ID"] = request_id
    return response


# ---------------------------------------------------------------------------
# Global fallback handler — catches any exception that escapes a route
# handler without being converted to an HTTPException.  Logs a full
# traceback so it is findable in cloud log aggregators.
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled exception — returning 500",
        extra={
            "request_id": request_id_ctx.get(),
            "method": request.method,
            "path": request.url.path,
            "exc_type": type(exc).__name__,
        },
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
        headers={"X-Request-ID": request_id_ctx.get()},
    )


# ---------------------------------------------------------------------------
# Startup event — log key configuration so the first thing in every cloud
# deployment log is the model and CORS origins in use.
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup() -> None:
    logger.info(
        "Math Buddy API starting",
        extra={
            "model": settings.openrouter_model,
            "cors_origins": settings.cors_origins_list,
            "log_level": settings.log_level,
            "log_format": settings.log_format,
        },
    )

