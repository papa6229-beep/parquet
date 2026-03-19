import os
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from db import QueryEngine
from security import SQLSecurityError
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Sales Data API", version="1.0.0")

INTERNAL_SECRET = os.environ.get("INTERNAL_API_SECRET", "")
WEB_URL = os.environ.get("WEB_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[WEB_URL, "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def verify_secret(x_internal_secret: str = Header(...)):
    if not INTERNAL_SECRET or x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


class QueryRequest(BaseModel):
    sql: str


@app.on_event("startup")
async def startup():
    try:
        QueryEngine.get().initialize()
    except Exception as e:
        print(f"[startup] Initialization skipped (no files yet): {e}")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/schema", dependencies=[Depends(verify_secret)])
async def get_schema():
    try:
        return QueryEngine.get().get_schema()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", dependencies=[Depends(verify_secret)])
async def run_query(req: QueryRequest):
    try:
        result = QueryEngine.get().query(req.sql)
        return {
            "rows": result.rows,
            "row_count": result.row_count,
            "execution_time_ms": result.execution_time_ms,
        }
    except SQLSecurityError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reload", dependencies=[Depends(verify_secret)])
async def reload_view():
    """Re-initialize sales_view after new parquet files uploaded."""
    try:
        QueryEngine.get().reload()
        return {"status": "reloaded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
