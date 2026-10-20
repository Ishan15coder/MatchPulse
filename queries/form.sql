WITH results AS (

    SELECT m.home_team_id AS team_id,
           m.kickoff_utc,
           m.home_goals   AS gf,
           m.away_goals   AS ga
    FROM matches m
    JOIN competitions c ON c.id = m.competition_id
    WHERE c.code = 'PD' AND m.season = 2025 AND m.status = 'FINISHED'

    UNION ALL

    SELECT m.away_team_id AS team_id,
           m.kickoff_utc,
           m.away_goals   AS gf,
           m.home_goals   AS ga
    FROM matches m
    JOIN competitions c ON c.id = m.competition_id
    WHERE c.code = 'PD' AND m.season = 2025 AND m.status = 'FINISHED'
),
numbered AS (
    
    SELECT team_id, kickoff_utc, gf, ga,
           row_number() OVER (PARTITION BY team_id ORDER BY kickoff_utc DESC) AS rn
    FROM results
)
SELECT t.name,
       count(*) AS played,
       sum(CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END) AS points_last_5,
       string_agg(
           CASE WHEN gf > ga THEN 'W' WHEN gf = ga THEN 'D' ELSE 'L' END,
           '' ORDER BY kickoff_utc DESC
       ) AS form
FROM numbered n
JOIN teams t ON t.id = n.team_id
WHERE rn <= 5
GROUP BY t.name
ORDER BY points_last_5 DESC, t.name;