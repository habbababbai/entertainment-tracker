import { resolveApiBaseUrl } from "../media";
import type { AuthResponse } from "../types";

const API_BASE_URL = resolveApiBaseUrl();

/**
 * Makes a POST request to the API and parses the JSON response.
 *
 * @param path - The API endpoint path (relative to base URL)
 * @param body - The request body to send (will be JSON stringified)
 * @param parser - A function to parse and validate the response payload
 * @returns A promise that resolves to the parsed response
 * @throws {Error} If the request fails, response is not JSON, or parsing fails
 *
 * @example
 * ```ts
 * const response = await postJson(
 *   "/api/v1/auth/refresh",
 *   { refreshToken: "..." },
 *   parseAuthResponse
 * );
 * ```
 */
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

/**
 * Parses and validates an authentication response from the API.
 *
 * @param value - The raw response value to parse
 * @returns A validated AuthResponse object containing user and tokens
 * @throws {Error} If the response structure is invalid or required fields are missing
 */
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

/**
 * Validates that a value is a non-empty string.
 *
 * @param value - The value to validate
 * @param label - A label for the value (used in error messages)
 * @returns The validated string value
 * @throws {Error} If the value is not a non-empty string
 */
function expectString(value: unknown, label: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }

    return value;
}

/**
 * Refreshes an authentication token pair using a refresh token.
 * This function exchanges a valid refresh token for new access and refresh tokens.
 *
 * @param refreshToken - The refresh token to use for obtaining new tokens
 * @returns A promise that resolves to an AuthResponse containing:
 *   - `user`: The authenticated user object
 *   - `accessToken`: A new access token
 *   - `refreshToken`: A new refresh token
 * @throws {Error} If the refresh token is invalid, expired, or the request fails
 *
 * @example
 * ```ts
 * try {
 *   const { accessToken, refreshToken, user } = await refreshTokens(oldRefreshToken);
 *   // Store new tokens and update user state
 * } catch (error) {
 *   // Handle refresh failure (e.g., redirect to login)
 * }
 * ```
 */
export async function refreshTokens(
    refreshToken: string
): Promise<AuthResponse> {
    return postJson(
        "/api/v1/auth/refresh",
        { refreshToken },
        parseAuthResponse
    );
}
