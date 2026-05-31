#!/usr/bin/env python3
"""Build a throwaway SQLite DB for the e2e tests from seed.sql.

Uses only the Python stdlib (sqlite3) so it runs anywhere with no extra deps and
without depending on any tracked DB blob. The backend auto-creates the remaining
tables (collection, card_hashes, rb_*, tournaments, auth_tokens, …) on startup.
"""
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SEED_SQL = os.path.join(HERE, "..", "seed.sql")


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: seed_db.py <db-path>", file=sys.stderr)
        sys.exit(2)

    db_path = os.path.abspath(sys.argv[1])
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    # Fresh DB every run — drop any prior file plus WAL/SHM sidecars.
    for p in (db_path, db_path + "-wal", db_path + "-shm"):
        try:
            os.remove(p)
        except FileNotFoundError:
            pass

    with open(SEED_SQL, "r", encoding="utf-8") as f:
        sql = f.read()

    con = sqlite3.connect(db_path)
    try:
        con.executescript(sql)
        con.commit()
    finally:
        con.close()

    print(f"seeded {db_path}")


if __name__ == "__main__":
    main()
