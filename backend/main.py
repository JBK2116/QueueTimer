from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .timer.routers import router

# * : Dev Server Is Running At http://127.0.0.1:8000
# * Live Server Is Running At http://localhost:5500
# * : Documentation Server Is Running At http://127.0.0.1:8000/docs

# * Update Origins In PROD
origins: list[str] = [
    "http://localhost:5500",
]
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/assignments")


@app.get(path="/test/")
def test() -> JSONResponse:
    return JSONResponse(
        content={
            "status": "You are now connected to the QueueTimer API",
        },
        status_code=200,
    )
