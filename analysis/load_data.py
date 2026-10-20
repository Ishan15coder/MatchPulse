import os
import pandas as pd
import psycopg

with open(".env", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

QUERY = """
SELECT m.kickoff_utc, m.season, m.home_team_id, m.away_team_id,
       m.home_goals, m.away_goals
FROM matches m
JOIN competitions c ON c.id = m.competition_id
WHERE c.code = 'PD' AND m.status = 'FINISHED'
ORDER BY m.kickoff_utc;
"""

with psycopg.connect(
    host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
    port=5432,
    dbname=os.environ["POSTGRES_DB"],
    user=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
) as conn:
    with conn.cursor() as cur:
        cur.execute(QUERY)
        columns = [d.name for d in cur.description]
        rows = cur.fetchall()

df = pd.DataFrame(rows, columns=columns)

print(df.shape)
print(df.groupby("season").size())
print("Average home goals:", round(df["home_goals"].mean(), 3))
print("Average away goals:", round(df["away_goals"].mean(), 3))