# Postman Testing Guide for New Endpoints

This guide shows how to test the new authentication endpoints in Postman.

## Base URL
- **Local**: `http://localhost:3000/api/v1`

---

## 1. Forgot Password Endpoint

**Request Password Reset Token**

### Request
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/v1/auth/forgot-password`
- **Headers**: 
  ```
  Content-Type: application/json
  ```
- **Body** (raw JSON):
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
- You need a valid `resetToken` from the forgot-password endpoint

### Request
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/v1/auth/reset-password`
- **Headers**: 
  ```
  Content-Type: application/json
  ```
- **Body** (raw JSON):
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
- You need a valid access token (from login or register endpoint)
- You need the user's password and email for verification

### Request
- **Method**: `DELETE`
- **URL**: `http://localhost:3000/api/v1/auth/account`
- **Headers**: 
  ```
  Content-Type: application/json
  Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
  ```
- **Body** (raw JSON):
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
   - Variable: `resetToken` = (set after forgot-password)

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

---

## Troubleshooting

1. **Server not running**: Make sure backend is running with `npm run dev` in `apps/backend`
2. **Port conflict**: Check if port 3000 is available, or update `.env` file
3. **Invalid token**: Tokens expire. Login again to get fresh tokens
4. **Database errors**: Ensure database is running and migrations are applied
5. **CORS issues**: CORS is enabled in the backend, so this shouldn't be an issue

---

## Quick Test Checklist

- [ ] Forgot password returns token (even for non-existent email)
- [ ] Reset password works with valid token
- [ ] Reset password rejects expired token
- [ ] Reset password rejects invalid token
- [ ] Delete account requires valid token
- [ ] Delete account requires correct password
- [ ] Delete account requires matching email
- [ ] Delete account invalidates token version check
- [ ] After password reset, old tokens are invalidated
- [ ] After account deletion, user cannot login

