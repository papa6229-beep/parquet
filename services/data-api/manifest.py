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
        print("[manifest] MANIFEST_BLOB_URL is not set")
        return []
    blob_token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    print(f"[manifest] Loading from: {url[:60]}...")
    try:
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {blob_token}",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        urls = [item["url"] for item in data.get("files", [])]
        print(f"[manifest] Found {len(urls)} files")
        return urls
    except Exception as e:
        print(f"[manifest] Failed to load: {e}")
        return []
