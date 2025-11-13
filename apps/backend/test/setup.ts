process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/test";
process.env.OMDB_API_KEY = process.env.OMDB_API_KEY ?? "test-api-key";
