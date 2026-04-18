"""
Centralised logging configuration for Math Buddy backend.

Usage:
    from app.logging_config import configure_logging
    configure_logging()   # call once at startup

Log format:
    LOG_FORMAT=json  → single-line JSON per record (default; cloud-friendly)
    LOG_FORMAT=text  → human-readable for local development

Cloud compatibility:
    The JSON formatter maps Python log levels to GCP severity names so that
    GCP Cloud Logging, AWS CloudWatch, and Azure Monitor all parse records
    correctly.  Each record also includes a 'request_id' field when one is
    present on the current async context (set by the request middleware).
"""

import json
import logging
import sys
from contextvars import ContextVar

# ---------------------------------------------------------------------------
# Context variable — middleware sets this per-request so every log line
# that fires inside a request handler automatically carries the request ID.
# ---------------------------------------------------------------------------
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

# Standard LogRecord attribute names — excluded from the JSON "extra" dump so
# we don't duplicate fields that are already promoted to top-level keys.
_STDLIB_ATTRS: frozenset[str] = frozenset(
    {
        "args", "created", "exc_info", "exc_text", "filename", "funcName",
        "id", "levelname", "levelno", "lineno", "message", "module",
        "msecs", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "taskName", "thread", "threadName",
    }
)


class _JsonFormatter(logging.Formatter):
    """
    Emits each log record as a single JSON line compatible with structured
    logging in GCP, AWS CloudWatch, and Azure Monitor.

    Top-level keys:
      timestamp, severity, logger, message, module, funcName, lineno,
      request_id  — plus any extra keys passed via extra={…}.
    """

    # Map Python levels → GCP severity strings understood by cloud services
    _SEVERITY_MAP = {
        "DEBUG":    "DEBUG",
        "INFO":     "INFO",
        "WARNING":  "WARNING",
        "ERROR":    "ERROR",
        "CRITICAL": "CRITICAL",
    }

    def format(self, record: logging.LogRecord) -> str:
        record.message = record.getMessage()
        payload: dict = {
            "timestamp":  self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "severity":   self._SEVERITY_MAP.get(record.levelname, record.levelname),
            "logger":     record.name,
            "message":    record.message,
            "module":     record.module,
            "funcName":   record.funcName,
            "lineno":     record.lineno,
            "request_id": request_id_ctx.get(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        # Merge caller-supplied extra={…} fields
        for key, value in record.__dict__.items():
            if key not in _STDLIB_ATTRS and not key.startswith("_"):
                payload[key] = value
        return json.dumps(payload, default=str)


class _TextFormatter(logging.Formatter):
    """Human-readable formatter for local development."""

    FMT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

    def __init__(self) -> None:
        super().__init__(self.FMT, datefmt="%H:%M:%S")

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        # Append key extra fields inline for visibility in a terminal
        extras = {
            k: v for k, v in record.__dict__.items()
            if k not in _STDLIB_ATTRS and not k.startswith("_")
        }
        if extras:
            extras_str = "  ".join(f"{k}={v}" for k, v in extras.items())
            return f"{base}  [{extras_str}]"
        return base


def configure_logging() -> None:
    """
    Configure the root logger.  Must be called once at application startup
    before any other module imports trigger logging.

    Reads settings lazily to avoid circular imports.
    """
    # Import here to avoid circular import at module load time
    from app.config import get_settings  # noqa: PLC0415

    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    use_json = settings.log_format.lower() == "json"

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    handler.setFormatter(_JsonFormatter() if use_json else _TextFormatter())
    root.addHandler(handler)

    # Suppress noisy third-party loggers that add no diagnostic value
    for noisy in ("httpx", "httpcore", "openai._base_client", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        "Logging configured",
        extra={"level": settings.log_level.upper(), "format": settings.log_format},
    )
