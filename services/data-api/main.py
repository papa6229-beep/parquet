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


class ReloadRequest(BaseModel):
    urls: Optional[list] = None


@app.on_event("startup")
async def startup():
    try:
        QueryEngine.get().initialize()
    except Exception as e:
        print(f"[startup] Initialization skipped (no files yet): {e}")


@app.get("/health")
async def health():
    engine = QueryEngine.get()
    env_keys = [k for k in os.environ.keys() if "BLOB" in k or "MANIFEST" in k or "INTERNAL" in k]
    return {
        "status": "ok",
        "initialized": engine._initialized,
        "manifest_url_set": bool(os.environ.get("MANIFEST_BLOB_URL", "")),
        "blob_token_set": bool(os.environ.get("BLOB_READ_WRITE_TOKEN", "")),
        "env_keys": env_keys,
    }


@app.get("/debug-manifest")
async def debug_manifest():
    """Test manifest loading — for diagnostics only."""
    from manifest import load_blob_urls
    url = os.environ.get("MANIFEST_BLOB_URL", "")
    token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    try:
        urls = load_blob_urls()
        return {"manifest_url": url[:80] if url else "", "token_len": len(token), "file_count": len(urls), "first_url": urls[0][:80] if urls else ""}
    except Exception as e:
        return {"manifest_url": url[:80] if url else "", "token_len": len(token), "error": str(e)}


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
async def reload_view(req: Optional[ReloadRequest] = None):
    """Re-initialize sales_view after new parquet files uploaded."""
    try:
        if req and req.urls:
            valid, bad = QueryEngine.get().reload(urls=req.urls)
        else:
            valid, bad = QueryEngine.get().reload()
        return {"status": "reloaded", "valid_files": len(valid), "bad_files": bad}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
