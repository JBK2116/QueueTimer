from django.apps import AppConfig


class TimerConfig(AppConfig):
    default_auto_field: str = "django.db.models.BigAutoField"
    name: str = "timer"
