# MatchPulse

A football data project: fixtures, form, head-to-head, schedule congestion, and a **season simulator** that estimates title, top-4 and relegation probabilities, with a backtest that measures how good those estimates are.

> **Status: work in progress.** Data pipeline, SQL analysis, simulator, backtest and a read-only API are built. The React frontend and deployment are not done yet. See [Status](#status).

Live demo: _coming soon_ · Screenshots: _coming soon_

---

## What it does

| Feature | How it works | Status |
|---|---|---|
| Match data for La Liga, Serie A, Champions League (2023 to 2026) | Python ingestion from football-data.org into PostgreSQL | Done |
| League table, recent form, head-to-head, congestion | SQL queries over the stored matches | Done |
| Season simulator | Poisson goal model + Monte Carlo (10,000 runs) in Python | Done (La Liga) |
| Backtest and calibration | Replays past seasons using only data available at the time | Done |
| Read-only JSON API | Node + TypeScript + Express | Partly done |
| Interactive dashboard | React + TypeScript + Tailwind | Not started |
| Data transparency panel (coverage, sources, limitations) | `/coverage` endpoint + UI | Not started |

---

## How it fits together

```
football-data.org
       |   (free tier: 10 requests/minute, so only the ingestion job calls it)
       v
 Python ingestion  --------->  PostgreSQL (Docker)
 (ingestion/)                  competitions, teams, matches, simulation_results
                                   ^                 ^
                                   |                 |
                  Python analysis (analysis/)     SQL queries (queries/)
                  ratings, simulation, backtest   standings, form, H2H, congestion
                  writes simulation_results
                                   |
                                   v
                      Node + TypeScript API (api/)
                      reads only from the database
                                   |
                                   v
                      React frontend (web/)  <- planned
```

**Key idea:** the database is the contract between the Python half and the Node half. Python fills it and computes the model; Node only reads from it. The frontend never talks to football-data.org or to the database directly.

### Why it is built this way

- **Ingestion is separate from the app.** The free API allows 10 requests per minute. A scheduled job fills the database, and everything else reads from it, so the app never hits the rate limit.
- **Upserts, not inserts.** Every load uses `INSERT ... ON CONFLICT (external_id) DO UPDATE`. Running the job twice produces the same data, never duplicates. This also lets a match move from `SCHEDULED` to `FINISHED` with a score.
- **Timestamps are stored in UTC** (`timestamptz`). Conversion to local time happens only when displaying.
- **The simulation is precomputed.** Python runs it and stores results in `simulation_results`; the Node API serves them. Running 10,000 simulations per page load would be wasteful.
- **Python for data, Node/TypeScript for the API.** Chosen so the user-facing layer is in the language the author knows best, while the analysis uses NumPy and pandas.

---

## Project structure

```
matchpulse/
|-- docker-compose.yml     PostgreSQL 16 in a container, data kept in a named volume
|-- sql/                   Schema files. Docker runs these ONCE when the database is first created
|   |-- 001_schema.sql         competitions, teams, matches
|   `-- 002_simulation.sql     simulation_results
|-- ingestion/             Python: fetch from the API, validate, upsert into the database
|   |-- load_matches.py        main loader (3 competitions x 4 seasons)
|   `-- ...                    small check/inspect scripts
|-- queries/               Analysis SQL you run by hand (kept out of sql/ on purpose)
|   |-- standings.sql
|   |-- form.sql
|   |-- head_to_head.sql
|   `-- congestion.sql
|-- analysis/              Python: ratings, simulator, backtest
|   |-- data.py                loads matches into pandas
|   |-- ratings.py             attack/defence ratings
|   |-- simulate.py            Monte Carlo season simulation
|   |-- backtest.py            replays past seasons, scores the model
|   `-- save_simulation.py     writes results to the database
|-- api/                   Node + TypeScript + Express, read-only API
|-- web/                   React frontend (planned)
|-- Decisions.md           Log of design decisions and why
`-- .env                   Secrets (never committed)
```

> `sql/` runs automatically on first database creation. Analysis queries live in `queries/` so they are never executed by accident.

---

## Data

- **Source:** [football-data.org](https://www.football-data.org/) v4 API, free tier.
- **Coverage:** La Liga (`PD`), Serie A (`SA`), UEFA Champions League (`CL`), seasons 2023 to 2026.
- **Size:** 3,687 matches (8 league seasons x 380, plus 647 Champions League matches).
- **Verification:** the La Liga 2025 table computed by `queries/standings.sql` was compared with the provider's official table, and the last-5 form output was spot-checked against real results.

### Database tables

| Table | Purpose |
|---|---|
| `competitions` | One row per competition (code, name, provider id) |
| `teams` | One row per club. A club exists once, even if it plays in several competitions |
| `matches` | One row per match: competition, season, matchday, stage, UTC kickoff, status, goals. Foreign keys to the two teams, plus a check that a team cannot play itself |
| `simulation_results` | Latest simulation probabilities per team, overwritten on each run |

---

## The simulator, step by step

All of it lives in `analysis/`. The model is deliberately simple so every step can be explained.

1. **Ratings (`ratings.py`).** For each team, compare goals scored and conceded with the league average, with home and away averages kept separate (home teams score about 30% more in this data).
   - *Attack* above 1 means the team scores more than average. *Defence* below 1 means it concedes less than average.
   - **Recency weighting:** each match counts `0.5 ** (age_in_days / 365)`, so a year-old match counts half as much.
   - **Shrinkage:** each rating is blended with 10 "average games", which stops teams with few matches (such as newly promoted ones) from getting extreme ratings.
2. **Expected goals (`simulate.py`).** For a remaining match:
   - home goals ~ home attack x away defence x league home average
   - away goals ~ away attack x home defence x league away average
3. **Random goals.** Each side's goals are drawn from a Poisson distribution with that expected value, the standard simple model for goal counts.
4. **Monte Carlo.** Play out every remaining match 10,000 times, add the results to the current table, rank by points then goal difference (ties broken randomly).
5. **Aggregate.** Count how often each team finishes first, in the top 4, and in the bottom 3. Those frequencies are the reported probabilities.

**Built-in test:** probabilities must sum to exactly 1 (title), 4 (top 4) and 3 (relegation) across the 20 teams.

### Backtest

To check the model against reality, `backtest.py` pretends it is 25%, 50% and 75% of the way through the 2024 and 2025 La Liga seasons. It builds ratings from **only** the matches before that point, simulates the rest, and compares the probabilities with the real final tables.

| Outcome | Model Brier score | Baseline (ignores team quality) |
|---|---|---|
| Title | 0.0233 | 0.0475 |
| Top 4 | 0.0069 | 0.1600 |
| Relegation | 0.0661 | 0.1275 |

Lower is better. The model beats the baseline on all three outcomes, and the calibration table (predicted vs. actual frequencies) is close at the low and high ends.

**Why it only uses earlier matches:** using the whole season would leak the answer into the ratings and make the scores look better than the model really is.

**Limits of this evidence:** only 2 seasons and 3 cutoffs per season (the cutoffs overlap), so it is a sanity check, not proof. The baseline is weak (a stronger one would be "current table position"). The "actual" final table breaks ties by goal difference, while La Liga uses head-to-head.

---

## Limitations

These should also appear in the app's data-transparency panel.

- **Counts of past matches are not predictions.** The simulator gives estimates from a simple model. It ignores injuries, transfers, suspensions and manager changes, and it treats team ratings as certain.
- **Competitions are limited by the free API.** Copa del Rey, Supercopa, Europa League and Conference League are not included, so a team's schedule congestion is **understated**.
- **Head-to-head covers league and Champions League meetings since 2023 only.** It is not an all-time record.
- **Newly promoted teams** start from a neutral rating and are shrunk toward average, which is probably too generous to them.
- **No friendlies** and no national-team matches.
- **Data can be late.** The free tier is not real-time, so scores may lag.

---

## Running it locally

Requirements: Docker Desktop, Python 3.13, Node.js, and a free football-data.org API key.

**1. Create `.env`** in the project root (never commit this file):

```
POSTGRES_DB=sportshub
POSTGRES_USER=sportshub
POSTGRES_PASSWORD=choose_a_password_with_letters_and_numbers
FOOTBALLDATA_KEY=your_api_key
```

Use a plain password (letters, numbers, underscores): some characters such as `#` and `$` break `.env` parsing. No spaces around `=`, no quotes.

**2. Start the database** (PowerShell):

```powershell
docker compose up -d
docker compose ps        # wait for "healthy"
```

The SQL files in `sql/` run automatically the first time. The port is only meant for local use.

**3. Set up Python:**

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

**4. Load the data** (about 105 seconds, because of the API rate limit pause):

```powershell
.venv\Scripts\python.exe ingestion\load_matches.py
```

**5. Run the simulator and save the results:**

```powershell
.venv\Scripts\python.exe analysis\simulate.py
.venv\Scripts\python.exe analysis\backtest.py
.venv\Scripts\python.exe analysis\save_simulation.py
```

**6. Start the API:**

```powershell
cd api
npm install
npm run dev              # http://localhost:3000
```

Try `http://localhost:3000/health` and `http://localhost:3000/matches?competition=PD&season=2025&limit=5`.

**Run an analysis query:**

```powershell
Get-Content queries\standings.sql | docker compose exec -T db sh -c 'psql -U $POSTGRES_USER -d sportshub'
```

> **Careful:** `docker compose down -v` deletes the database volume and all data. Plain `docker compose stop` / `down` keeps it.

---

## API

Base URL (local): `http://localhost:3000`

| Endpoint | Description | Status |
|---|---|---|
| `GET /health` | Checks the database connection | Done |
| `GET /competitions` | List of competitions | Done |
| `GET /matches?competition=PD&season=2025&limit=50` | Matches with team names and crests | Done |
| `GET /teams`, `/standings`, `/form`, `/head-to-head`, `/congestion` | Ports of the SQL in `queries/` | In progress |
| `GET /simulation?competition=PD&season=2026` | Latest simulation probabilities | In progress |
| `GET /coverage` | Match counts, date ranges, last update, limitations | In progress |

All queries are parameterized and all inputs are validated.

---

## Status

- [x] Data source tested (API-Football's free tier blocks the current season, so football-data.org was chosen)
- [x] PostgreSQL schema and Docker setup
- [x] Idempotent ingestion for 3 competitions x 4 seasons
- [x] Data verified against the official La Liga table
- [x] SQL: standings, form, head-to-head, congestion
- [x] Simulator and backtest
- [x] Simulation results stored in the database
- [x] Read-only API (health, competitions, matches)
- [ ] API endpoints for analysis, simulation and coverage
- [ ] React frontend (dashboard, team selection, charts)
- [ ] Deployment
- [ ] Tests and CI
- [ ] Optional: user-selectable team calendar with clash detection and `.ics` export

---

## Tech stack and why

| Tool | Why |
|---|---|
| PostgreSQL 16 (Docker) | Relational model fits matches/teams/competitions; window functions and `FILTER` power the analysis SQL |
| Python 3.13, psycopg | Ingestion and analysis; `psycopg` with parameterized queries |
| pandas, NumPy | Loading data into tables in memory; vectorized Poisson sampling for 10,000 simulations |
| Node.js, TypeScript, Express, `pg` | Small read-only API with typed responses |
| React, TypeScript, Tailwind CSS | Planned frontend |

---

## Data sources and attribution

- Match data: [football-data.org](https://www.football-data.org/), used under its free-tier terms. Check their terms before redistributing or deploying publicly.
- Club crests are served from football-data.org's crest URLs and remain the property of their owners.

---

## Learning notes

The design decisions behind this project, and the reasons for each, are logged in [`Decisions.md`](Decisions.md).