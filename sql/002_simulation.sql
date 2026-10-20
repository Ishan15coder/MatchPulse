CREATE TABLE simulation_results (
    id             SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id),
    season         INTEGER NOT NULL,
    team_id        INTEGER NOT NULL REFERENCES teams(id),
    points_now     INTEGER NOT NULL,
    exp_points     NUMERIC(6,2) NOT NULL,
    p_title        NUMERIC(5,4) NOT NULL,
    p_top4         NUMERIC(5,4) NOT NULL,
    p_relegation   NUMERIC(5,4) NOT NULL,
    n_sims         INTEGER NOT NULL,
    run_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (competition_id, season, team_id)
);