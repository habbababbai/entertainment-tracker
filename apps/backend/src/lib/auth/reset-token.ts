import crypto from "crypto";

/**
 * Generates a cryptographically secure random token for password reset.
 * Creates a 32-byte (256-bit) random token and returns it as a hexadecimal string.
 *
 * @returns A secure random token string (64 hexadecimal characters)
 *
 * @example
 * ```ts
 * const token = generateResetToken();
 * // Store token with expiration in database
 * ```
 */
export function generateResetToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Checks if a password reset token has expired.
 *
 * @param expiresAt - The expiration date of the token, or `null` if not set
 * @returns `true` if the token is expired or `expiresAt` is `null`, `false` otherwise
 *
 * @example
 * ```ts
 * if (isResetTokenExpired(user.passwordResetTokenExpiresAt)) {
 *   // Token has expired, reject the reset request
 * }
 * ```
 */
export function isResetTokenExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) {
        return true;
    }
    return new Date() > expiresAt;
}

/**
 * Creates an expiration date for a password reset token.
 * Calculates a future date based on the specified number of hours from now.
 *
 * @param hoursFromNow - Number of hours until expiration (default: 1 hour)
 * @returns A Date object representing the token expiration time
 *
 * @example
 * ```ts
 * const expiresAt = createResetTokenExpiration(2); // Token expires in 2 hours
 * ```
 */
export function createResetTokenExpiration(hoursFromNow = 1): Date {
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + hoursFromNow);
    return expiration;
}
