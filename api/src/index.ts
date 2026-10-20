import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import competitionsRouter from './routes/competitions';
import matchesRouter from './routes/matches';
import teamsRouter from './routes/teams';
import standingsRouter from './routes/standings';
import formRouter from './routes/form';
import headToHeadRouter from './routes/headToHead';
import congestionRouter from './routes/congestion';
import simulationRouter from './routes/simulation';
import coverageRouter from './routes/coverage';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Existing routes (unchanged)
app.use('/health', healthRouter);
app.use('/competitions', competitionsRouter);
app.use('/matches', matchesRouter);

// New routes
app.use('/teams', teamsRouter);
app.use('/standings', standingsRouter);
app.use('/form', formRouter);
app.use('/head-to-head', headToHeadRouter);
app.use('/congestion', congestionRouter);
app.use('/simulation', simulationRouter);
app.use('/coverage', coverageRouter);

// Central error handler — must have 4 parameters for Express to treat it as an error handler.
// Logs the full error server-side; sends only a generic message to the client.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[MatchPulse error]', err);
  res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
});

const server = app.listen(PORT, () => {
  console.log(`MatchPulse API listening on port ${PORT}`);
});

export default app;
export { server };
