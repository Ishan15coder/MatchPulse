import pandas as pd
from data import load_finished_matches, load_team_names

HALF_LIFE_DAYS = 365   # a match this old counts half as much
PRIOR_GAMES = 10       # shrinkage: blend with 10 "average" games


def compute_ratings(df, as_of=None):
    """Attack/defence ratings using only matches up to `as_of`."""
    if as_of is None:
        as_of = df["kickoff_utc"].max()
    d = df[df["kickoff_utc"] <= as_of].copy()

    age_days = (as_of - d["kickoff_utc"]).dt.total_seconds() / 86400
    d["weight"] = 0.5 ** (age_days / HALF_LIFE_DAYS)

    # weighted league averages (home and away kept separate)
    mu_home = (d["weight"] * d["home_goals"]).sum() / d["weight"].sum()
    mu_away = (d["weight"] * d["away_goals"]).sum() / d["weight"].sum()
    avg = (mu_home + mu_away) / 2   # average goals per team per match

    # one row per team per match, from that team's point of view
    home_rows = pd.DataFrame({"team_id": d["home_team_id"], "weight": d["weight"],
                              "scored": d["home_goals"], "conceded": d["away_goals"]})
    away_rows = pd.DataFrame({"team_id": d["away_team_id"], "weight": d["weight"],
                              "scored": d["away_goals"], "conceded": d["home_goals"]})
    rows = pd.concat([home_rows, away_rows])
    rows["w_scored"] = rows["weight"] * rows["scored"]
    rows["w_conceded"] = rows["weight"] * rows["conceded"]

    g = rows.groupby("team_id").agg(
        games=("weight", "sum"),
        w_scored=("w_scored", "sum"),
        w_conceded=("w_conceded", "sum"),
    )
    g["attack"] = (g["w_scored"] + PRIOR_GAMES * avg) / (g["games"] + PRIOR_GAMES) / avg
    g["defence"] = (g["w_conceded"] + PRIOR_GAMES * avg) / (g["games"] + PRIOR_GAMES) / avg
    return g[["games", "attack", "defence"]], mu_home, mu_away


if __name__ == "__main__":
    df = load_finished_matches()
    names = load_team_names()
    ratings, mu_home, mu_away = compute_ratings(df)
    ratings["team"] = ratings.index.map(names)
    print(f"mu_home={mu_home:.3f}  mu_away={mu_away:.3f}\n")
    print(ratings.sort_values("attack", ascending=False).round(2).to_string())