import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { pino } from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors({ origin: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = Number(process.env.PORT) || 4000;

httpServer.listen(port, () => {
  logger.info(`API server running on port ${port}`);
});

export { app, httpServer };
