"""
Moxsend AI — FastAPI entry point.

Usage (from the /ai directory):
    uv run python -m api.run

Or via uvicorn directly:
    uv run python -m uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
