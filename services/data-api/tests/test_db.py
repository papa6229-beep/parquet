import pytest
from unittest.mock import patch, MagicMock
from dataclasses import dataclass


def test_query_result_is_dataclass():
    from db import QueryResult
    r = QueryResult(rows=[{"a": 1}], row_count=1, execution_time_ms=50.0)
    assert r.rows == [{"a": 1}]
    assert r.row_count == 1
    assert r.execution_time_ms == 50.0


def test_query_engine_is_singleton():
    from db import QueryEngine
    a = QueryEngine.get()
    b = QueryEngine.get()
    assert a is b


def test_query_blocks_invalid_sql():
    from db import QueryEngine
    from security import SQLSecurityError
    engine = QueryEngine.get()
    with pytest.raises(SQLSecurityError):
        engine.query("DROP TABLE sales_view")


def test_query_limits_rows():
    from db import QueryEngine, MAX_ROWS
    engine = QueryEngine.get()
    # Mock the DuckDB connection
    mock_rel = MagicMock()
    mock_rel.description = [("id", "INTEGER", None, None, None, None, None)]
    mock_rel.fetchall.return_value = [(i,) for i in range(600)]
    with patch("db.validate_sql", return_value=True):
        with patch.object(engine, "conn") as mock_conn:
            mock_conn.execute.return_value = mock_rel
            result = engine.query("SELECT id FROM sales_view")
    assert result.row_count <= MAX_ROWS
    assert len(result.rows) <= MAX_ROWS
