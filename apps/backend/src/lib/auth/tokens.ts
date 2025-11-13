import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

import { env } from "../../env.js";

const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

export interface AuthTokenPayload {
    sub: string;
    tokenVersion: number;
    type: typeof ACCESS_TOKEN_TYPE | typeof REFRESH_TOKEN_TYPE;
    iat: number;
    exp: number;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface TokenSubject {
    id: string;
    tokenVersion: number;
}

export function signAccessToken(subject: TokenSubject): string {
    return signToken(
        {
            sub: subject.id,
            tokenVersion: subject.tokenVersion,
            type: ACCESS_TOKEN_TYPE,
        },
        env.JWT_ACCESS_SECRET,
        env.JWT_ACCESS_EXPIRES_IN
    );
}

export function signRefreshToken(subject: TokenSubject): string {
    return signToken(
        {
            sub: subject.id,
            tokenVersion: subject.tokenVersion,
            type: REFRESH_TOKEN_TYPE,
        },
        env.JWT_REFRESH_SECRET,
        env.JWT_REFRESH_EXPIRES_IN
    );
}

export function verifyAccessToken(token: string): AuthTokenPayload {
    return verifyToken(token, env.JWT_ACCESS_SECRET, ACCESS_TOKEN_TYPE);
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
    return verifyToken(token, env.JWT_REFRESH_SECRET, REFRESH_TOKEN_TYPE);
}

export function issueTokenPair(subject: TokenSubject): TokenPair {
    return {
        accessToken: signAccessToken(subject),
        refreshToken: signRefreshToken(subject),
    };
}

function verifyToken(
    token: string,
    secret: string,
    expectedType: typeof ACCESS_TOKEN_TYPE | typeof REFRESH_TOKEN_TYPE
): AuthTokenPayload {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded !== "object" || decoded === null) {
        throw new jwt.JsonWebTokenError("Invalid token payload");
    }

    const payload = decoded as AuthTokenPayload;

    if (payload.type !== expectedType) {
        throw new jwt.JsonWebTokenError("Unexpected token type");
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new jwt.JsonWebTokenError("Token subject missing or invalid");
    }

    if (
        typeof payload.tokenVersion !== "number" ||
        !Number.isInteger(payload.tokenVersion)
    ) {
        throw new jwt.JsonWebTokenError("Token version missing or invalid");
    }

    return payload;
}

function signToken(
    payload: Omit<AuthTokenPayload, "iat" | "exp">,
    secret: Secret,
    expiresIn: string
): string {
    const options: SignOptions = {
        expiresIn: expiresIn as SignOptions["expiresIn"],
    };

    return jwt.sign(payload, secret, options);
}
