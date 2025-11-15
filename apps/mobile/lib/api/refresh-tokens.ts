import { resolveApiBaseUrl } from "../media";
import type { AuthResponse } from "../types";

const API_BASE_URL = resolveApiBaseUrl();

async function postJson<T>(
    path: string,
    body: unknown,
    parser: (value: unknown) => T
): Promise<T> {
    const url = new URL(path, API_BASE_URL);

    const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        let message: string | undefined;
        try {
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("application/json")) {
                const errorData = await response.json();
                if (
                    typeof errorData === "object" &&
                    errorData !== null &&
                    "message" in errorData &&
                    typeof errorData.message === "string"
                ) {
                    message = errorData.message;
                } else if (
                    typeof errorData === "object" &&
                    errorData !== null &&
                    "error" in errorData &&
                    typeof errorData.error === "string"
                ) {
                    message = errorData.error;
                }
            } else {
                const text = await response.text();
                message = text.trim() || undefined;
            }
        } catch {
            message = undefined;
        }

        throw new Error(
            message || `Request failed with status ${response.status}`
        );
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        throw new Error("Response payload is not valid JSON.");
    }

    try {
        return parser(payload);
    } catch (error) {
        const detailSource =
            (error as { message?: unknown } | null | undefined)?.message ??
            error ??
            "Unknown parser error";

        throw new Error(`Malformed auth response: ${String(detailSource)}`);
    }
}

function parseAuthResponse(value: unknown): AuthResponse {
    if (typeof value !== "object" || value === null) {
        throw new Error("Auth response is not an object");
    }

    const { user, accessToken, refreshToken } = value as Record<
        string,
        unknown
    >;

    if (typeof user !== "object" || user === null) {
        throw new Error("User payload is missing");
    }

    const userObj = user as Record<string, unknown>;

    const authUser = {
        id: expectString(userObj.id, "user.id"),
        email: expectString(userObj.email, "user.email"),
        username: expectString(userObj.username, "user.username"),
        createdAt: expectString(userObj.createdAt, "user.createdAt"),
        updatedAt: expectString(userObj.updatedAt, "user.updatedAt"),
    };

    return {
        user: authUser,
        accessToken: expectString(accessToken, "accessToken"),
        refreshToken: expectString(refreshToken, "refreshToken"),
    };
}

function expectString(value: unknown, label: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }

    return value;
}

export async function refreshTokens(
    refreshToken: string
): Promise<AuthResponse> {
    return postJson(
        "/api/v1/auth/refresh",
        { refreshToken },
        parseAuthResponse
    );
}
