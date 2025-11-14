# Postman Testing Guide

This guide shows how to test the authentication and watchlist endpoints in Postman.

## Base URL

-   **Local**: `http://localhost:3000/api/v1`

---

## 1. Forgot Password Endpoint

**Request Password Reset Token**

### Request

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

### Expected Response (200 OK)

```json
{
    "message": "If an account with that email exists, a password reset token has been generated.",
    "resetToken": "test-reset-token-123"
}
```

**Note**: In production, the `resetToken` will not be returned in the response. It's only included for development/testing purposes.

---

## 2. Reset Password Endpoint

**Reset Password Using Reset Token**

### Prerequisites

-   You need a valid `resetToken` from the forgot-password endpoint

### Request

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

### Expected Response (200 OK)

```json
{
    "success": true,
    "message": "Password has been reset successfully"
}
```

### Error Cases

**Invalid Token (404)**:

```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Invalid or expired reset token"
}
```

**Expired Token (400)**:

```json
{
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Reset token has expired"
}
```

---

## 3. Delete Account Endpoint

**Delete User Account**

### Prerequisites

-   You need a valid access token (from login or register endpoint)
-   You need the user's password and email for verification

### Request

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

### Expected Response (200 OK)

```json
{
    "success": true,
    "message": "Account has been deleted successfully"
}
```

### Error Cases

**Missing/Invalid Token (401)**:

```json
{
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Missing or invalid Authorization header"
}
```

**Invalid Password (401)**:

```json
{
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Invalid password"
}
```

**Email Mismatch (401)**:

```json
{
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Email does not match"
}
```

---

## Complete Testing Flow Example

### Step 1: Register a User (if needed)

```
POST http://localhost:3000/api/v1/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Password123!",
  "username": "testuser"
}
```

**Save the `accessToken` and `refreshToken` from the response.**

### Step 2: Test Forgot Password

```
POST http://localhost:3000/api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Copy the `resetToken` from the response.**

### Step 3: Test Reset Password

```
POST http://localhost:3000/api/v1/auth/reset-password
Content-Type: application/json

{
  "resetToken": "PASTE_RESET_TOKEN_HERE",
  "newPassword": "NewPassword123!"
}
```

**Note**: After resetting password, all existing sessions are invalidated. You'll need to login again.

### Step 4: Login Again (to get new token)

```
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "NewPassword123!"
}
```

### Step 5: Test Delete Account

```
DELETE http://localhost:3000/api/v1/auth/account
Content-Type: application/json
Authorization: Bearer PASTE_ACCESS_TOKEN_HERE

{
  "password": "NewPassword123!",
  "email": "test@example.com"
}
```

---

## Postman Collection Setup Tips

1. **Create an Environment Variable**:

    - Variable: `baseUrl` = `http://localhost:3000/api/v1`
    - Variable: `accessToken` = (set after login)
    - Variable: `refreshToken` = (set after login)
    - Variable: `resetToken` = (set after forgot-password)
    - Variable: `mediaItemId` = (set after getting a media item)

2. **Use Variables in Requests**:

    - URL: `{{baseUrl}}/auth/forgot-password`
    - Authorization Header: `Bearer {{accessToken}}`

3. **Test Scripts** (to save tokens automatically):

    **After Login/Register**:

    ```javascript
    if (pm.response.code === 200 || pm.response.code === 201) {
        const jsonData = pm.response.json();
        pm.environment.set("accessToken", jsonData.accessToken);
        pm.environment.set("refreshToken", jsonData.refreshToken);
    }
    ```

    **After Forgot Password**:

    ```javascript
    if (pm.response.code === 200) {
        const jsonData = pm.response.json();
        if (jsonData.resetToken) {
            pm.environment.set("resetToken", jsonData.resetToken);
        }
    }
    ```

    **After Getting Media Item** (from GET /media or GET /media/:id):

    ```javascript
    if (pm.response.code === 200) {
        const jsonData = pm.response.json();
        // For single media item response
        if (jsonData.id) {
            pm.environment.set("mediaItemId", jsonData.id);
        }
        // For media list response
        if (jsonData.items && jsonData.items.length > 0) {
            pm.environment.set("mediaItemId", jsonData.items[0].id);
        }
    }
    ```

    **After Adding to Watchlist**:

    ```javascript
    if (pm.response.code === 201) {
        const jsonData = pm.response.json();
        pm.environment.set("mediaItemId", jsonData.mediaItemId);
    }
    ```

---

## Watchlist Endpoints

### Prerequisites for Watchlist Testing

-   You need a valid access token (from login or register endpoint)
-   You need at least one media item ID in your database (media items are created when searching/accessing media)

---

### 1. Add Item to Watchlist

**POST /api/v1/watchlist**

Adds a media item to the user's watchlist.

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
        "mediaItemId": "media-item-uuid-here"
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
        "externalId": "tt0000001",
        "source": "omdb",
        "title": "Test Movie",
        "description": "Movie description",
        "posterUrl": "https://example.com/poster.jpg",
        "backdropUrl": "https://example.com/backdrop.jpg",
        "mediaType": "MOVIE",
        "totalSeasons": null,
        "totalEpisodes": null,
        "releaseDate": "2024-01-01T00:00:00.000Z"
    }
}
```

#### Error Cases

**Media Item Not Found (404)**:

```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Media item not found"
}
```

**Item Already in Watchlist (409)**:

```json
{
    "statusCode": 409,
    "error": "Conflict",
    "message": "Item already in watchlist"
}
```

---

### 2. Remove Item from Watchlist

**DELETE /api/v1/watchlist/:mediaItemId**

Removes a media item from the user's watchlist.

#### Request

-   **Method**: `DELETE`
-   **URL**: `http://localhost:3000/api/v1/watchlist/{mediaItemId}`
-   **Headers**:
    ```
    Content-Type: application/json
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

**Item Not in Watchlist (404)**:

```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Item not found in watchlist"
}
```

---

### 3. Get All Watchlist Items

**GET /api/v1/watchlist**

Retrieves all items in the user's watchlist, ordered by creation date (newest first).

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
                "externalId": "tt0000001",
                "source": "omdb",
                "title": "Test Movie",
                "description": "Movie description",
                "posterUrl": "https://example.com/poster.jpg",
                "backdropUrl": "https://example.com/backdrop.jpg",
                "mediaType": "MOVIE",
                "totalSeasons": null,
                "totalEpisodes": null,
                "releaseDate": "2024-01-01T00:00:00.000Z"
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

### 4. Update Watchlist Entry

**PATCH /api/v1/watchlist/:mediaItemId**

Updates tracking information for a watchlist item (status, rating, notes, lastWatchedAt).

#### Request

-   **Method**: `PATCH`
-   **URL**: `http://localhost:3000/api/v1/watchlist/{mediaItemId}`
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

```json
{
    "id": "entry-uuid",
    "userId": "user-uuid",
    "mediaItemId": "media-item-uuid",
    "status": "WATCHING",
    "rating": 8,
    "notes": "Really enjoying this!",
    "lastWatchedAt": "2024-01-15T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z",
    "mediaItem": {
        "id": "media-item-uuid",
        "externalId": "tt0000001",
        "source": "omdb",
        "title": "Test Movie",
        "description": "Movie description",
        "posterUrl": "https://example.com/poster.jpg",
        "backdropUrl": "https://example.com/backdrop.jpg",
        "mediaType": "MOVIE",
        "totalSeasons": null,
        "totalEpisodes": null,
        "releaseDate": "2024-01-01T00:00:00.000Z"
    }
}
```

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

**Item Not in Watchlist (404)**:

```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Item not found in watchlist"
}
```

**Invalid Rating (400)**:

```json
{
    "statusCode": 400,
    "error": "Bad Request",
    "message": "body/rating must be <= 10"
}
```

---

### 5. Get Specific Watchlist Entry

**GET /api/v1/watchlist/:mediaItemId**

Retrieves a specific watchlist entry for a media item. Useful for checking if an item is already in the watchlist.

#### Request

-   **Method**: `GET`
-   **URL**: `http://localhost:3000/api/v1/watchlist/{mediaItemId}`
-   **Headers**:
    ```
    Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
    ```

#### Expected Response (200 OK)

Same structure as the individual item in the "Get All Watchlist Items" response.

#### Error Cases

**Item Not in Watchlist (404)**:

```json
{
    "statusCode": 404,
    "error": "Not Found",
    "message": "Item not found in watchlist"
}
```

---

## Complete Watchlist Testing Flow

### Step 1: Login or Register

```
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Password123!"
}
```

**Save the `accessToken` from the response.**

### Step 2: Get a Media Item ID

First, search for or get a media item to get its ID:

```
GET http://localhost:3000/api/v1/media?query=inception
```

Or access a specific media item:

```
GET http://localhost:3000/api/v1/media/tt1375666
```

**Copy the `id` field from the media item response (not `externalId`).**

### Step 3: Add Item to Watchlist

```
POST http://localhost:3000/api/v1/watchlist
Content-Type: application/json
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "mediaItemId": "PASTE_MEDIA_ITEM_ID_HERE"
}
```

### Step 4: Get All Watchlist Items

```
GET http://localhost:3000/api/v1/watchlist
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Step 5: Get Specific Watchlist Entry

```
GET http://localhost:3000/api/v1/watchlist/PASTE_MEDIA_ITEM_ID_HERE
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Step 6: Update Watchlist Entry

```
PATCH http://localhost:3000/api/v1/watchlist/PASTE_MEDIA_ITEM_ID_HERE
Content-Type: application/json
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "status": "WATCHING",
  "rating": 8,
  "notes": "Great movie!"
}
```

### Step 7: Update Status to Completed

```
PATCH http://localhost:3000/api/v1/watchlist/PASTE_MEDIA_ITEM_ID_HERE
Content-Type: application/json
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "status": "COMPLETED",
  "rating": 9,
  "notes": "Amazing! Highly recommend.",
  "lastWatchedAt": "2024-01-20T00:00:00.000Z"
}
```

### Step 8: Remove Item from Watchlist

```
DELETE http://localhost:3000/api/v1/watchlist/PASTE_MEDIA_ITEM_ID_HERE
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## Troubleshooting

1. **Server not running**: Make sure backend is running with `pnpm run dev` in `apps/backend`
2. **Port conflict**: Check if port 3000 is available, or update `.env` file
3. **Invalid token**: Tokens expire. Login again to get fresh tokens
4. **Database errors**: Ensure database is running and migrations are applied
5. **CORS issues**: CORS is enabled in the backend, so this shouldn't be an issue

---
