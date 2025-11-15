import { createJWT } from "./jwt";

describe("createJWT test utility", () => {
    it("creates valid JWT token with exp", () => {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = createJWT({ exp });

        expect(token).toMatch(
            /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
        );
        expect(token.split(".")).toHaveLength(3);
    });

    it("creates valid JWT token with iat", () => {
        const iat = Math.floor(Date.now() / 1000);
        const token = createJWT({ iat });

        expect(token).toMatch(
            /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
        );
        expect(token.split(".")).toHaveLength(3);
    });

    it("creates valid JWT token with both exp and iat", () => {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const iat = Math.floor(Date.now() / 1000) - 3600;
        const token = createJWT({ exp, iat });

        expect(token).toMatch(
            /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
        );
        expect(token.split(".")).toHaveLength(3);
    });

    it("creates valid JWT token without exp or iat", () => {
        const token = createJWT({});

        expect(token).toMatch(
            /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
        );
        expect(token.split(".")).toHaveLength(3);
    });

    it("uses Buffer fallback when btoa is not available", () => {
        const originalBtoa = globalThis.btoa;
        delete (globalThis as { btoa?: typeof btoa }).btoa;

        const token = createJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });

        expect(token).toMatch(
            /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
        );
        expect(token.split(".")).toHaveLength(3);

        globalThis.btoa = originalBtoa;
    });
});
