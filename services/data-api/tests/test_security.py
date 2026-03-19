import pytest
from security import validate_sql, SQLSecurityError


class TestValidSQLs:
    def test_simple_select(self):
        assert validate_sql("SELECT * FROM sales_view LIMIT 10") is True

    def test_select_with_where(self):
        assert validate_sql("SELECT oaccount, del_zip FROM sales_view WHERE oaccount > 10000") is True

    def test_select_with_aggregation(self):
        sql = "SELECT strftime('%Y-%m', orderno) as month, SUM(oaccount) FROM sales_view GROUP BY 1"
        assert validate_sql(sql) is True

    def test_cte_with_sales_view(self):
        sql = """
        WITH monthly AS (SELECT oaccount FROM sales_view WHERE oaccount > 0)
        SELECT * FROM monthly LIMIT 10
        """
        assert validate_sql(sql) is True


class TestBlockedSQLs:
    def test_blocks_drop(self):
        with pytest.raises(SQLSecurityError):
            validate_sql("DROP TABLE sales_view")

    def test_blocks_insert(self):
        with pytest.raises(SQLSecurityError):
            validate_sql("INSERT INTO sales_view VALUES (1, 2, 3)")

    def test_blocks_external_url(self):
        with pytest.raises(SQLSecurityError):
            validate_sql("SELECT * FROM read_parquet('https://attacker.com/evil.parquet')")

    def test_blocks_unknown_table(self):
        with pytest.raises(SQLSecurityError):
            validate_sql("SELECT * FROM other_table")

    def test_blocks_pragma(self):
        with pytest.raises(SQLSecurityError):
            validate_sql("PRAGMA database_list")
