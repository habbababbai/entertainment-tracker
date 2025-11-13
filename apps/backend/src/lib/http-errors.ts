export class HttpError extends Error {
    readonly statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.name = this.constructor.name;
    }
}

export function unauthorized(message = "Unauthorized"): HttpError {
    return new HttpError(401, message);
}

export function conflict(message = "Conflict"): HttpError {
    return new HttpError(409, message);
}


