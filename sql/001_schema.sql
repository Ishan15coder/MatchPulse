CREATE TABLE competitions (
    id          SERIAL PRIMARY KEY,
    external_id INTEGER UNIQUE NOT NULL,
    code        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL
);
CREATE TABLE teams (
    id          SERIAL PRIMARY KEY,
    external_id INTEGER UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    short_name    TEXT,
    crest_url     TEXT
);
CREATE TABLE matches (
    competition_id INTEGER NOT NULL REFERENCES competitions(id),
    home_team_id INTEGER NOT NULL REFERENCES teams(id),
    away_team_id INTEGER NOT NULL REFERENCES teams(id),
    id          SERIAL PRIMARY KEY,
    external_id INTEGER UNIQUE NOT NULL,
    season      INTEGER NOT NULL,
    matchday    INTEGER,
    stage       TEXT,
    kickoff_utc TIMESTAMPTZ NOT NULL,
    status      TEXT NOT NULL,
    home_goals  INTEGER,
    away_goals  INTEGER,
    last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (home_team_id <> away_team_id)
);
    CREATE INDEX idx_matches_comp_season ON matches (competition_id, season);
    CREATE INDEX idx_matches_kickoff ON matches (kickoff_utc);
