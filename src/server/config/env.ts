import 'dotenv/config';
import { z } from 'zod';
import type { AppEnv } from '../types';

const envSchema = z.object({
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.message}`);
  }

  return {
    adminUsername: result.data.ADMIN_USERNAME,
    adminPassword: result.data.ADMIN_PASSWORD,
    port: result.data.PORT,
  };
}
