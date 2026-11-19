import os
from contextlib import contextmanager
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from backend.config import Config

_connection_pool = None

def init_db_pool():
    """Initializes the psycopg2 threaded connection pool."""
    global _connection_pool
    if _connection_pool is None:
        try:
            _connection_pool = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=25,
                dsn=Config.DATABASE_URL
            )
            print(">> [PostgreSQL] Connection pool established successfully.")
        except Exception as e:
            print(f">> [PostgreSQL Warning] Could not connect to database: {e}")
            _connection_pool = None

def close_db_pool():
    """Closes all connections in the pool on shutdown."""
    global _connection_pool
    if _connection_pool is not None:
        _connection_pool.closeall()
        _connection_pool = None

@contextmanager
def get_db():
    """
    Thread-safe context manager yielding (connection, cursor).
    Cursors return dictionaries (RealDictCursor).
    Commits automatically on completion or rolls back on exception.
    """
    global _connection_pool
    if _connection_pool is None:
        init_db_pool()

    if _connection_pool is None:
        raise RuntimeError(
            "Database pool is not available. Please verify PostgreSQL service is running and DATABASE_URL is correct."
        )

    conn = _connection_pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield conn, cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _connection_pool.putconn(conn)
