import { pino } from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

logger.info('Worker process started — BullMQ jobs will be registered in Phase 2');
