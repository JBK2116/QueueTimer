from django.urls import path

from timer.views import test_connection

urlpatterns = [
    path("assignments/", view=test_connection, name="test-connection"),
]
