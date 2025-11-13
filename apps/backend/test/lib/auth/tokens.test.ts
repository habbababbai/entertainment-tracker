import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import {
    issueTokenPair,
    type TokenSubject,
    verifyAccessToken,
    verifyRefreshToken,
} from "../../../src/lib/auth/tokens.js";

const SUBJECT: TokenSubject = {
    id: "user-id",
    tokenVersion: 2,
};

describe("auth tokens helpers", () => {
    it("issues token pair that validates", () => {
        const tokens = issueTokenPair(SUBJECT);

        const accessPayload = verifyAccessToken(tokens.accessToken);
        const refreshPayload = verifyRefreshToken(tokens.refreshToken);

        expect(accessPayload.sub).toBe(SUBJECT.id);
        expect(refreshPayload.tokenVersion).toBe(SUBJECT.tokenVersion);
    });

    it("throws when payload is not an object", () => {
        const malformed = jwt.sign(
            "not-an-object",
            process.env.JWT_ACCESS_SECRET!
        );

        expect(() => verifyAccessToken(malformed)).toThrowError(
            /Invalid token payload/
        );
    });

    it("throws when token type mismatches expected type", () => {
        const refreshAsAccess = jwt.sign(
            {
                sub: SUBJECT.id,
                tokenVersion: SUBJECT.tokenVersion,
                type: "access",
            },
            process.env.JWT_REFRESH_SECRET!
        );

        expect(() => verifyRefreshToken(refreshAsAccess)).toThrowError(
            /Unexpected token type/
        );
    });

    it("throws when token subject is missing", () => {
        const token = jwt.sign(
            {
                type: "access",
                tokenVersion: 0,
            },
            process.env.JWT_ACCESS_SECRET!
        );

        expect(() => verifyAccessToken(token)).toThrowError(
            /Token subject missing or invalid/
        );
    });

    it("throws when token version is not an integer", () => {
        const token = jwt.sign(
            {
                sub: SUBJECT.id,
                type: "access",
                tokenVersion: "bad-version",
            },
            process.env.JWT_ACCESS_SECRET!
        );

        expect(() => verifyAccessToken(token)).toThrowError(
            /Token version missing or invalid/
        );
    });
});
