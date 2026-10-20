import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { parseTeamId } from '../validate';

const router = Router();

interface H2HSummary {
  meetings: number;
  a_wins: number;
  draws: number;
  b_wins: number;
  a_goals: number;
  b_goals: number;
}

interface H2HMatch {
  kickoff_utc: string;
  competition_code: string;
  season: number;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
}

interface H2HResponse {
  summary: H2HSummary;
  matches: H2HMatch[];
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamA = parseTeamId(req.query.team_a, 'team_a');
    const teamB = parseTeamId(req.query.team_b, 'team_b');

    if (teamA === teamB) {
      res.status(400).json({ error: 'Parameters "team_a" and "team_b" must be different team ids.' });
      return;
    }

    // Summary query — ports the SELECT … FROM meetings block of head_to_head.sql
    const summaryResult = await pool.query<H2HSummary>(
      `WITH meetings AS (
         SELECT m.home_team_id, m.away_team_id, m.home_goals, m.away_goals
         FROM matches m
         WHERE m.status = 'FINISHED'
           AND (
                (m.home_team_id = $1 AND m.away_team_id = $2)
             OR (m.home_team_id = $2 AND m.away_team_id = $1)
           )
       )
       SELECT
         count(*)::int                                                                        AS meetings,
         count(*) FILTER (WHERE (home_team_id = $1 AND home_goals > away_goals)
                             OR (away_team_id = $1 AND away_goals > home_goals))::int         AS a_wins,
         count(*) FILTER (WHERE home_goals = away_goals)::int                                 AS draws,
         count(*) FILTER (WHERE (home_team_id = $2 AND home_goals > away_goals)
                             OR (away_team_id = $2 AND away_goals > home_goals))::int         AS b_wins,
         coalesce(sum(CASE WHEN home_team_id = $1 THEN home_goals ELSE away_goals END)::int, 0) AS a_goals,
         coalesce(sum(CASE WHEN home_team_id = $2 THEN home_goals ELSE away_goals END)::int, 0) AS b_goals
       FROM meetings;`,
      [teamA, teamB]
    );

    // Detail query — finished meetings, newest first
    const matchesResult = await pool.query<H2HMatch>(
      `SELECT m.kickoff_utc,
              c.code  AS competition_code,
              m.season,
              ht.name AS home_team,
              at.name AS away_team,
              m.home_goals,
              m.away_goals
       FROM matches m
       JOIN competitions c  ON c.id  = m.competition_id
       JOIN teams ht        ON ht.id = m.home_team_id
       JOIN teams at        ON at.id = m.away_team_id
       WHERE m.status = 'FINISHED'
         AND (
              (m.home_team_id = $1 AND m.away_team_id = $2)
           OR (m.home_team_id = $2 AND m.away_team_id = $1)
         )
       ORDER BY m.kickoff_utc DESC;`,
      [teamA, teamB]
    );

    const response: H2HResponse = {
      summary: summaryResult.rows[0],
      matches: matchesResult.rows,
    };

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
