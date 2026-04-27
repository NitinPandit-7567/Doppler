import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'node:http';
import { pino } from 'pino';
import { authRouter } from './routes/auth';
import { inventoryRouter } from './routes/inventory';
import { marketRouter } from './routes/market';
import { authenticate } from './middleware/auth';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);

app.use('/api', authenticate);
app.use('/api/inventory', inventoryRouter);
app.use('/api/market', marketRouter);

const port = Number(process.env.PORT) || 4000;

httpServer.listen(port, () => {
  logger.info(`API server running on port ${port}`);
});

export { app, httpServer };
