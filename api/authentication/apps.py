from django.apps import AppConfig


class AuthConfig(AppConfig):
    default_auto_field: str = "django.db.models.BigAutoField"
    name: str = "authentication"
