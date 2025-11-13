import { config } from "dotenv";
import { z } from "zod";

config();

const environmentSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    OMDB_API_KEY: z.string().min(1, "OMDB_API_KEY is required"),
    JWT_ACCESS_SECRET: z
        .string()
        .min(1, "JWT_ACCESS_SECRET is required for signing access tokens"),
    JWT_REFRESH_SECRET: z
        .string()
        .min(1, "JWT_REFRESH_SECRET is required for signing refresh tokens"),
    JWT_ACCESS_EXPIRES_IN: z
        .string()
        .default("15m"),
    JWT_REFRESH_EXPIRES_IN: z
        .string()
        .default("7d"),
    BCRYPT_SALT_ROUNDS: z
        .coerce.number()
        .int()
        .min(4)
        .max(15)
        .default(12),
});

export const env = environmentSchema.parse(process.env);
