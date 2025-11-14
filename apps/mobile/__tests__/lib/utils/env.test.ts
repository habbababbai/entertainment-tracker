describe("env utils", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        jest.resetModules();
        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = originalNodeEnv;
        }
    });

    it("returns true when jest is defined (always true in test environment)", () => {
        jest.resetModules();
        const { isTestEnv } = require("../../../lib/utils/env");
        expect(isTestEnv).toBe(true);
    });

    it("returns true when NODE_ENV is 'test'", () => {
        process.env.NODE_ENV = "test";
        jest.resetModules();

        const { isTestEnv } = require("../../../lib/utils/env");
        expect(isTestEnv).toBe(true);
    });

    it("returns true when jest is defined even if NODE_ENV is not 'test'", () => {
        process.env.NODE_ENV = "production";
        jest.resetModules();

        const { isTestEnv } = require("../../../lib/utils/env");
        expect(isTestEnv).toBe(true);
    });

    it("returns true when NODE_ENV is 'test' even if jest is not explicitly set", () => {
        process.env.NODE_ENV = "test";
        jest.resetModules();

        const { isTestEnv } = require("../../../lib/utils/env");
        expect(isTestEnv).toBe(true);
    });
});
