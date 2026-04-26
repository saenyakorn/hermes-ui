import pino from "pino";
import type { AppLogLevel } from "../types";

export function createLogger(logLevel: AppLogLevel) {
  return pino({ level: logLevel });
}

export type AppLogger = ReturnType<typeof createLogger>;
