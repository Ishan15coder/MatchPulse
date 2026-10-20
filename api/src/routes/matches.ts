import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { competition, season, limit } = req.query;

  // Validate "competition" query parameter
  if (!competition || typeof competition !== 'string' || competition.trim() === '') {
    res.status(400).json({ error: 'Missing or invalid "competition" query parameter.' });
    return;
  }
  const competitionCode = competition.trim().toUpperCase();

  // Validate "season" query parameter
  if (!season || typeof season !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "season" query parameter.' });
    return;
  }
  const seasonNum = Number(season);
  if (!Number.isInteger(seasonNum) || seasonNum < 1900 || seasonNum > 2100) {
    res.status(400).json({ error: 'Parameter "season" must be a valid four-digit year.' });
    return;
  }

  // Validate and cap "limit" query parameter
  let limitNum = 50;
  if (limit !== undefined) {
    if (typeof limit !== 'string') {
      res.status(400).json({ error: 'Invalid "limit" query parameter.' });
      return;
    }
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      res.status(400).json({ error: 'Parameter "limit" must be a positive integer.' });
      return;
    }
    limitNum = Math.min(parsedLimit, 200);
  }

  const query = `
    SELECT
      m.id,
      m.external_id,
      m.season,
      m.matchday,
      m.stage,
      m.kickoff_utc,
      m.status,
      m.home_goals,
      m.away_goals,
      m.last_updated,
      c.code AS competition_code,
      c.name AS competition_name,
      ht.id AS home_team_id,
      ht.name AS home_team_name,
      ht.short_name AS home_team_short_name,
      ht.crest_url AS home_team_crest_url,
      at.id AS away_team_id,
      at.name AS away_team_name,
      at.short_name AS away_team_short_name,
      at.crest_url AS away_team_crest_url
    FROM matches m
    JOIN competitions c ON m.competition_id = c.id
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE c.code = $1 AND m.season = $2
    ORDER BY m.kickoff_utc ASC
    LIMIT $3;
  `;

  try {
    const result = await pool.query(query, [competitionCode, seasonNum, limitNum]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve matches.' });
  }
});

export default router;
