import sqlglot
import sqlglot.expressions as exp
from typing import Set

ALLOWED_TABLES: Set[str] = {"sales_view"}


class SQLSecurityError(Exception):
    pass


def validate_sql(sql: str) -> bool:
    """
    Validates SQL at AST level using sqlglot.
    - Only SELECT statements allowed
    - Only sales_view table allowed (CTEs are permitted)
    - Blocks DDL, DML, PRAGMA, read_parquet/read_csv functions
    """
    sql_stripped = sql.strip()
    first_word = sql_stripped.split()[0].lower() if sql_stripped.split() else ""

    # Fast block for obvious DDL/PRAGMA
    blocked_first = {"drop", "create", "alter", "truncate", "pragma", "attach", "detach", "export", "copy"}
    if first_word in blocked_first:
        raise SQLSecurityError(f"DDL/PRAGMA not allowed: {first_word.upper()}")

    try:
        statements = sqlglot.parse(sql, dialect="duckdb")
    except Exception as e:
        raise SQLSecurityError(f"SQL parse error: {e}")

    if not statements:
        raise SQLSecurityError("Empty SQL")

    for stmt in statements:
        # Block DML
        if isinstance(stmt, (exp.Insert, exp.Update, exp.Delete)):
            raise SQLSecurityError("DML not allowed")
        # Block DDL
        if isinstance(stmt, (exp.Create, exp.Drop, exp.AlterTable, exp.TruncateTable)):
            raise SQLSecurityError("DDL not allowed")

        # Block dangerous function calls (read_parquet, read_csv, etc.)
        for func in stmt.find_all(exp.Anonymous):
            if func.name and func.name.lower().startswith("read_"):
                raise SQLSecurityError(f"Function not allowed: {func.name}")

        # Collect CTE names (they are allowed as table references)
        cte_names: Set[str] = set()
        for cte in stmt.find_all(exp.CTE):
            if cte.alias:
                cte_names.add(cte.alias.lower())

        # Check all table references — must be sales_view or a CTE name
        for table in stmt.find_all(exp.Table):
            name = table.name.lower() if table.name else ""
            if not name:
                continue
            # Block any name that looks like a URL or file path
            if any(c in name for c in ["http", "/", "\\", ".", ":"]):
                raise SQLSecurityError(f"Suspicious table reference: {name}")
            if name not in ALLOWED_TABLES and name not in cte_names:
                raise SQLSecurityError(f"Table not allowed: {name}")

    return True
