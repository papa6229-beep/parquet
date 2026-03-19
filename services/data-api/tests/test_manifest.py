import pytest
import json
from unittest.mock import patch, MagicMock

from manifest import load_blob_urls


def test_load_blob_urls_returns_list():
    sample = {"files": [
        {"url": "https://example.com/file1.parquet", "name": "file1.parquet"},
        {"url": "https://example.com/file2.parquet", "name": "file2.parquet"},
    ]}
    import urllib.request
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(sample).encode()
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)
    with patch("urllib.request.urlopen", return_value=mock_resp):
        with patch.dict("os.environ", {"MANIFEST_BLOB_URL": "https://example.com/manifest.json"}):
            import importlib
            import manifest as m_mod
            importlib.reload(m_mod)
            urls = m_mod.load_blob_urls()
    assert urls == ["https://example.com/file1.parquet", "https://example.com/file2.parquet"]


def test_load_blob_urls_empty_when_no_env():
    with patch.dict("os.environ", {}, clear=False):
        import importlib
        import manifest as m_mod
        # Remove MANIFEST_BLOB_URL if present
        import os
        os.environ.pop("MANIFEST_BLOB_URL", None)
        importlib.reload(m_mod)
        urls = m_mod.load_blob_urls()
    assert urls == []
