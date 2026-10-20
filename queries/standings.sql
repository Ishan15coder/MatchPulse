WITH results AS (

    SELECT m.home_team_id AS team_id,
           m.home_goals   AS gf,
           m.away_goals   AS ga
    FROM matches m
    JOIN competitions c ON c.id = m.competition_id
    WHERE c.code = 'PD' AND m.season = 2025 AND m.status = 'FINISHED'

     UNION ALL

    SELECT m.away_team_id AS team_id,
           m.away_goals   AS gf,
           m.home_goals   AS ga
    FROM matches m
    JOIN competitions c ON c.id = m.competition_id
    WHERE c.code = 'PD' AND m.season = 2025 AND m.status = 'FINISHED'
)

SELECT t.name,
       count(*)                          AS played,
       count(*) FILTER (WHERE gf > ga)   AS won,
       count(*) FILTER (WHERE gf = ga)   AS drawn,
       count(*) FILTER (WHERE gf < ga)   AS lost,

       sum(gf)                           AS goals_for,
       sum(ga)                           AS goals_against,
       sum(gf)-sum(ga)                   AS goal_difference,
       (count(*) FILTER (WHERE gf > ga)) * 3 + (count(*) FILTER (WHERE gf = ga)) * 1 AS points
FROM results r
JOIN teams t ON t.id = r.team_id
GROUP BY t.name
ORDER BY points DESC, goal_difference DESC;