export interface AuthUser {
    id: string;
    email: string;
    username: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
    user: AuthUser;
}

export interface RegisterRequest {
    email: string;
    username: string;
    password: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface ForgotPasswordResponse {
    message: string;
    resetToken?: string;
}

export interface ResetPasswordRequest {
    resetToken: string;
    newPassword: string;
}

export interface ResetPasswordResponse {
    success: boolean;
    message: string;
}
