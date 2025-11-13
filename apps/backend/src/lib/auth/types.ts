export interface AuthenticatedUser {
    id: string;
    tokenVersion: number;
}

export interface SerializedUser {
    id: string;
    email: string;
    username: string;
    createdAt: string;
    updatedAt: string;
}



