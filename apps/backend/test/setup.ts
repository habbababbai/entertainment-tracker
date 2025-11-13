import { afterAll, afterEach, beforeAll } from "vitest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/test";
process.env.OMDB_API_KEY = process.env.OMDB_API_KEY ?? "test-api-key";
process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? "test-access-secret";
process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS ?? "4";

const originalEnv = { ...process.env };

beforeAll(() => {});

afterEach(() => {
    resetEnv();
});

afterAll(() => {
    resetEnv();
});

function resetEnv() {
    process.env = { ...originalEnv };
}
