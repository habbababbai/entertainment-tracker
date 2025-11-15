import { resolveApiBaseUrl } from "./media";
import { useAuthStore } from "./store/auth";
import type {
    AuthResponse,
    AuthUser,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
} from "./types";

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

export async function registerUser(
    request: RegisterRequest
): Promise<AuthResponse> {
    return postJson("/api/v1/auth/register", request, parseAuthResponse);
}

export async function loginUser(request: LoginRequest): Promise<AuthResponse> {
    return postJson("/api/v1/auth/login", request, parseAuthResponse);
}

export { refreshTokens } from "./api/refresh-tokens";

export async function logoutUser(refreshToken: string): Promise<void> {
    await postJson(
        "/api/v1/auth/logout",
        { refreshToken },
        (value: unknown) => {
            if (!isObject(value) || typeof value.success !== "boolean") {
                throw new Error("Logout response missing success flag");
            }

            if (!value.success) {
                throw new Error("Logout failed");
            }
        }
    );
}

export async function resetPasswordForLoggedInUser(
    newPassword: string
): Promise<ResetPasswordResponse> {
    const user = useAuthStore.getState().user;

    if (!user) {
        throw new Error("User must be logged in to reset password");
    }

    const forgotPasswordResponse = await postJson<
        ForgotPasswordResponse
    >(
        "/api/v1/auth/forgot-password",
        { email: user.email } as ForgotPasswordRequest,
        parseForgotPasswordResponse
    );

    if (!forgotPasswordResponse.resetToken) {
        throw new Error(
            "Failed to generate reset token. Please try again."
        );
    }

    return postJson<ResetPasswordResponse>(
        "/api/v1/auth/reset-password",
        {
            resetToken: forgotPasswordResponse.resetToken,
            newPassword,
        } as ResetPasswordRequest,
        parseResetPasswordResponse
    );
}

function parseAuthResponse(value: unknown): AuthResponse {
    if (!isObject(value)) {
        throw new Error("Auth response is not an object");
    }

    const { user, accessToken, refreshToken } = value;

    if (!isObject(user)) {
        throw new Error("User payload is missing");
    }

    const authUser: AuthUser = {
        id: expectString(user.id, "user.id"),
        email: expectString(user.email, "user.email"),
        username: expectString(user.username, "user.username"),
        createdAt: expectString(user.createdAt, "user.createdAt"),
        updatedAt: expectString(user.updatedAt, "user.updatedAt"),
    };

    return {
        user: authUser,
        accessToken: expectString(accessToken, "accessToken"),
        refreshToken: expectString(refreshToken, "refreshToken"),
    };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function expectString(value: unknown, label: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }

    return value;
}

function parseForgotPasswordResponse(value: unknown): ForgotPasswordResponse {
    if (!isObject(value)) {
        throw new Error("Forgot password response is not an object");
    }

    const message = expectString(value.message, "message");
    const resetToken =
        "resetToken" in value && typeof value.resetToken === "string"
            ? value.resetToken
            : undefined;

    return {
        message,
        resetToken,
    };
}

function parseResetPasswordResponse(value: unknown): ResetPasswordResponse {
    if (!isObject(value)) {
        throw new Error("Reset password response is not an object");
    }

    if (typeof value.success !== "boolean") {
        throw new Error("Reset password response missing success flag");
    }

    const message = expectString(value.message, "message");

    return {
        success: value.success,
        message,
    };
}

export const __testUtils = {
    postJsonForTests: postJson,
};
