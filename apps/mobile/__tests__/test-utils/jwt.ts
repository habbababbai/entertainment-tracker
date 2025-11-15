export function createJWT(payload: { exp?: number; iat?: number }): string {
    const header = { alg: "HS256", typ: "JWT" };
    const defaultPayload = {
        sub: "test-user",
        iat: Math.floor(Date.now() / 1000),
        ...payload,
    };

    const base64UrlEncode = (str: string): string => {
        if (typeof btoa !== "undefined") {
            return btoa(str)
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=/g, "");
        }
        const base64 = Buffer.from(str).toString("base64");
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(defaultPayload));
    const signature = "test-signature";

    return `${headerB64}.${payloadB64}.${signature}`;
}
