import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import competitionsRouter from './routes/competitions';
import matchesRouter from './routes/matches';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRouter);
app.use('/competitions', competitionsRouter);
app.use('/matches', matchesRouter);

const server = app.listen(PORT, () => {
  console.log(`MatchPulse API listening on port ${PORT}`);
});

export default app;
export { server };
