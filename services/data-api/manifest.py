import json
import os
import urllib.request
from typing import List

MANIFEST_BLOB_URL = os.environ.get("MANIFEST_BLOB_URL", "")


def load_blob_urls() -> List[str]:
    """
    Reads manifest.json from Vercel Blob (private URL with Bearer auth).
    Returns list of parquet file URLs.
    Returns empty list if MANIFEST_BLOB_URL is not set.
    """
    url = os.environ.get("MANIFEST_BLOB_URL", MANIFEST_BLOB_URL)
    if not url:
        return []
    blob_token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {blob_token}",
    })
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    return [item["url"] for item in data.get("files", [])]
