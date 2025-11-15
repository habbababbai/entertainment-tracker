interface JWTPayload {
    exp?: number;
    iat?: number;
    sub?: string;
    type?: string;
    version?: number;
}

function base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padding = base64.length % 4;
    if (padding) {
        base64 += "=".repeat(4 - padding);
    }
    return atob(base64);
}

export function decodeJWT(token: string): JWTPayload | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) {
            return null;
        }

        const payload = parts[1];
        const decoded = base64UrlDecode(payload);
        return JSON.parse(decoded) as JWTPayload;
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

export function isTokenExpiringSoon(token: string, bufferSeconds = 60): boolean {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) {
        return true;
    }

    const exp = payload.exp * 1000;
    const now = Date.now();
    const buffer = bufferSeconds * 1000;
    return exp - now <= buffer;
}

