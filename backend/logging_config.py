"""
This module stores the global logging configuration dictionary
"""

import os
from typing import Any

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOGS_DIR = os.path.join(BASE_DIR, "logs")

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
            "filename": os.path.join(LOGS_DIR, "auth.log"),
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "formatter": "json",
        },
        "timer_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": os.path.join(LOGS_DIR, "timer.log"),
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
