import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';

const router = Router();

interface CoverageRow {
  competition_code: string;
  competition_name: string;
  season: number;
  match_count: number;
  finished_count: number;
  earliest_kickoff: string | null;
  latest_kickoff: string | null;
  last_ingested: string | null;
}

interface CoverageResponse {
  coverage: CoverageRow[];
  limitations: string[];
}

const LIMITATIONS: string[] = [
  'Data covers La Liga, Serie A and the Champions League, seasons 2023-2026, from football-data.org (free tier).',
  'Domestic cups, Europa League and Conference League are not included, so congestion is understated.',
  'Head-to-head counts league and Champions League meetings since 2023 only.',
  'Simulation is a Poisson goal model: it ignores injuries and transfers, treats team ratings as certain, and gives estimates, not predictions or advice.',
];

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<CoverageRow>(
      `SELECT c.code                  AS competition_code,
              c.name                  AS competition_name,
              m.season,
              count(*)::int           AS match_count,
              count(*) FILTER (WHERE m.status = 'FINISHED')::int AS finished_count,
              min(m.kickoff_utc)      AS earliest_kickoff,
              max(m.kickoff_utc)      AS latest_kickoff,
              max(m.last_updated)     AS last_ingested
       FROM matches m
       JOIN competitions c ON c.id = m.competition_id
       GROUP BY c.code, c.name, m.season
       ORDER BY c.code, m.season;`
    );

    const response: CoverageResponse = {
      coverage: result.rows,
      limitations: LIMITATIONS,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
