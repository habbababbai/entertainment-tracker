import { jwtDecode } from "jwt-decode";

export interface JWTPayload {
    exp?: number;
    iat?: number;
    sub?: string;
    type?: string;
    version?: number;
}

export function decodeJWT(token: string): JWTPayload | null {
    try {
        return jwtDecode<JWTPayload>(token);
    } catch {
        return null;
    }
}

export function isTokenExpired(token: string): boolean {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) {
        return true;
    }

    const exp = payload.exp * 1000;
    const now = Date.now();
    return exp <= now;
}

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
