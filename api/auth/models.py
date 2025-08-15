
# Create your models here.

from django.contrib.auth.models import AbstractUser
from django.db import models

# Register your models here.


class CustomUser(AbstractUser):
    email: models.EmailField[str] = models.EmailField(
        max_length=254,
        null=False,
        blank=False,
        unique=True,
        help_text="Required, Email Field: 254 characters or fewer, '@' symbol required.",
    )
    username: models.CharField[str] = models.CharField(
        max_length=30,
        null=False,
        blank=False,
        help_text="Required. Username Field: 30 characters or fewer.",
    )
    password: models.CharField[str] = models.CharField(
        max_length=254,
        null=False,
        blank=False,
        help_text="Required. Password Field: 254 characters or fewer",
    )