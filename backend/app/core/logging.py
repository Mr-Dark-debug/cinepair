import structlog
import logging
import sys
from app.core.config import settings


def setup_logging() -> None:
    """Configure structlog for the application."""

    # Determine renderer based on environment
    if settings.is_production:
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.format_exc_info,
            _redact_sensitive_fields,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.LOG_LEVEL)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def _redact_sensitive_fields(logger, method_name, event_dict):
    """Redact sensitive information from logs."""
    sensitive_keys = {"password", "token", "sessionToken", "secret", "credential"}
    for key in list(event_dict.keys()):
        if any(s in key.lower() for s in sensitive_keys):
            event_dict[key] = "[REDACTED]"
    return event_dict


def get_logger(name: str = None):
    """Get a structured logger instance."""
    if name:
        return structlog.get_logger(name)
    return structlog.get_logger()
