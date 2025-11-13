import bcrypt from "bcryptjs";

import { env } from "../../env.js";

export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    return bcrypt.hash(password, salt);
}

export async function verifyPassword(
    password: string,
    hashed: string
): Promise<boolean> {
    return bcrypt.compare(password, hashed);
}



