import os
import time
import requests
import psycopg

with open(".env", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

H = {"X-Auth-Token": os.environ["FOOTBALLDATA_KEY"]}

UPSERT = """
INSERT INTO competitions (external_id, code, name)
VALUES (%s, %s, %s)
ON CONFLICT (external_id)
DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name;
"""

with psycopg.connect(
    host=os.environ.get("POSTGRES_HOST", "localhost"),
    port=5432,
    dbname=os.environ["POSTGRES_DB"],
    user=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
) as conn:
    with conn.cursor() as cur:
        for code in ("PD", "SA", "CL"):
            r = requests.get(
                f"https://api.football-data.org/v4/competitions/{code}/matches",
                headers=H,
                params={"season": 2025},
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
            cur.execute(UPSERT, (data["competition"]["id"], code, data["competition"]["name"]))
            time.sleep(7)