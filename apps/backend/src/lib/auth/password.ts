import bcrypt from "bcryptjs";

import { env } from "../../env.js";

/**
 * Hashes a plain text password using bcrypt.
 * Uses the salt rounds specified in the environment configuration.
 *
 * @param password - The plain text password to hash
 * @returns A promise that resolves to the hashed password
 * @throws {Error} If the hashing process fails
 *
 * @example
 * ```ts
 * const hashedPassword = await hashPassword("mySecurePassword123");
 * // Store hashedPassword in database
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    return bcrypt.hash(password, salt);
}

/**
 * Verifies a plain text password against a hashed password.
 * Uses bcrypt's secure comparison to prevent timing attacks.
 *
 * @param password - The plain text password to verify
 * @param hashed - The hashed password to compare against
 * @returns A promise that resolves to `true` if passwords match, `false` otherwise
 *
 * @example
 * ```ts
 * const isValid = await verifyPassword("myPassword", storedHash);
 * if (isValid) {
 *   // User authenticated
 * }
 * ```
 */
export async function verifyPassword(
    password: string,
    hashed: string
): Promise<boolean> {
    return bcrypt.compare(password, hashed);
}
