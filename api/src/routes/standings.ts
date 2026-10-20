import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { parseCompetition, parseSeason } from '../validate';

const router = Router();

interface StandingsRow {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competition = parseCompetition(req.query.competition, true); // PD / SA only
    const season = parseSeason(req.query.season);

    const result = await pool.query<StandingsRow>(
      `WITH results AS (
         SELECT m.home_team_id AS team_id,
                m.home_goals   AS gf,
                m.away_goals   AS ga
         FROM matches m
         JOIN competitions c ON c.id = m.competition_id
         WHERE c.code = $1 AND m.season = $2 AND m.status = 'FINISHED'

         UNION ALL

         SELECT m.away_team_id AS team_id,
                m.away_goals   AS gf,
                m.home_goals   AS ga
         FROM matches m
         JOIN competitions c ON c.id = m.competition_id
         WHERE c.code = $1 AND m.season = $2 AND m.status = 'FINISHED'
       )
       SELECT t.name,
              count(*)::int                                                         AS played,
              count(*) FILTER (WHERE gf > ga)::int                                  AS won,
              count(*) FILTER (WHERE gf = ga)::int                                  AS drawn,
              count(*) FILTER (WHERE gf < ga)::int                                  AS lost,
              sum(gf)::int                                                           AS goals_for,
              sum(ga)::int                                                           AS goals_against,
              (sum(gf) - sum(ga))::int                                               AS goal_difference,
              ((count(*) FILTER (WHERE gf > ga)) * 3
               + (count(*) FILTER (WHERE gf = ga)) * 1)::int                        AS points
       FROM results r
       JOIN teams t ON t.id = r.team_id
       GROUP BY t.name
       ORDER BY points DESC, goal_difference DESC;`,
      [competition, season]
    );

    res.json(result.rows);
  } catch (err) {
    if (err instanceof Error && !('code' in err)) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
