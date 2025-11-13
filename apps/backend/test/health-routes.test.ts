import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import { healthRoutes } from "../src/routes/v1/health.js";

describe("healthRoutes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-01T12:00:00.000Z"));

        app = Fastify({ logger: false });
        await app.register(healthRoutes);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        vi.useRealTimers();
    });

    it("returns ok status with ISO timestamp", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/health",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            status: string;
            timestamp: string;
        };

        expect(payload.status).toBe("ok");
        expect(payload.timestamp).toBe("2024-01-01T12:00:00.000Z");
    });

    it("reflects current time for subsequent requests", async () => {
        const firstResponse = await app.inject({
            method: "GET",
            url: "/health",
        });
        expect(firstResponse.statusCode).toBe(200);

        vi.setSystemTime(new Date("2024-01-01T12:05:00.000Z"));

        const secondResponse = await app.inject({
            method: "GET",
            url: "/health",
        });
        expect(secondResponse.statusCode).toBe(200);

        const payload = secondResponse.json() as {
            status: string;
            timestamp: string;
        };

        expect(payload.status).toBe("ok");
        expect(payload.timestamp).toBe("2024-01-01T12:05:00.000Z");
    });
});
