# API Documentation

## Authentication Endpoints

### POST /api/register

Create a new user account.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "restaurantName": "My Restaurant",
  "role": "owner"
}
```

**Response (201 Created):**
```json
{
  "id": 1698076800000,
  "email": "john@example.com",
  "message": "User created successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input (missing fields, invalid email, short password, etc.)
- `409 Conflict` - User already exists
- `500 Internal Server Error` - Server error

**Validation Rules:**
- Email: Valid email format required
- Password: Minimum 8 characters
- First/Last name: Minimum 2 characters
- Restaurant name: Minimum 2 characters
- Role: Must be "owner", "manager", or "staff"

---

### POST /api/login

Authenticate user and create a session.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "message": "Login successful"
}
```

Sets `rm_auth` HttpOnly cookie with JWT token (2-hour expiry).

**Error Responses:**
- `400 Bad Request` - Missing or invalid email
- `401 Unauthorized` - Invalid credentials
- `500 Internal Server Error` - Server error

---

### GET /api/me

Get authenticated user information. Requires valid session cookie.

**Response (200 OK):**
```json
{
  "user": {
    "id": 1698076800000,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "restaurantName": "My Restaurant",
    "role": "owner",
    "createdAt": "2025-10-23T12:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated or session expired
- `500 Internal Server Error` - Server error

---

### POST /api/logout

Clear user session.

**Response (200 OK):**
```json
{
  "ok": true,
  "message": "Logged out successfully"
}
```

Clears `rm_auth` cookie.

---

## Security Notes

- All responses include proper HTTP status codes
- Passwords are hashed with bcryptjs (salt rounds: 10)
- JWT tokens expire after 2 hours
- Cookies are HttpOnly and Secure (in production) with SameSite=Strict
- Input validation and sanitization on all endpoints
- Comprehensive error logging to console (development only)

## Environment Variables

See `.env.example` for all configuration options.

In production:
- Set `NODE_ENV=production`
- Provide a secure `JWT_SECRET` (minimum 32 characters recommended)
- Set `secure: true` in cookie options (automatically done when NODE_ENV=production)

