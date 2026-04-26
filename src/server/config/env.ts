import "dotenv/config";
import { z } from "zod";
import type { AppEnv } from "../types";

const logLevels = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

const envSchema = z.object({
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  LOG_LEVEL: z.enum(logLevels).default("info"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
});

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.message}`);
  }

  return {
    adminUsername: result.data.ADMIN_USERNAME,
    adminPassword: result.data.ADMIN_PASSWORD,
    logLevel: result.data.LOG_LEVEL,
    port: result.data.PORT,
  };
}
