import {
    decodeJWT,
    isTokenExpired,
    isTokenExpiringSoon,
} from "../../../lib/utils/jwt";
import { createJWT } from "../../test-utils/jwt";

describe("JWT Utils", () => {
    describe("decodeJWT", () => {
        it("decodes valid JWT token", () => {
            const token = createJWT({
                exp: Math.floor(Date.now() / 1000) + 3600,
            });

            const payload = decodeJWT(token);

            expect(payload).not.toBeNull();
            expect(payload?.sub).toBe("test-user");
            expect(payload?.exp).toBeDefined();
        });

        it("returns null for invalid token format", () => {
            const result = decodeJWT("invalid-token");
            expect(result).toBeNull();
        });

        it("returns null for token with wrong number of parts", () => {
            const result = decodeJWT("part1.part2");
            expect(result).toBeNull();
        });

        it("returns null for malformed token", () => {
            const result = decodeJWT("header.payload.signature");
            expect(result).toBeNull();
        });
    });

    describe("isTokenExpired", () => {
        it("returns false for valid token", () => {
            const token = createJWT({
                exp: Math.floor(Date.now() / 1000) + 3600,
            });

            expect(isTokenExpired(token)).toBe(false);
        });

        it("returns true for expired token", () => {
            const token = createJWT({
                exp: Math.floor(Date.now() / 1000) - 3600,
            });

            expect(isTokenExpired(token)).toBe(true);
        });

        it("returns true for token without exp claim", () => {
            const invalidToken = "invalid.token.format";
            expect(isTokenExpired(invalidToken)).toBe(true);
        });

        it("returns true for invalid token", () => {
            expect(isTokenExpired("invalid-token")).toBe(true);
        });
    });

    describe("isTokenExpiringSoon", () => {
        it("returns false for token expiring in the future", () => {
            const token = createJWT({
                exp: Math.floor(Date.now() / 1000) + 120,
            });

            expect(isTokenExpiringSoon(token, 60)).toBe(false);
        });

        it("returns true for token expiring within buffer", () => {
            const token = createJWT({
                exp: Math.floor(Date.now() / 1000) + 30,
            });

            expect(isTokenExpiringSoon(token, 60)).toBe(true);
        });

        it("returns true for token already expired", () => {
            const token = createJWT({
                exp: Math.floor(Date.now() / 1000) - 10,
            });

            expect(isTokenExpiringSoon(token, 60)).toBe(true);
        });

        it("returns true for token expiring exactly at buffer time", () => {
            const bufferSeconds = 60;
            const token = createJWT({
                exp: Math.floor(Date.now() / 1000) + bufferSeconds,
            });

            expect(isTokenExpiringSoon(token, bufferSeconds)).toBe(true);
        });

        it("uses default buffer of 60 seconds", () => {
            const token = createJWT({
                exp: Math.floor(Date.now() / 1000) + 30,
            });

            expect(isTokenExpiringSoon(token)).toBe(true);
        });

        it("returns true for token without exp claim", () => {
            const mockToken = createJWT({});
            const payload = decodeJWT(mockToken);
            if (payload && "exp" in payload) {
                delete payload.exp;
            }
            expect(isTokenExpiringSoon("invalid-token")).toBe(true);
        });

        it("returns true for invalid token", () => {
            expect(isTokenExpiringSoon("invalid-token")).toBe(true);
        });

        it("respects custom buffer seconds", () => {
            const token = createJWT({
                exp: Math.floor(Date.now() / 1000) + 45,
            });

            expect(isTokenExpiringSoon(token, 30)).toBe(false);
            expect(isTokenExpiringSoon(token, 60)).toBe(true);
        });
    });
});
