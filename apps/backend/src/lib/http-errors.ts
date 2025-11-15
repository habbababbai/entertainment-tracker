/**
 * Custom HTTP error class that extends the standard Error class.
 * Includes an HTTP status code for proper error handling in route handlers.
 */
export class HttpError extends Error {
    readonly statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.name = this.constructor.name;
    }
}

/**
 * Creates an HTTP 401 Unauthorized error.
 *
 * @param message - Error message (default: "Unauthorized")
 * @returns An HttpError instance with status code 401
 *
 * @example
 * ```ts
 * throw unauthorized("Invalid credentials");
 * ```
 */
export function unauthorized(message = "Unauthorized"): HttpError {
    return new HttpError(401, message);
}

/**
 * Creates an HTTP 409 Conflict error.
 * Typically used when a request conflicts with the current state of the resource.
 *
 * @param message - Error message (default: "Conflict")
 * @returns An HttpError instance with status code 409
 *
 * @example
 * ```ts
 * throw conflict("Email already exists");
 * ```
 */
export function conflict(message = "Conflict"): HttpError {
    return new HttpError(409, message);
}

/**
 * Creates an HTTP 404 Not Found error.
 * Used when a requested resource does not exist.
 *
 * @param message - Error message (default: "Not Found")
 * @returns An HttpError instance with status code 404
 *
 * @example
 * ```ts
 * throw notFound("User not found");
 * ```
 */
export function notFound(message = "Not Found"): HttpError {
    return new HttpError(404, message);
}

/**
 * Creates an HTTP 400 Bad Request error.
 * Used when the client's request is malformed or invalid.
 *
 * @param message - Error message (default: "Bad Request")
 * @returns An HttpError instance with status code 400
 *
 * @example
 * ```ts
 * throw badRequest("Invalid email format");
 * ```
 */
export function badRequest(message = "Bad Request"): HttpError {
    return new HttpError(400, message);
}
