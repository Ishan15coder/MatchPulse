import os
import psycopg
from data import load_finished_matches, load_season_matches   # importing data.py also loads .env
from simulate import simulate, N_SIMS

SEASON = 2026
CODE = "PD"

history = load_finished_matches()
season_df = load_season_matches(SEASON)
res = simulate(history, season_df)

UPSERT = """
INSERT INTO simulation_results
    (competition_id, season, team_id, points_now, exp_points,
     p_title, p_top4, p_relegation, n_sims, run_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
ON CONFLICT (competition_id, season, team_id)
DO UPDATE SET points_now   = EXCLUDED.points_now,
              exp_points   = EXCLUDED.exp_points,
              p_title      = EXCLUDED.p_title,
              p_top4       = EXCLUDED.p_top4,
              p_relegation = EXCLUDED.p_relegation,
              n_sims       = EXCLUDED.n_sims,
              run_at       = now();
"""

with psycopg.connect(
    host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
    port=5432,
    dbname=os.environ["POSTGRES_DB"],
    user=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM competitions WHERE code = %s", (CODE,))
        competition_id = cur.fetchone()[0]
        for r in res.itertuples():
            cur.execute(UPSERT, (
                competition_id, SEASON, int(r.team_id), int(r.points_now),
                float(r.exp_points), float(r.title), float(r.top4),
                float(r.relegation), N_SIMS,
            ))

print(f"saved {len(res)} rows")