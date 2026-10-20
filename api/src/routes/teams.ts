import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { parseCompetition, parseSeason } from '../validate';

const router = Router();

interface TeamRow {
  id: number;
  name: string;
  short_name: string | null;
  crest_url: string | null;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competition = parseCompetition(req.query.competition);
    const season = parseSeason(req.query.season);

    const result = await pool.query<TeamRow>(
      `SELECT DISTINCT t.id, t.name, t.short_name, t.crest_url
       FROM teams t
       JOIN matches m ON (m.home_team_id = t.id OR m.away_team_id = t.id)
       JOIN competitions c ON c.id = m.competition_id
       WHERE c.code = $1 AND m.season = $2
       ORDER BY t.name ASC;`,
      [competition, season]
    );

    res.json(result.rows);
  } catch (err) {
    if (err instanceof Error && !('code' in err)) {
      // Validation error — safe to expose message
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
