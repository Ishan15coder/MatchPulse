WITH team_matches AS (
    SELECT home_team_id AS team_id, kickoff_utc
    FROM matches WHERE season = 2025
    UNION ALL
    SELECT away_team_id AS team_id, kickoff_utc
    FROM matches WHERE season = 2025
),
gaps AS (
    SELECT team_id, kickoff_utc,
           kickoff_utc - lag(kickoff_utc) OVER (
               PARTITION BY team_id ORDER BY kickoff_utc
           ) AS rest
    FROM team_matches
)
SELECT t.name,
       count(*) AS matches,
       round(avg(extract(epoch FROM rest) / 86400)::numeric, 1) AS avg_rest_days,
       round(min(extract(epoch FROM rest) / 86400)::numeric, 1) AS min_rest_days,
       count(*) FILTER (WHERE rest < interval '4 days') AS short_rest_matches
FROM gaps g
JOIN teams t ON t.id = g.team_id
WHERE g.team_id IN (
    SELECT m.home_team_id
    FROM matches m
    JOIN competitions c ON c.id = m.competition_id
    WHERE c.code = 'PD' AND m.season = 2025
)
GROUP BY t.name
ORDER BY short_rest_matches DESC, avg_rest_days;