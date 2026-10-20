import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { parseCompetition, parseSeason } from '../validate';

const router = Router();

interface CongestionRow {
  name: string;
  matches: number;
  avg_rest_days: number;
  min_rest_days: number;
  short_rest_matches: number;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competition = parseCompetition(req.query.competition);
    const season = parseSeason(req.query.season);

    const result = await pool.query<CongestionRow>(
      `WITH team_matches AS (
         SELECT home_team_id AS team_id, kickoff_utc
         FROM matches
         WHERE season = $2
         UNION ALL
         SELECT away_team_id AS team_id, kickoff_utc
         FROM matches
         WHERE season = $2
       ),
       gaps AS (
         SELECT team_id, kickoff_utc,
                kickoff_utc - lag(kickoff_utc) OVER (
                  PARTITION BY team_id ORDER BY kickoff_utc
                ) AS rest
         FROM team_matches
       )
       SELECT t.name,
              count(*)::int                                                              AS matches,
              round(avg(extract(epoch FROM rest) / 86400)::numeric, 1)::float8          AS avg_rest_days,
              round(min(extract(epoch FROM rest) / 86400)::numeric, 1)::float8          AS min_rest_days,
              count(*) FILTER (WHERE rest < interval '4 days')::int                     AS short_rest_matches
       FROM gaps g
       JOIN teams t ON t.id = g.team_id
       WHERE g.team_id IN (
         SELECT m.home_team_id
         FROM matches m
         JOIN competitions c ON c.id = m.competition_id
         WHERE c.code = $1 AND m.season = $2
       )
       GROUP BY t.name
       ORDER BY short_rest_matches DESC, avg_rest_days;`,
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
