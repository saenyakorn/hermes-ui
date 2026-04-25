import pino from 'pino';

export function createLogger() {
  return pino({ level: process.env.LOG_LEVEL ?? 'info' });
}

export type AppLogger = ReturnType<typeof createLogger>;
