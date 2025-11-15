import { jwtDecode } from "jwt-decode";

export interface JWTPayload {
    exp?: number;
    iat?: number;
    sub?: string;
    type?: string;
    version?: number;
}

/**
 * Decodes a JWT token and returns its payload.
 *
 * @param token - The JWT token string to decode
 * @returns The decoded JWT payload, or `null` if the token is invalid or malformed
 *
 * @example
 * ```ts
 * const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
 * const payload = decodeJWT(token);
 * if (payload) {
 *   console.log(payload.sub); // User ID
 *   console.log(payload.exp); // Expiration timestamp
 * }
 * ```
 */
export function decodeJWT(token: string): JWTPayload | null {
    try {
        return jwtDecode<JWTPayload>(token);
    } catch {
        return null;
    }
}

/**
 * Checks if a JWT token has expired.
 *
 * @param token - The JWT token string to check
 * @returns `true` if the token is expired, invalid, or missing an expiration claim; `false` otherwise
 *
 * @example
 * ```ts
 * if (isTokenExpired(accessToken)) {
 *   // Token needs to be refreshed
 *   await refreshTokens(refreshToken);
 * }
 * ```
 */
export function isTokenExpired(token: string): boolean {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) {
        return true;
    }

    const exp = payload.exp * 1000;
    const now = Date.now();
    return exp <= now;
}

/**
 * Checks if a JWT token is expiring within a specified buffer time.
 * Useful for proactively refreshing tokens before they expire.
 *
 * @param token - The JWT token string to check
 * @param bufferSeconds - The number of seconds before expiration to consider as "expiring soon" (default: 60)
 * @returns `true` if the token expires within the buffer time, is invalid, or missing an expiration claim; `false` otherwise
 *
 * @example
 * ```ts
 * // Check if token expires in the next 2 minutes
 * if (isTokenExpiringSoon(accessToken, 120)) {
 *   // Proactively refresh the token
 *   await refreshTokens(refreshToken);
 * }
 * ```
 */
export function isTokenExpiringSoon(
    token: string,
    bufferSeconds = 60
): boolean {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) {
        return true;
    }

    const exp = payload.exp * 1000;
    const now = Date.now();
    const buffer = bufferSeconds * 1000;
    return exp - now <= buffer;
}
