from django.http import HttpRequest
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["POST"])
def test_connection(request: HttpRequest):
    print(request.POST)
    return Response({"message": "Connection successful"})
