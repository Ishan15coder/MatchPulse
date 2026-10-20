import pandas as pd
from data import load_finished_matches, load_season_matches
from simulate import simulate

SEASONS = (2024, 2025)
FRACTIONS = (0.25, 0.5, 0.75)   # how far into the season we pretend to be
OUTCOMES = ("title", "top4", "relegation")


def actual_outcomes(season_df):
    """What really happened: final position -> title / top4 / relegation."""
    pts, gd = {}, {}
    for r in season_df.itertuples():
        h, a = r.home_team_id, r.away_team_id
        for t in (h, a):
            pts.setdefault(t, 0)
            gd.setdefault(t, 0)
        gd[h] += r.home_goals - r.away_goals
        gd[a] += r.away_goals - r.home_goals
        if r.home_goals > r.away_goals:
            pts[h] += 3
        elif r.home_goals < r.away_goals:
            pts[a] += 3
        else:
            pts[h] += 1
            pts[a] += 1
    order = sorted(pts, key=lambda t: (-pts[t], -gd[t]))
    n = len(order)
    return {t: {"title": i == 0, "top4": i < 4, "relegation": i >= n - 3}
            for i, t in enumerate(order)}


history = load_finished_matches()
rows = []
for season in SEASONS:
    season_df = load_season_matches(season)
    actual = actual_outcomes(season_df)
    kickoffs = season_df["kickoff_utc"].sort_values().reset_index(drop=True)
    for frac in FRACTIONS:
        as_of = kickoffs.iloc[int(len(kickoffs) * frac)]
        res = simulate(history, season_df, as_of=as_of, n_sims=5000)
        for r in res.itertuples():
            for outcome in OUTCOMES:
                rows.append({
                    "season": season,
                    "cutoff": frac,
                    "outcome": outcome,
                    "p": getattr(r, outcome),
                    "actual": int(actual[r.team_id][outcome]),
                })
        print(f"season {season}, cutoff {frac:.0%}: done")

df = pd.DataFrame(rows)

# 1) Brier score vs. a baseline that ignores team quality
base_rate = {"title": 1 / 20, "top4": 4 / 20, "relegation": 3 / 20}
print("\nBrier score (lower is better); baseline = always predict the base rate")
for outcome in OUTCOMES:
    d = df[df["outcome"] == outcome]
    model = ((d["p"] - d["actual"]) ** 2).mean()
    base = ((base_rate[outcome] - d["actual"]) ** 2).mean()
    print(f"  {outcome:<11} model {model:.4f}   baseline {base:.4f}")

# 2) Calibration: when the model says X%, how often does it happen?
df["bin"] = pd.cut(df["p"], [0, 0.05, 0.2, 0.5, 0.8, 0.95, 1.0], include_lowest=True)
cal = df.groupby("bin", observed=True).agg(
    n=("p", "size"), predicted=("p", "mean"), actual=("actual", "mean"))
print("\nCalibration (all outcomes pooled)")
print(cal.round(3).to_string())