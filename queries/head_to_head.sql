WITH pair AS (
    SELECT (SELECT id FROM teams WHERE name = 'FC Barcelona')  AS a_id,
           (SELECT id FROM teams WHERE name = 'Real Madrid CF') AS b_id
),
meetings AS (
    SELECT m.kickoff_utc, c.code, m.season,
           m.home_team_id, m.away_team_id, m.home_goals, m.away_goals,
           p.a_id, p.b_id
    FROM matches m
    JOIN competitions c ON c.id = m.competition_id
    JOIN pair p
      ON (m.home_team_id = p.a_id AND m.away_team_id = p.b_id)
      OR (m.home_team_id = p.b_id AND m.away_team_id = p.a_id)
    WHERE m.status = 'FINISHED'
)
SELECT count(*) AS meetings,
       count(*) FILTER (WHERE (home_team_id = a_id AND home_goals > away_goals)
                           OR (away_team_id = a_id AND away_goals > home_goals)) AS a_wins,
       count(*) FILTER (WHERE home_goals = away_goals) AS draws,
       count(*) FILTER (WHERE (home_team_id = b_id AND home_goals > away_goals)
                           OR (away_team_id = b_id AND away_goals > home_goals)) AS b_wins,
       sum(CASE WHEN home_team_id = a_id THEN home_goals ELSE away_goals END) AS a_goals,
       sum(CASE WHEN home_team_id = b_id THEN home_goals ELSE away_goals END) AS b_goals
FROM meetings;