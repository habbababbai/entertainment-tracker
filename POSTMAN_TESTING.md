# Postman Testing Guide

This guide shows how to test all API endpoints in Postman, including authentication, media search, and watchlist management.

## Table of Contents

1. [Base URL](#base-url)
2. [How JWT Authentication Works](#how-jwt-authentication-works)
3. [Health Check](#health-check)
4. [Authentication Endpoints](#authentication-endpoints)
5. [Media Endpoints](#media-endpoints)
6. [Watchlist Endpoints](#watchlist-endpoints)
7. [Postman Collection Setup](#postman-collection-setup)
8. [Complete Testing Flow](#complete-testing-flow)

---

## Base URL

-   **Local**: `http://localhost:3000/api/v1`

---

## How JWT Authentication Works

This project uses a **dual-token JWT system** with access tokens and refresh tokens for secure authentication.

### Token Types

1. **Access Token**:
    - Short-lived token (default: 15 minutes)
    - Used for authenticating API requests
    - Sent in the `Authorization: Bearer <token>` header
    - Contains: user ID (`sub`), `tokenVersion`, type (`access`), `iat`, `exp`

2. **Refresh Token**:
    - Long-lived token (default: 7 days)
    - Used to obtain new access/refresh token pairs
    - Sent in request body (not headers) when refreshing tokens
    - Contains: user ID (`sub`), `tokenVersion`, type (`refresh`), `iat`, `exp`

### Token Versioning System

Each user has a `tokenVersion` field in the database that increments when:
- User logs out (invalidates all existing tokens)
- User resets their password
- User's account is deleted

**How it works:**
- When tokens are issued, they include the current `tokenVersion`
- When verifying tokens, the server checks if the token's `tokenVersion` matches the user's current `tokenVersion`
- If they don't match, the token is invalid (user has logged out or reset password)

### Token Flow

1. **Login/Register**: User receives both `accessToken` and `refreshToken`
2. **API Requests**: Use `accessToken` in `Authorization: Bearer <accessToken>` header
3. **Token Expiry**: When `accessToken` expires (after ~15 minutes), use `refreshToken` to get new tokens
4. **Refresh**: Send `refreshToken` to `/auth/refresh` endpoint to get a new token pair
5. **Logout**: Send `refreshToken` to `/auth/logout` to invalidate all tokens (increments `tokenVersion`)

### Token Structure

Both tokens are JWTs with the following payload structure:

```json
{
    "sub": "user-uuid",
    "tokenVersion": 0,
    "type": "access" | "refresh",
    "iat": 1234567890,
    "exp": 1234567890
}
```

- `sub` (subject): User ID
- `tokenVersion`: Version number to track token validity
- `type`: Either "access" or "refresh"
- `iat` (issued at): Unix timestamp when token was created
- `exp` (expires): Unix timestamp when token expires

### Security Features

- **Separate Secrets**: Access and refresh tokens use different secrets (`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`)
- **Token Type Validation**: Server validates that access tokens are used for API calls and refresh tokens are used for refreshing
- **Token Version Validation**: Ensures tokens are invalidated after logout or password reset
- **Short Access Token Lifetime**: Limits exposure if an access token is compromised
- **Secure Refresh Flow**: Refresh tokens can only be used to get new token pairs, not directly for API access

---

## Health Check

### GET /health

Check if the API is running.

#### Request

-   **Method**: `GET`
-   **URL**: `http://localhost:3000/api/v1/health`
-   **Headers**: None required

#### Expected Response (200 OK)

```json
{
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Authentication Endpoints

### 1. Register User

**POST /api/v1/auth/register**

Create a new user account.

#### Request

-   **Method**: `POST`
-   **URL**: `http://localhost:3000/api/v1/auth/register`
-   **Headers**:
    ```
    Content-Type: application/json
    ```
-   **Body** (raw JSON):
    ```json
    {
        "email": "user@example.com",
        "password": "Password123!",
        "username": "username"
    }
    ```

**Validation:**
- Email must be valid email format
- Password must be at least 8 characters
- Username must be 3-32 characters
- Email and username must be unique

#### Expected Response (201 Created)

```json
{
    "user": {
        "id": "user-uuid",
        "email": "user@example.com",
        "username": "username",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Error Cases

**Email/Username Already Exists (409 Conflict)**:
```json
{
    "statusCode": 409,
    "error": "Conflict",
    "message": "Email or username is already in use"
}
```

---

### 2. Login

**POST /api/v1/auth/login**

Authenticate with existing credentials.

#### Request

-   **Method**: `POST`
-   **URL**: `http://localhost:3000/api/v1/auth/login`
-   **Headers**:
    ```
    Content-Type: application/json
    ```
-   **Body** (raw JSON):
    ```json
    {
        "email": "user@example.com",
        "password": "Password123!"
    }
    ```

#### Expected Response (200 OK)

Same structure as register response with `accessToken` and `refreshToken`.

#### Error Cases

**Invalid Credentials (401 Unauthorized)**:
```json
{
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Invalid credentials"
}
```

---

### 3. Refresh Tokens

**POST /api/v1/auth/refresh**

Get a new access/refresh token pair using your refresh token.

#### Request

-   **Method**: `POST`
-   **URL**: `http://localhost:3000/api/v1/auth/refresh`
-   **Headers**:
    ```
    Content-Type: application/json
    ```
-   **Body** (raw JSON):
    ```json
    {
        "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```

#### Expected Response (200 OK)

Same structure as login/register response with new `accessToken` and `refreshToken`.

**Important:** Always use the new tokens from this response. Old tokens are not invalidated until logout.

#### Error Cases

**Invalid/Expired Refresh Token (401 Unauthorized)**:
```json
{
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Invalid or expired refresh token"
}
```

**Token Version Mismatch (401 Unauthorized)**:
Occurs if user has logged out or reset password (tokenVersion incremented).

---

### 4. Logout

**POST /api/v1/auth/logout**

Invalidate all tokens for the user by incrementing `tokenVersion`.

#### Request

-   **Method**: `POST`
-   **URL**: `http://localhost:3000/api/v1/auth/logout`
-   **Headers**:
    ```
    Content-Type: application/json
    ```
-   **Body** (raw JSON):
    ```json
    {
        "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```

#### Expected Response (200 OK)

```json
{
    "success": true
}
```

After logout, all existing access and refresh tokens become invalid.

---

### 5. Forgot Password

**POST /api/v1/auth/forgot-password**

Request a password reset token (for testing/development).

#### Request

-   **Method**: `POST`
-   **URL**: `http://localhost:3000/api/v1/auth/forgot-password`
-   **Headers**:
    ```
    Content-Type: application/json
    ```
-   **Body** (raw JSON):
    ```json
    {
        "email": "user@example.com"
    }
    ```

#### Expected Response (200 OK)

```json
{
    "message": "If an account with that email exists, a password reset token has been generated.",
    "resetToken": "test-reset-token-123"
}
```

**Note**: In production, the `resetToken` will not be returned in the response. It's only included for development/testing purposes.

---

### 6. Reset Password

**POST /api/v1/auth/reset-password**

Reset password using reset token.

#### Prerequisites

-   You need a valid `resetToken` from the forgot-password endpoint

#### Request

-   **Method**: `POST`
-   **URL**: `http://localhost:3000/api/v1/auth/reset-password`
-   **Headers**:
    ```
    Content-Type: application/json
    ```
-   **Body** (raw JSON):
    ```json
    {
        "resetToken": "test-reset-token-123",
        "newPassword": "NewPassword123!"
    }
    ```

**Validation:**
- New password must be at least 8 characters
- Reset token must be valid and not expired

#### Expected Response (200 OK)

```json
{
    "success": true,
    "message": "Password has been reset successfully"
}
```

**Important:** After password reset, all existing tokens are invalidated (`tokenVersion` is incremented). User must login again.

#### Error Cases

**Invalid Token (404 Not Found)**:
```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Invalid or expired reset token"
}
```

**Expired Token (400 Bad Request)**:
```json
{
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Reset token has expired"
}
```

---

### 7. Delete Account

**DELETE /api/v1/auth/account**

Permanently delete user account.

#### Prerequisites

-   Valid access token (from login or register)
-   User's password and email for verification

#### Request

-   **Method**: `DELETE`
-   **URL**: `http://localhost:3000/api/v1/auth/account`
-   **Headers**:
    ```
    Content-Type: application/json
    Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
    ```
-   **Body** (raw JSON):
    ```json
    {
        "password": "Password123!",
        "email": "user@example.com"
    }
    ```

#### Expected Response (200 OK)

```json
{
    "success": true,
    "message": "Account has been deleted successfully"
}
```

#### Error Cases

**Missing/Invalid Token (401 Unauthorized)**:
```json
{
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Missing or invalid Authorization header"
}
```

**Invalid Password (401 Unauthorized)**:
```json
{
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Invalid password"
}
```

**Email Mismatch (401 Unauthorized)**:
```json
{
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Email does not match"
}
```

---

## Media Endpoints

### 1. Search Media

**GET /api/v1/media**

Search for media items using OMDb API.

#### Request

-   **Method**: `GET`
-   **URL**: `http://localhost:3000/api/v1/media?query=inception&limit=10&page=1`
-   **Query Parameters**:
    - `query` (required): Search term (min 1 character)
    - `limit` (optional): Number of results per page (1-15, default: 15)
    - `page` (optional): Page number (min 1, default: 1)
-   **Headers**: None required (public endpoint)

#### Expected Response (200 OK)

```json
{
    "items": [
        {
            "id": "media-uuid",
            "externalId": "tt1375666",
            "source": "omdb",
            "title": "Inception",
            "description": "A skilled thief...",
            "posterUrl": "https://example.com/poster.jpg",
            "backdropUrl": "https://example.com/backdrop.jpg",
            "mediaType": "MOVIE",
            "totalSeasons": null,
            "totalEpisodes": null,
            "releaseDate": "2010-07-16T00:00:00.000Z",
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        }
    ],
    "hasMore": true,
    "nextPage": 2
}
```

**Empty Results (200 OK)**:
```json
{
    "items": [],
    "hasMore": false,
    "nextPage": null
}
```

**Media Types:** `MOVIE`, `TV`, `ANIME`

---

### 2. Get Media by ID

**GET /api/v1/media/:id**

Get detailed information about a specific media item by IMDb ID (e.g., `tt1375666`) or internal UUID.

#### Request

-   **Method**: `GET`
-   **URL**: `http://localhost:3000/api/v1/media/tt1375666`
    - Or: `http://localhost:3000/api/v1/media/media-uuid`
-   **Headers**: None required (public endpoint)

#### Expected Response (200 OK)

Same structure as individual item in search response.

#### Error Cases

**Media Not Found (404 Not Found)**:
```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Media item not found"
}
```

---

## Watchlist Endpoints

All watchlist endpoints require authentication. Include `Authorization: Bearer <accessToken>` header.

**Note:** The `mediaItemId` parameter can accept either:
- Internal database UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- External ID (e.g., `tt1375666` - IMDb ID)

If a media item doesn't exist in the database, it will be fetched from OMDb and created automatically.

---

### 1. Add Item to Watchlist

**POST /api/v1/watchlist**

Add a media item to the user's watchlist.

#### Request

-   **Method**: `POST`
-   **URL**: `http://localhost:3000/api/v1/watchlist`
-   **Headers**:
    ```
    Content-Type: application/json
    Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
    ```
-   **Body** (raw JSON):
    ```json
    {
        "mediaItemId": "tt1375666"
    }
    ```
    Or use internal UUID:
    ```json
    {
        "mediaItemId": "550e8400-e29b-41d4-a716-446655440000"
    }
    ```

#### Expected Response (201 Created)

```json
{
    "id": "entry-uuid",
    "userId": "user-uuid",
    "mediaItemId": "media-item-uuid",
    "status": "PLANNED",
    "rating": null,
    "notes": null,
    "lastWatchedAt": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "mediaItem": {
        "id": "media-item-uuid",
        "externalId": "tt1375666",
        "source": "omdb",
        "title": "Inception",
        "description": "A skilled thief...",
        "posterUrl": "https://example.com/poster.jpg",
        "backdropUrl": "https://example.com/backdrop.jpg",
        "mediaType": "MOVIE",
        "totalSeasons": null,
        "totalEpisodes": null,
        "releaseDate": "2010-07-16T00:00:00.000Z"
    }
}
```

**Default Status:** New entries are created with `status: "PLANNED"`.

#### Error Cases

**Media Item Not Found (404 Not Found)**:
```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Media item not found"
}
```

**Item Already in Watchlist (409 Conflict)**:
```json
{
    "statusCode": 409,
    "error": "Conflict",
    "message": "Item already in watchlist"
}
```

---

### 2. Get All Watchlist Items

**GET /api/v1/watchlist**

Retrieve all items in the user's watchlist, ordered by creation date (newest first).

#### Request

-   **Method**: `GET`
-   **URL**: `http://localhost:3000/api/v1/watchlist`
-   **Headers**:
    ```
    Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
    ```

#### Expected Response (200 OK)

```json
{
    "items": [
        {
            "id": "entry-uuid",
            "userId": "user-uuid",
            "mediaItemId": "media-item-uuid",
            "status": "WATCHING",
            "rating": 8,
            "notes": "Great movie!",
            "lastWatchedAt": "2024-01-15T00:00:00.000Z",
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-15T00:00:00.000Z",
            "mediaItem": {
                "id": "media-item-uuid",
                "externalId": "tt1375666",
                "source": "omdb",
                "title": "Inception",
                "description": "A skilled thief...",
                "posterUrl": "https://example.com/poster.jpg",
                "backdropUrl": "https://example.com/backdrop.jpg",
                "mediaType": "MOVIE",
                "totalSeasons": null,
                "totalEpisodes": null,
                "releaseDate": "2010-07-16T00:00:00.000Z"
            }
        }
    ]
}
```

**Empty Watchlist (200 OK)**:
```json
{
    "items": []
}
```

---

### 3. Get Specific Watchlist Entry

**GET /api/v1/watchlist/:mediaItemId**

Retrieve a specific watchlist entry for a media item. Useful for checking if an item is already in the watchlist.

#### Request

-   **Method**: `GET`
-   **URL**: `http://localhost:3000/api/v1/watchlist/tt1375666`
    - Or: `http://localhost:3000/api/v1/watchlist/media-item-uuid`
-   **Headers**:
    ```
    Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
    ```

#### Expected Response (200 OK)

Same structure as individual item in "Get All Watchlist Items" response.

#### Error Cases

**Item Not in Watchlist (404 Not Found)**:
```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Item not found in watchlist"
}
```

---

### 4. Update Watchlist Entry

**PATCH /api/v1/watchlist/:mediaItemId**

Update tracking information for a watchlist item (status, rating, notes, lastWatchedAt).

#### Request

-   **Method**: `PATCH`
-   **URL**: `http://localhost:3000/api/v1/watchlist/tt1375666`
    - Or: `http://localhost:3000/api/v1/watchlist/media-item-uuid`
-   **Headers**:
    ```
    Content-Type: application/json
    Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
    ```
-   **Body** (raw JSON, all fields optional):
    ```json
    {
        "status": "WATCHING",
        "rating": 8,
        "notes": "Really enjoying this!",
        "lastWatchedAt": "2024-01-15T00:00:00.000Z"
    }
    ```

**Available Status Values**: `PLANNED`, `WATCHING`, `COMPLETED`, `ON_HOLD`, `DROPPED`

**Rating**: Integer between 1-10, or `null` to remove rating

**Notes**: String or `null` to remove notes

**lastWatchedAt**: ISO 8601 date string or `null` to remove

#### Expected Response (200 OK)

Updated watchlist entry with same structure as "Add Item to Watchlist" response.

#### Example Updates

**Update Only Status**:
```json
{
    "status": "COMPLETED"
}
```

**Update Only Rating**:
```json
{
    "rating": 9
}
```

**Remove Rating**:
```json
{
    "rating": null
}
```

**Update Multiple Fields**:
```json
{
    "status": "COMPLETED",
    "rating": 9,
    "notes": "Amazing movie! Highly recommend.",
    "lastWatchedAt": "2024-01-20T00:00:00.000Z"
}
```

#### Error Cases

**Item Not in Watchlist (404 Not Found)**:
```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Item not found in watchlist"
}
```

**Invalid Rating (400 Bad Request)**:
```json
{
    "statusCode": 400,
    "error": "Bad Request",
    "message": "body/rating must be <= 10"
}
```

---

### 5. Remove Item from Watchlist

**DELETE /api/v1/watchlist/:mediaItemId**

Remove a media item from the user's watchlist.

#### Request

-   **Method**: `DELETE`
-   **URL**: `http://localhost:3000/api/v1/watchlist/tt1375666`
    - Or: `http://localhost:3000/api/v1/watchlist/media-item-uuid`
-   **Headers**:
    ```
    Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
    ```

#### Expected Response (200 OK)

```json
{
    "success": true,
    "message": "Item removed from watchlist"
}
```

#### Error Cases

**Item Not in Watchlist (404 Not Found)**:
```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Item not found in watchlist"
}
```

---

## Postman Collection Setup

### 1. Create Environment Variables

Create a Postman environment with the following variables:

- `baseUrl` = `http://localhost:3000/api/v1`
- `accessToken` = (set after login/register/refresh)
- `refreshToken` = (set after login/register)
- `resetToken` = (set after forgot-password)
- `mediaItemId` = (set after getting a media item)
- `mediaItemExternalId` = (set after getting a media item, e.g., `tt1375666`)

### 2. Use Variables in Requests

- **URL**: `{{baseUrl}}/auth/login`
- **Authorization Header**: `Bearer {{accessToken}}`
- **Body**: Use `{{refreshToken}}` for refresh/logout endpoints

### 3. Test Scripts

Add these scripts to automatically save tokens and IDs:

#### After Login/Register/Refresh

```javascript
if (pm.response.code === 200 || pm.response.code === 201) {
    const jsonData = pm.response.json();
    pm.environment.set("accessToken", jsonData.accessToken);
    pm.environment.set("refreshToken", jsonData.refreshToken);
    
    // Optionally save user info
    if (jsonData.user) {
        console.log("Logged in as:", jsonData.user.email);
    }
}
```

#### After Forgot Password

```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    if (jsonData.resetToken) {
        pm.environment.set("resetToken", jsonData.resetToken);
        console.log("Reset token saved:", jsonData.resetToken);
    }
}
```

#### After Getting Media Item (GET /media/:id or search)

```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    
    // For single media item response
    if (jsonData.id && !jsonData.items) {
        pm.environment.set("mediaItemId", jsonData.id);
        pm.environment.set("mediaItemExternalId", jsonData.externalId);
        console.log("Media item saved:", jsonData.title);
    }
    
    // For media list response
    if (jsonData.items && jsonData.items.length > 0) {
        const firstItem = jsonData.items[0];
        pm.environment.set("mediaItemId", firstItem.id);
        pm.environment.set("mediaItemExternalId", firstItem.externalId);
        console.log("First media item saved:", firstItem.title);
    }
}
```

#### After Adding to Watchlist

```javascript
if (pm.response.code === 201) {
    const jsonData = pm.response.json();
    if (jsonData.mediaItem) {
        pm.environment.set("mediaItemId", jsonData.mediaItem.id);
        pm.environment.set("mediaItemExternalId", jsonData.mediaItem.externalId);
    }
}
```

#### Check Token Expiry (Pre-request Script)

Add this to protected endpoints to auto-refresh expired tokens:

```javascript
// This is a simplified example - in practice, you'd decode the JWT
// and check the exp claim
const accessToken = pm.environment.get("accessToken");
if (!accessToken) {
    console.log("No access token found. Please login first.");
}
```

---

## Complete Testing Flow

### Step 1: Health Check

```
GET {{baseUrl}}/health
```

Should return `{"status": "ok", ...}`

### Step 2: Register a New User

```
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Password123!",
  "username": "testuser"
}
```

**Save `accessToken` and `refreshToken` from response.**

### Step 3: Search for Media

```
GET {{baseUrl}}/media?query=inception&limit=5
```

**Save `mediaItemExternalId` (e.g., `tt1375666`) from response.**

### Step 4: Get Media Details

```
GET {{baseUrl}}/media/{{mediaItemExternalId}}
```

**Save `mediaItemId` (UUID) from response.**

### Step 5: Add to Watchlist

```
POST {{baseUrl}}/watchlist
Content-Type: application/json
Authorization: Bearer {{accessToken}}

{
  "mediaItemId": "{{mediaItemExternalId}}"
}
```

You can use either the external ID (`tt1375666`) or internal UUID.

### Step 6: Get All Watchlist Items

```
GET {{baseUrl}}/watchlist
Authorization: Bearer {{accessToken}}
```

### Step 7: Get Specific Watchlist Entry

```
GET {{baseUrl}}/watchlist/{{mediaItemExternalId}}
Authorization: Bearer {{accessToken}}
```

### Step 8: Update Watchlist Entry

```
PATCH {{baseUrl}}/watchlist/{{mediaItemExternalId}}
Content-Type: application/json
Authorization: Bearer {{accessToken}}

{
  "status": "WATCHING",
  "rating": 8,
  "notes": "Great movie!"
}
```

### Step 9: Update Status to Completed

```
PATCH {{baseUrl}}/watchlist/{{mediaItemExternalId}}
Content-Type: application/json
Authorization: Bearer {{accessToken}}

{
  "status": "COMPLETED",
  "rating": 9,
  "notes": "Amazing! Highly recommend.",
  "lastWatchedAt": "2024-01-20T00:00:00.000Z"
}
```

### Step 10: Refresh Tokens (when access token expires)

```
POST {{baseUrl}}/auth/refresh
Content-Type: application/json

{
  "refreshToken": "{{refreshToken}}"
}
```

**Save new `accessToken` and `refreshToken` from response.**

### Step 11: Test Password Reset Flow

```
POST {{baseUrl}}/auth/forgot-password
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Save `resetToken` from response.**

```
POST {{baseUrl}}/auth/reset-password
Content-Type: application/json

{
  "resetToken": "{{resetToken}}",
  "newPassword": "NewPassword123!"
}
```

**Note:** After password reset, all existing tokens are invalidated. Login again.

### Step 12: Remove from Watchlist

```
DELETE {{baseUrl}}/watchlist/{{mediaItemExternalId}}
Authorization: Bearer {{accessToken}}
```

### Step 13: Logout

```
POST {{baseUrl}}/auth/logout
Content-Type: application/json

{
  "refreshToken": "{{refreshToken}}"
}
```

**Note:** After logout, all tokens are invalidated.

### Step 14: Delete Account

```
DELETE {{baseUrl}}/auth/account
Content-Type: application/json
Authorization: Bearer {{accessToken}}

{
  "password": "NewPassword123!",
  "email": "test@example.com"
}
```

---

## Troubleshooting

1. **Server not running**: Make sure backend is running with `pnpm be:dev` in the project root
2. **Port conflict**: Check if port 3000 is available, or update `.env` file in `apps/backend`
3. **Invalid token**: 
   - Access tokens expire after ~15 minutes - use `/auth/refresh` to get new tokens
   - If refresh fails, login again
   - Check if user logged out or reset password (tokenVersion changed)
4. **Database errors**: Ensure database is running (`pnpm db:up`) and migrations are applied (`pnpm be:prisma:migrate`)
5. **CORS issues**: CORS is enabled in the backend for all origins, so this shouldn't be an issue
6. **401 Unauthorized**: 
   - Check if `Authorization: Bearer <token>` header is included
   - Verify token is not expired
   - Verify token matches user's current `tokenVersion`
7. **Media item not found**: Verify OMDb API key is set in `.env` file
8. **Rate limiting**: OMDb API has rate limits. If you see errors, wait a moment before retrying

---

## Token Expiry Best Practices

1. **Monitor token expiry**: Access tokens expire after 15 minutes (default). Implement automatic refresh in your client.
2. **Refresh proactively**: Refresh tokens before they expire (e.g., when access token has < 2 minutes remaining).
3. **Handle refresh failures**: If refresh fails (401), redirect user to login.
4. **Store tokens securely**: 
   - Never commit tokens to version control
   - Use secure storage (e.g., Keychain on iOS, KeyStore on Android)
   - In Postman, use environment variables (not collection variables) for sensitive data
5. **Logout on security events**: When user logs out or resets password, all tokens are invalidated. Your app should handle this gracefully.

---

## JWT Token Decoding (for debugging)

You can decode JWT tokens to inspect their contents using tools like [jwt.io](https://jwt.io):

1. Copy the token (without the "Bearer " prefix)
2. Paste it into jwt.io
3. View the payload structure:
   - `sub`: User ID
   - `tokenVersion`: Token version
   - `type`: "access" or "refresh"
   - `iat`: Issued at timestamp
   - `exp`: Expires at timestamp

**Note:** Don't share real tokens publicly. Always use test tokens if sharing examples.
