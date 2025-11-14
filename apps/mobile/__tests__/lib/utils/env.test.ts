/* eslint-disable @typescript-eslint/no-require-imports */
describe("env utils", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        jest.resetModules();
        Object.defineProperty(process, "env", {
            value: {
                ...process.env,
                ...(originalNodeEnv !== undefined && {
                    NODE_ENV: originalNodeEnv,
                }),
            },
            writable: true,
            configurable: true,
        });
    });

    it("returns true when jest is defined (always true in test environment)", () => {
        jest.resetModules();
        const { isTestEnv } = require("../../../lib/utils/env");
        expect(isTestEnv).toBe(true);
    });

    it("returns true when NODE_ENV is 'test'", () => {
        Object.defineProperty(process, "env", {
            value: { ...process.env, NODE_ENV: "test" },
            writable: true,
            configurable: true,
        });
        jest.resetModules();

        const { isTestEnv } = require("../../../lib/utils/env");
        expect(isTestEnv).toBe(true);
    });

    it("returns true when jest is defined even if NODE_ENV is not 'test'", () => {
        Object.defineProperty(process, "env", {
            value: { ...process.env, NODE_ENV: "production" },
            writable: true,
            configurable: true,
        });
        jest.resetModules();

        const { isTestEnv } = require("../../../lib/utils/env");
        expect(isTestEnv).toBe(true);
    });

    it("returns true when NODE_ENV is 'test' even if jest is not explicitly set", () => {
        Object.defineProperty(process, "env", {
            value: { ...process.env, NODE_ENV: "test" },
            writable: true,
            configurable: true,
        });
        jest.resetModules();

        const { isTestEnv } = require("../../../lib/utils/env");
        expect(isTestEnv).toBe(true);
    });
});
