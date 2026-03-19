import json
import os
import urllib.request
from typing import List

MANIFEST_BLOB_URL = os.environ.get("MANIFEST_BLOB_URL", "")


def load_blob_urls() -> List[str]:
    """
    Reads manifest.json from Vercel Blob (public HTTP URL).
    Returns list of parquet file URLs.
    Returns empty list if MANIFEST_BLOB_URL is not set.
    """
    url = os.environ.get("MANIFEST_BLOB_URL", MANIFEST_BLOB_URL)
    if not url:
        return []
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    return [item["url"] for item in data.get("files", [])]
