# API Documentation - Authentication Endpoints

## Table of Contents
1. [POST /api/register](#post-apiregister) - User Registration
2. [POST /api/login](#post-apilogin) - User Login
3. [GET /api/me](#get-apime) - Get Current User
4. [POST /api/logout](#post-apilogout) - User Logout
5. [Security Features](#security-features)
6. [Rate Limiting](#rate-limiting)
7. [Error Handling](#error-handling)
8. [Environment Setup](#environment-setup)

---

## Authentication Endpoints

### POST /api/register

Create a new user account with comprehensive validation and security.

**Endpoint:** `POST /api/register`

**Rate Limit:** 5 requests per IP per 15 minutes

**Request Header:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "restaurantName": "My Restaurant",
  "role": "owner",
  "phone": "+1 (555) 123-4567"
}
```

**Request Field Details:**
| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| firstName | string | Yes | 2-50 chars, letters only, no numbers/special chars |
| lastName | string | Yes | 2-50 chars, letters only, no numbers/special chars |
| email | string | Yes | Valid email format (RFC 5321), max 254 chars, unique |
| password | string | Yes | Min 8 chars, 1+ uppercase, 1+ lowercase, 1+ digit, 1+ special char |
| restaurantName | string | Yes | 2-255 characters |
| role | string | Yes | One of: "owner", "manager", "staff" |
| phone | string | No | Optional, international format (7-20 chars, digits + spaces/hyphens) |

**Success Response (201 Created):**
```json
{
  "id": 1698076800000,
  "email": "john@example.com",
  "message": "User created successfully"
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "First name must be 2-50 characters, letters only" | Invalid first name |
| 400 | "Last name must be 2-50 characters, letters only" | Invalid last name |
| 400 | "Valid email is required" | Invalid email format |
| 400 | "Password must be at least 8 characters" | Password too short |
| 400 | "Password must include uppercase letter" | Missing uppercase |
| 400 | "Password must include lowercase letter" | Missing lowercase |
| 400 | "Password must include number" | Missing digit |
| 400 | "Password must include special character" | Missing special char |
| 400 | "Phone number format is invalid" | Invalid phone (if provided) |
| 400 | "Restaurant name must be 2-255 characters" | Invalid restaurant name |
| 400 | "Invalid role" | Role not in whitelist |
| 409 | "User already exists" | Email already registered |
| 429 | Rate limit exceeded | Too many requests from IP |
| 500 | "Registration failed" | Server error |

**Password Requirements (Security Details):**
- **Minimum Length:** 8 characters
  - Provides ~43 bits of entropy (if truly random)
  - Dictionary attacks become computationally expensive
  
- **Uppercase Letter Required:** A-Z
  - Increases character set size from 26 to 52
  - Prevents common patterns (all lowercase)
  
- **Lowercase Letter Required:** a-z
  - Mixed case detection prevents simple substitutions
  
- **Number Required:** 0-9
  - Breaks pure letter/symbol patterns
  - Common password strategies (leetspeak) require this
  
- **Special Character Required:** !@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?
  - Significantly increases entropy
  - Prevents keyboard-walk patterns
  - Examples of valid passwords:
    - `SecurePass123!` (13 chars, excellent strength)
    - `MyP@ssw0rd` (10 chars, good strength)
    - `Restaurant#2025` (15 chars, excellent strength)

**Password Hashing:**
- Algorithm: bcryptjs with 10 salt rounds
- Time Cost: ~100ms per hash (resistant to brute-force)
- Salt: Unique random salt per password
- Never stored in plain text

**Validation Process (12 Steps):**
1. Phone format validation (if provided)
2. Input sanitization (remove/escape dangerous characters)
3. First name validation
4. Last name validation
5. Email format validation
6. Password strength validation (5 requirements)
7. Restaurant name length validation
8. Role whitelist validation
9. Duplicate email check (prevents account takeover)
10. Password hashing with bcryptjs
11. User object creation
12. Database persistence

**Example cURL Request:**
```bash
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "restaurantName": "My Restaurant",
    "role": "owner",
    "phone": "+1 (555) 123-4567"
  }'
```

**Example JavaScript Request:**
```javascript
const response = await fetch('/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'SecurePass123!',
    restaurantName: 'My Restaurant',
    role: 'owner',
    phone: '+1 (555) 123-4567'
  })
});

if (!response.ok) {
  const error = await response.json();
  console.error('Registration failed:', error.error);
} else {
  const data = await response.json();
  console.log('Registered:', data.email);
}
```

---

### POST /api/login

Authenticate user and create a session with JWT token.

**Endpoint:** `POST /api/login`

**Rate Limit:** 10 failed login attempts per IP per 15 minutes
(Note: Successful logins do NOT count toward the limit)

**Request Header:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Request Field Details:**
| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| email | string | Yes | Valid email format |
| password | string | Yes | Non-empty string |

**Success Response (200 OK):**
```json
{
  "ok": true,
  "message": "Login successful"
}
```

**Cookie Set:**
```
Set-Cookie: rm_auth=<JWT_TOKEN>; HttpOnly; Secure; SameSite=Strict; Max-Age=7200
```

**Cookie Details:**
| Property | Value | Purpose |
|----------|-------|---------|
| Name | `rm_auth` | Authentication token identifier |
| Value | JWT Token | Signed token with 2-hour expiry |
| HttpOnly | true | Prevents JavaScript/XSS access |
| Secure | true (prod) | Enforce HTTPS in production |
| SameSite | Strict | Prevent CSRF attacks |
| Max-Age | 7200s | 2 hours (matches JWT expiry) |

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Valid email is required" | Missing or invalid email |
| 400 | "Password is required" | Missing password |
| 401 | "Invalid credentials" | Email not found OR password mismatch |
| 429 | Rate limit exceeded | Too many failed attempts |
| 500 | "Login failed" | Server error |

**Security Features:**

1. **Timing-Safe Comparison**
   - Uses bcryptjs `compare()` method
   - Resistant to timing attacks
   - Prevents attackers from guessing passwords character-by-character
   
2. **Unified Error Messages**
   - Same message for "email not found" and "wrong password"
   - Prevents user enumeration attacks
   - Attacker cannot determine which email addresses exist
   
3. **JWT Token**
   - Algorithm: HS256 (HMAC-SHA256)
   - Payload: { id, email }
   - Expiry: 2 hours
   - Signed with JWT_SECRET (from environment)
   
4. **Rate Limiting**
   - Per IP address
   - Only counts failed attempts
   - Successful login resets counter
   - Auto-reset after 15 minutes of no attempts
   
5. **HttpOnly Cookie**
   - JavaScript cannot access token
   - Protects against XSS token theft
   - Automatically sent with each request
   - Cleared on logout

**Login Process (4 Steps):**
1. Sanitize and validate email
2. Validate password presence
3. Database lookup (unified error if not found)
4. Bcryptjs password comparison (timing-safe)
5. JWT token generation
6. Secure cookie creation
7. Success response

**Example cURL Request:**
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Example JavaScript Request:**
```javascript
const response = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Include cookies in request
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'SecurePass123!'
  })
});

if (!response.ok) {
  const error = await response.json();
  console.error('Login failed:', error.error);
} else {
  const data = await response.json();
  console.log('Login successful:', data.message);
  // Session is now established via HttpOnly cookie
  // Automatic with credentials: 'include'
}
```

**Token Expiry Behavior:**
- Token expires after 2 hours
- Expired tokens are automatically rejected
- Cookie is cleared when token expires
- User must login again to get new session
- This forces periodic re-authentication for security

---

### GET /api/me

Get authenticated user information (protected endpoint).

**Endpoint:** `GET /api/me`

**Authentication:** Requires valid `rm_auth` cookie

**Request Header:**
```
Cookie: rm_auth=<JWT_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "user": {
    "id": 1698076800000,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1 (555) 123-4567",
    "restaurantName": "My Restaurant",
    "role": "owner",
    "createdAt": "2025-10-23T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 401 | "Not authenticated" | Missing rm_auth cookie |
| 401 | "Session expired" | JWT token has expired |
| 401 | "Session has been revoked" | Token is blacklisted (logged out) |
| 401 | "User not found" | User deleted or ID invalid |
| 401 | "Invalid token" | JWT verification failed |
| 500 | Server error | Internal error |

**Response Field Details:**
| Field | Type | Description |
|-------|------|-------------|
| id | number | User ID (timestamp-based) |
| firstName | string | User's first name |
| lastName | string | User's last name |
| email | string | User's email address |
| phone | string\|null | User's phone (optional) |
| restaurantName | string | Associated restaurant name |
| role | string | User role: "owner", "manager", or "staff" |
| createdAt | string | ISO timestamp of account creation |

**Important Notes:**
- Password hash is NEVER returned
- Sensitive data is stripped before response
- Token must be valid and not expired
- Token must not be blacklisted
- User must still exist in database

**Security Features:**

1. **Blacklist Check**
   - Prevents access after logout
   - Token remains blacklisted for 2 hours
   - Immediate revocation on logout
   
2. **JWT Verification**
   - Signature validation (HMAC-SHA256)
   - Expiry validation
   - Throws error if invalid
   
3. **Token Expiry**
   - 2-hour expiration enforced
   - Expired tokens trigger 401 response
   - Cookie cleared on expiry
   
4. **User Validation**
   - Verifies user still exists
   - Prevents deleted user access
   - Returns clean response (no hash)

**Example cURL Request:**
```bash
curl -X GET http://localhost:5000/api/me \
  -H "Cookie: rm_auth=<JWT_TOKEN>"
```

**Example JavaScript Request:**
```javascript
const response = await fetch('/api/me', {
  method: 'GET',
  credentials: 'include' // Include cookies
});

if (!response.ok) {
  const error = await response.json();
  console.error('Auth error:', error.error);
  // Redirect to login if not authenticated
} else {
  const data = await response.json();
  console.log('User:', data.user);
  // User is authenticated, display their info
}
```

---

### POST /api/logout

Clear user session and revoke authentication token.

**Endpoint:** `POST /api/logout`

**Authentication:** Optional (works with or without valid token)

**Request Header:**
```
Cookie: rm_auth=<JWT_TOKEN> (optional)
```

**Success Response (200 OK):**
```json
{
  "ok": true,
  "message": "Logged out successfully"
}
```

**Cookie Cleared:**
```
Set-Cookie: rm_auth=; HttpOnly; Secure; SameSite=Strict; Max-Age=0
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 500 | "Logout failed" | Server error (rare) |

**Security Features:**

1. **Cookie Clearing**
   - Removes authentication token from client
   - Browser stops sending token with requests
   - Prevents further authenticated requests
   
2. **Token Blacklisting**
   - Token added to revocation list immediately
   - Remains blacklisted for 2 hours (original expiry)
   - Prevents token reuse after logout
   - Protects against token theft/compromise
   
3. **Immediate Revocation**
   - No grace period for logout
   - Token is invalid immediately
   - Calling GET /api/me returns 401
   
4. **Automatic Cleanup**
   - Blacklist entries expire automatically
   - Prevents unlimited memory growth
   - Old tokens removed after 2 hours

**Logout Process (2 Steps):**
1. Clear `rm_auth` cookie (Max-Age=0)
2. Add token to blacklist for 2 hours
3. Return success response

**Example cURL Request:**
```bash
curl -X POST http://localhost:5000/api/logout \
  -H "Cookie: rm_auth=<JWT_TOKEN>"
```

**Example JavaScript Request:**
```javascript
const response = await fetch('/api/logout', {
  method: 'POST',
  credentials: 'include' // Include cookies
});

if (!response.ok) {
  console.error('Logout error');
} else {
  const data = await response.json();
  console.log(data.message); // "Logged out successfully"
  // Redirect to login page
  window.location.href = '/login.html';
}
```

**Token Blacklist Details:**

The token blacklist provides additional security by:
- Preventing token reuse after logout
- Protecting if token is compromised
- Enforcing immediate session termination
- Working even if client doesn't clear cookie
- Automatic garbage collection after expiry

Example scenario:
1. User logs out → Token blacklisted
2. Attacker steals token from logs/network
3. Attacker tries to use token with GET /api/me
4. Token is rejected (blacklisted)
5. No access granted despite valid signature

---

## Security Features

### Authentication Methods

**1. Registration-Based (Default)**
- Users create account with email/password
- Bcryptjs password hashing (10 rounds)
- Password strength enforced (8+ chars, mixed case, digit, special char)
- Email uniqueness validated

**2. Session-Based (JWT + HttpOnly Cookie)**
- JWT token generated on login
- Stored in HttpOnly cookie (not accessible to JavaScript)
- Automatically sent with each request
- Expires after 2 hours
- Refreshed by re-login

### Password Security

**Hashing Algorithm:** bcryptjs with PBKDF2
- Salt Rounds: 10
- Time Cost: ~100ms per password hash
- Resistant to GPU/ASIC brute-force attacks
- Each password has unique salt

**Password Requirements:** (Enforced at Registration)
```
✓ Minimum 8 characters
✓ At least 1 uppercase letter (A-Z)
✓ At least 1 lowercase letter (a-z)
✓ At least 1 number (0-9)
✓ At least 1 special character (!@#$%^&*)
```

**Strength Estimation:**
- 8-char password: ~43 bits entropy
- 12-char password: ~64 bits entropy
- Recommended minimum: 10+ characters

### Token Security

**JWT Configuration:**
- Algorithm: HS256 (HMAC-SHA256)
- Secret: 256-bit random value from JWT_SECRET env
- Expiry: 2 hours (7,200 seconds)
- Payload: { id, email, iat, exp }

**Token Lifecycle:**
1. Generated on successful login
2. Sent to client as HttpOnly cookie
3. Validated on each protected request
4. Blacklisted on logout
5. Automatically invalid after 2 hours

**Token Protection:**
- Signed with server secret (HMAC)
- Cannot be forged without secret
- Signature verified on each request
- Expiry prevents long-term compromise

### Cookie Security

**HttpOnly Cookie Configuration:**
```javascript
res.cookie('rm_auth', token, {
  httpOnly: true,       // JavaScript cannot access
  secure: true,         // HTTPS only (production)
  sameSite: 'Strict',   // CSRF protection
  maxAge: 2 * 60 * 60 * 1000 // 2 hours
});
```

**HttpOnly Protection:**
- Prevents XSS token theft (JavaScript access blocked)
- Token only sent by browser automatically
- Not visible to page JavaScript
- Survives page refreshes

**Secure Flag:**
- Enforces HTTPS in production
- Prevents man-in-the-middle attacks
- Development allows HTTP for testing

**SameSite Protection:**
- Prevents CSRF (Cross-Site Request Forgery) attacks
- Strict mode: Cookie only sent same-site
- No cross-site request leakage
- Value: "Strict" (most secure)

### Input Validation

**Validation Approach:** Defense in Depth
1. **Phone validation** - Format check before sanitizing
2. **Input sanitization** - Remove/escape dangerous characters
3. **Field validation** - Type and format verification
4. **Password strength** - 5-requirement check
5. **Database lookup** - Duplicate detection

**Sanitization Process:**
- Remove HTML/script tags
- Escape special characters
- Prevent NoSQL injection
- Limit length (255 chars)
- Trim whitespace

**Validation Functions:**
- `validateEmail()` - RFC 5321 compliance
- `validatePhone()` - International format support
- `validateName()` - Letters/hyphens/apostrophes only
- `validatePassword()` - 5 strength requirements
- `sanitizeString()` - XSS/injection prevention

---

## Rate Limiting

### Registration Endpoint (`POST /api/register`)
- **Limit:** 5 requests per IP per 15 minutes
- **Response:** 429 Too Many Requests
- **Purpose:** Prevent automated account creation

### Login Endpoint (`POST /api/login`)
- **Limit:** 10 failed attempts per IP per 15 minutes
- **Successful attempts:** Do NOT count toward limit
- **Response:** 429 Too Many Requests
- **Purpose:** Prevent brute-force password attacks

### How It Works
- IP-based tracking (not user-based)
- Automatic reset after 15 minutes of no violations
- HTTP 429 response with Retry-After header
- Prevents rapid-fire requests without blocking legitimate users

### Bypass Prevention
- Cannot bypass with proxy rotation (per-IP)
- Cannot bypass with multiple accounts (per-endpoint)
- Cannot bypass with slow attacks (15-min window effective)

---

## Error Handling

### HTTP Status Codes

| Code | Name | When | Example |
|------|------|------|---------|
| 200 | OK | Request successful | Login success, GET /me |
| 201 | Created | Resource created | Register success |
| 400 | Bad Request | Invalid input | Missing fields, bad format |
| 401 | Unauthorized | Auth required/failed | Invalid credentials, expired token |
| 409 | Conflict | Resource exists | Duplicate email |
| 429 | Too Many Requests | Rate limited | Too many login attempts |
| 500 | Server Error | Unexpected error | Database failure |

### Error Response Format

**Standard Error Response:**
```json
{
  "error": "Descriptive error message"
}
```

**Error Message Guidelines:**
- User-friendly wording
- No technical details exposed
- Security: No information leakage
- Actionable guidance when possible

### Examples

**Invalid Email Format:**
```json
{
  "error": "Valid email is required"
}
```

**Weak Password:**
```json
{
  "error": "Password must include uppercase letter"
}
```

**Duplicate Account:**
```json
{
  "error": "User already exists"
}
```

**Unauthorized Access:**
```json
{
  "error": "Not authenticated"
}
```

---

## Environment Setup

### Required Environment Variables

**Development (.env file):**
```env
JWT_SECRET=your-32-character-secret-key-here
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000
DB_FILE=./db.json
```

**Production (.env file):**
```env
JWT_SECRET=<generate-secure-32-char-secret>
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://yourdomain.com
DB_FILE=/var/data/db.json
```

### Generate JWT_SECRET

```bash
# Node.js command to generate secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Install Dependencies

```bash
cd backend
npm install
```

### Run Server

**Development:**
```bash
npm start
# or with auto-reload
npm run dev
```

**Production:**
```bash
NODE_ENV=production npm start
```

### Test Endpoints

**Register:**
```bash
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "restaurantName": "My Restaurant",
    "role": "owner"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Get User:**
```bash
curl -X GET http://localhost:5000/api/me \
  -b cookies.txt
```

**Logout:**
```bash
curl -X POST http://localhost:5000/api/logout \
  -b cookies.txt
```

---

## API Testing

### Using Postman

1. **Create Register Request:**
   - Method: POST
   - URL: http://localhost:5000/api/register
   - Body (raw JSON): User registration data
   - Send

2. **Create Login Request:**
   - Method: POST
   - URL: http://localhost:5000/api/login
   - Body (raw JSON): Email and password
   - Send (saves cookie automatically)

3. **Create Get User Request:**
   - Method: GET
   - URL: http://localhost:5000/api/me
   - Send (includes saved cookie automatically)

4. **Create Logout Request:**
   - Method: POST
   - URL: http://localhost:5000/api/logout
   - Send (clears cookie)

### Using JavaScript/Fetch

See examples in each endpoint section above.

### Using Jest/Supertest

```javascript
const request = require('supertest');
const app = require('./server');

describe('Authentication API', () => {
  it('should register a user', async () => {
    const response = await request(app)
      .post('/api/register')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'SecurePass123!',
        restaurantName: 'My Restaurant',
        role: 'owner'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.email).toBe('john@example.com');
  });
});
```

---

## Response Headers

All responses include standard HTTP headers:

```
Content-Type: application/json; charset=utf-8
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000 (production)
```

---

## API Versions & Deprecation

**Current Version:** 1.0 (October 2025)

No deprecated endpoints at this time.

Future versions will maintain backward compatibility when possible.

