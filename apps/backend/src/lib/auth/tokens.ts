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

/**
 * Signs an access JWT token for a user.
 * Access tokens have a shorter expiration time (default: 15 minutes).
 *
 * @param subject - The token subject containing user ID and token version
 * @returns A signed JWT access token string
 *
 * @example
 * ```ts
 * const token = signAccessToken({ id: "user-123", tokenVersion: 0 });
 * ```
 */
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

/**
 * Signs a refresh JWT token for a user.
 * Refresh tokens have a longer expiration time (default: 7 days).
 *
 * @param subject - The token subject containing user ID and token version
 * @returns A signed JWT refresh token string
 *
 * @example
 * ```ts
 * const token = signRefreshToken({ id: "user-123", tokenVersion: 0 });
 * ```
 */
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

/**
 * Verifies and decodes an access JWT token.
 * Validates the token signature, expiration, and type.
 *
 * @param token - The JWT access token string to verify
 * @returns The decoded token payload
 * @throws {jwt.JsonWebTokenError} If the token is invalid, expired, or malformed
 * @throws {jwt.TokenExpiredError} If the token has expired
 *
 * @example
 * ```ts
 * try {
 *   const payload = verifyAccessToken(token);
 *   console.log(payload.sub); // User ID
 * } catch (error) {
 *   // Handle invalid token
 * }
 * ```
 */
export function verifyAccessToken(token: string): AuthTokenPayload {
    return verifyToken(token, env.JWT_ACCESS_SECRET, ACCESS_TOKEN_TYPE);
}

/**
 * Verifies and decodes a refresh JWT token.
 * Validates the token signature, expiration, and type.
 *
 * @param token - The JWT refresh token string to verify
 * @returns The decoded token payload
 * @throws {jwt.JsonWebTokenError} If the token is invalid, expired, or malformed
 * @throws {jwt.TokenExpiredError} If the token has expired
 *
 * @example
 * ```ts
 * try {
 *   const payload = verifyRefreshToken(token);
 *   // Use payload to issue new token pair
 * } catch (error) {
 *   // Handle invalid token
 * }
 * ```
 */
export function verifyRefreshToken(token: string): AuthTokenPayload {
    return verifyToken(token, env.JWT_REFRESH_SECRET, REFRESH_TOKEN_TYPE);
}

/**
 * Issues both an access token and a refresh token for a user.
 * Convenience function that calls both `signAccessToken` and `signRefreshToken`.
 *
 * @param subject - The token subject containing user ID and token version
 * @returns An object containing both access and refresh tokens
 *
 * @example
 * ```ts
 * const { accessToken, refreshToken } = issueTokenPair({
 *   id: "user-123",
 *   tokenVersion: 0
 * });
 * ```
 */
export function issueTokenPair(subject: TokenSubject): TokenPair {
    return {
        accessToken: signAccessToken(subject),
        refreshToken: signRefreshToken(subject),
    };
}

/**
 * Internal helper function to verify a JWT token.
 * Validates signature, expiration, type, and required payload fields.
 *
 * @param token - The JWT token string to verify
 * @param secret - The secret key used to sign the token
 * @param expectedType - The expected token type ("access" or "refresh")
 * @returns The decoded and validated token payload
 * @throws {jwt.JsonWebTokenError} If validation fails
 */
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

/**
 * Internal helper function to sign a JWT token.
 * Adds `iat` (issued at) and `exp` (expiration) claims automatically.
 *
 * @param payload - The token payload (without iat and exp, which are auto-added)
 * @param secret - The secret key to sign the token with
 * @param expiresIn - Token expiration time (e.g., "15m", "7d")
 * @returns A signed JWT token string
 */
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
