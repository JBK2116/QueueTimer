from django.contrib import admin

from api.auth.models import CustomUser

# Register your models here.
admin.site.register(CustomUser)
