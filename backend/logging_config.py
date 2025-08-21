"""
This module stores the global logging configuration dictionary
"""
from typing import Any

LOGGING_CONFIG: dict[str, Any] = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
        }
    },
    "handlers": {
        "auth_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/auth.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "formatter": "json",
        },
        "timer_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/timer.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "formatter": "json",
        },
        "console": {"class": "logging.StreamHandler", "formatter": "json"},
    },
    "loggers": {
        "auth": {
            "handlers": ["auth_file", "console"],
            "level": "INFO",
            "propagate": False,
        },
        "timer": {
            "handlers": ["timer_file", "console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
