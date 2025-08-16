from django.urls import path

from authentication.views import test_connection

urlpatterns = [
    path("", view=test_connection, name="test-connection"),
]
