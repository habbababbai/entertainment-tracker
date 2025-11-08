import { config } from 'dotenv';
import { z } from 'zod';

config();

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').optional()
});

export const env = environmentSchema.parse(process.env);


