import crypto from "crypto";

export function generateResetToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

export function isResetTokenExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) {
        return true;
    }
    return new Date() > expiresAt;
}

export function createResetTokenExpiration(hoursFromNow = 1): Date {
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + hoursFromNow);
    return expiration;
}
