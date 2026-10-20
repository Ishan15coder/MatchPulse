import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, external_id, code, name FROM competitions ORDER BY id ASC;'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve competitions' });
  }
});

export default router;
