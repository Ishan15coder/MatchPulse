import numpy as np
import pandas as pd
from data import load_finished_matches, load_season_matches, load_team_names
from ratings import compute_ratings

N_SIMS = 10_000


def simulate(history, season_df, as_of=None, n_sims=N_SIMS, seed=42):
    """Simulate the rest of a season.
    history   : all finished league matches (ratings use only those up to as_of)
    season_df : every match of the season being simulated
    as_of     : pretend 'now'; None means the real now (uses match status)
    """
    if as_of is None:
        played = season_df[season_df["status"] == "FINISHED"]
        todo = season_df[season_df["status"] != "FINISHED"]
    else:
        played = season_df[season_df["kickoff_utc"] <= as_of]
        todo = season_df[season_df["kickoff_utc"] > as_of]
    ratings, mu_home, mu_away = compute_ratings(history, as_of=as_of)

    team_ids = sorted(set(season_df["home_team_id"]) | set(season_df["away_team_id"]))
    idx = {tid: i for i, tid in enumerate(team_ids)}
    T = len(team_ids)

    # points and goal difference already in the bank
    base_pts = np.zeros(T)
    base_gd = np.zeros(T)
    for r in played.itertuples():
        h, a = idx[r.home_team_id], idx[r.away_team_id]
        base_gd[h] += r.home_goals - r.away_goals
        base_gd[a] += r.away_goals - r.home_goals
        if r.home_goals > r.away_goals:
            base_pts[h] += 3
        elif r.home_goals < r.away_goals:
            base_pts[a] += 3
        else:
            base_pts[h] += 1
            base_pts[a] += 1

    # expected goals for every remaining match (unrated teams default to 1.0)
    att = ratings["attack"].reindex(team_ids).fillna(1.0).to_numpy()
    dfn = ratings["defence"].reindex(team_ids).fillna(1.0).to_numpy()
    h_idx = todo["home_team_id"].map(idx).to_numpy()
    a_idx = todo["away_team_id"].map(idx).to_numpy()
    lam_h = att[h_idx] * dfn[a_idx] * mu_home
    lam_a = att[a_idx] * dfn[h_idx] * mu_away

    # Monte Carlo
    rng = np.random.default_rng(seed)
    gh = rng.poisson(lam_h, size=(n_sims, len(todo)))
    ga = rng.poisson(lam_a, size=(n_sims, len(todo)))
    home_pts = 3 * (gh > ga) + (gh == ga)
    away_pts = 3 * (ga > gh) + (gh == ga)
    diff = gh - ga

    pts = np.tile(base_pts, (n_sims, 1))
    gd = np.tile(base_gd, (n_sims, 1))
    for t in range(T):
        hm = h_idx == t
        am = a_idx == t
        pts[:, t] += home_pts[:, hm].sum(axis=1) + away_pts[:, am].sum(axis=1)
        gd[:, t] += diff[:, hm].sum(axis=1) - diff[:, am].sum(axis=1)

    score = pts * 1000 + gd + rng.random((n_sims, T)) * 0.5
    ranks = (-score).argsort(axis=1).argsort(axis=1) + 1

    return pd.DataFrame({
        "team_id": team_ids,
        "points_now": base_pts,
        "exp_points": pts.mean(axis=0),
        "title": (ranks == 1).mean(axis=0),
        "top4": (ranks <= 4).mean(axis=0),
        "relegation": (ranks > T - 3).mean(axis=0),
    })


if __name__ == "__main__":
    history = load_finished_matches()
    season_df = load_season_matches(2026)
    names = load_team_names()
    res = simulate(history, season_df)
    res["team"] = res["team_id"].map(names)
    res = res.drop(columns="team_id").sort_values("exp_points", ascending=False)
    pd.set_option("display.width", 200)
    print(res.round(3).to_string(index=False))
    print()
    print("sums (should be 1, 4, 3):",
          round(res["title"].sum(), 3), round(res["top4"].sum(), 3), round(res["relegation"].sum(), 3))