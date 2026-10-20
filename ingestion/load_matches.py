import os
import time
import requests
import psycopg

# ---------- load .env ----------
with open(".env", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

H = {"X-Auth-Token": os.environ["FOOTBALLDATA_KEY"]}

COMPETITIONS = ("PD", "SA", "CL")
SEASONS = (2023, 2024, 2025, 2026)

# ---------- SQL ----------
COMP_UPSERT = """
INSERT INTO competitions (external_id, code, name)
VALUES (%s, %s, %s)
ON CONFLICT (external_id)
DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name
RETURNING id;
"""

TEAM_UPSERT = """
INSERT INTO teams (external_id, name, short_name, crest_url)
VALUES (%s, %s, %s, %s)
ON CONFLICT (external_id)
DO UPDATE SET name = EXCLUDED.name,
              short_name = EXCLUDED.short_name,
              crest_url = EXCLUDED.crest_url
RETURNING id;
"""

MATCH_UPSERT = """
INSERT INTO matches (competition_id, home_team_id, away_team_id, external_id,
                     season, matchday, stage, kickoff_utc, status,
                     home_goals, away_goals)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (external_id)
DO UPDATE SET status = EXCLUDED.status,
              kickoff_utc = EXCLUDED.kickoff_utc,
              home_goals = EXCLUDED.home_goals,
              away_goals = EXCLUDED.away_goals,
              last_updated = now();
"""

start = time.time()
team_ids = {}   # external team id -> internal id, shared across the whole run

with psycopg.connect(
    host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
    port=5432,
    dbname=os.environ["POSTGRES_DB"],
    user=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
) as conn:
    with conn.cursor() as cur:

        def get_team_id(t):
            if t["id"] not in team_ids:
                cur.execute(TEAM_UPSERT, (t["id"], t["name"], t["shortName"], t["crest"]))
                team_ids[t["id"]] = cur.fetchone()[0]
            return team_ids[t["id"]]

        requests_made = 0
        for code in COMPETITIONS:
            for season in SEASONS:
                # stay under the free tier's 10 requests/minute
                if requests_made > 0:
                    time.sleep(7)
                r = requests.get(
                    f"https://api.football-data.org/v4/competitions/{code}/matches",
                    headers=H,
                    params={"season": season},
                    timeout=30,
                )
                r.raise_for_status()
                requests_made += 1
                data = r.json()

                cur.execute(COMP_UPSERT, (data["competition"]["id"], code, data["competition"]["name"]))
                competition_id = cur.fetchone()[0]

                saved = 0
                skipped = 0
                for m in data["matches"]:
                    home = m["homeTeam"]
                    away = m["awayTeam"]

                    # skip matches where a team isn't known yet (e.g. undrawn knockout rounds)
                    if home["id"] is None or away["id"] is None:
                        skipped += 1
                        continue

                    home_id = get_team_id(home)
                    away_id = get_team_id(away)

                    cur.execute(MATCH_UPSERT, (
                        competition_id,
                        home_id,
                        away_id,
                        m["id"],
                        season,
                        m["matchday"],
                        m["stage"],
                        m["utcDate"],
                        m["status"],
                        m["score"]["fullTime"]["home"],
                        m["score"]["fullTime"]["away"],
                    ))
                    saved += 1

                print(f"{code} {season}: saved {saved}, skipped {skipped} ({time.time() - start:.0f}s)")

print(f"Done in {time.time() - start:.0f}s")