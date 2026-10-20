import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { parseCompetition, parseSeason } from '../validate';

const router = Router();

interface SimulationTeam {
  team_id: number;
  name: string;
  short_name: string | null;
  crest_url: string | null;
  points_now: number;
  exp_points: number;
  p_title: number;
  p_top4: number;
  p_relegation: number;
}

interface SimulationResponse {
  run_at: string | null;
  n_sims: number | null;
  teams: SimulationTeam[];
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competition = parseCompetition(req.query.competition, true); // PD / SA only
    const season = parseSeason(req.query.season);

    const result = await pool.query<SimulationTeam & { run_at: string; n_sims: number }>(
      `SELECT sr.team_id,
              t.name,
              t.short_name,
              t.crest_url,
              sr.points_now,
              sr.exp_points::float8  AS exp_points,
              sr.p_title::float8     AS p_title,
              sr.p_top4::float8      AS p_top4,
              sr.p_relegation::float8 AS p_relegation,
              sr.run_at,
              sr.n_sims
       FROM simulation_results sr
       JOIN teams t             ON t.id = sr.team_id
       JOIN competitions c      ON c.id = sr.competition_id
       WHERE c.code = $1 AND sr.season = $2
       ORDER BY sr.exp_points DESC;`,
      [competition, season]
    );

    if (result.rows.length === 0) {
      res.json({ run_at: null, n_sims: null, teams: [] } as SimulationResponse);
      return;
    }

    // run_at and n_sims are the same for every row in this competition+season batch
    const { run_at, n_sims } = result.rows[0];

    const teams: SimulationTeam[] = result.rows.map(({ run_at: _r, n_sims: _n, ...rest }) => rest);

    const response: SimulationResponse = { run_at, n_sims, teams };
    res.json(response);
  } catch (err) {
    if (err instanceof Error && !('code' in err)) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
