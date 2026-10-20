import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { parseCompetition, parseSeason, parseLast } from '../validate';

const router = Router();

interface FormRow {
  name: string;
  played: number;
  points_last_n: number;
  form: string;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competition = parseCompetition(req.query.competition, true); // PD / SA only
    const season = parseSeason(req.query.season);
    const last = parseLast(req.query.last);

    const result = await pool.query<FormRow>(
      `WITH results AS (
         SELECT m.home_team_id AS team_id,
                m.kickoff_utc,
                m.home_goals   AS gf,
                m.away_goals   AS ga
         FROM matches m
         JOIN competitions c ON c.id = m.competition_id
         WHERE c.code = $1 AND m.season = $2 AND m.status = 'FINISHED'

         UNION ALL

         SELECT m.away_team_id AS team_id,
                m.kickoff_utc,
                m.away_goals   AS gf,
                m.home_goals   AS ga
         FROM matches m
         JOIN competitions c ON c.id = m.competition_id
         WHERE c.code = $1 AND m.season = $2 AND m.status = 'FINISHED'
       ),
       numbered AS (
         SELECT team_id, kickoff_utc, gf, ga,
                row_number() OVER (PARTITION BY team_id ORDER BY kickoff_utc DESC) AS rn
         FROM results
       )
       SELECT t.name,
              count(*)::int AS played,
              sum(CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END)::int AS points_last_n,
              string_agg(
                CASE WHEN gf > ga THEN 'W' WHEN gf = ga THEN 'D' ELSE 'L' END,
                '' ORDER BY kickoff_utc DESC
              ) AS form
       FROM numbered n
       JOIN teams t ON t.id = n.team_id
       WHERE rn <= $3
       GROUP BY t.name
       ORDER BY points_last_n DESC, t.name;`,
      [competition, season, last]
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
