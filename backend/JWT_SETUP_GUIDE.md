# 🔐 JWT Authentication Setup Guide

## Overview

This guide provides complete instructions for implementing and configuring JWT (JSON Web Token) authentication in the Restaurant Management System backend. JWT is a stateless authentication mechanism that allows secure communication between the client and server.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [JWT Concepts](#jwt-concepts)
3. [Implementation Details](#implementation-details)
4. [Configuration](#configuration)
5. [Usage Examples](#usage-examples)
6. [Security Best Practices](#security-best-practices)
7. [Token Lifecycle](#token-lifecycle)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Topics](#advanced-topics)

---

## Quick Start

### 1. Prerequisites

```bash
Node.js 18+ 
npm or yarn
Express.js 4.18+
jsonwebtoken package
```

### 2. Install Dependencies

```bash
cd backend
npm install jsonwebtoken bcryptjs express-rate-limit cookie-parser cors body-parser
```

### 3. Environment Setup

Create a `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-256-bit-secret-here
JWT_EXPIRE=2h
NODE_ENV=development
PORT=5000

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Database
DB_FILE=./db.json
```

**Generate a secure JWT_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start Server

```bash
# Install if not already done
npm install

# Start server
npm start
```

Server runs on: `http://localhost:5000`

---

## JWT Concepts

### What is JWT?

A JWT consists of three parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Structure:**

```
Header.Payload.Signature
```

#### Header
```json
{
  "alg": "HS256",     // Algorithm (HMAC-SHA256)
  "typ": "JWT"        // Type
}
```

#### Payload
```json
{
  "id": 1698076800000,           // User ID
  "email": "user@example.com",   // Email
  "role": "owner",               // Role
  "iat": 1698076800,             // Issued at timestamp
  "exp": 1698083800              // Expiration timestamp
}
```

#### Signature
```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  secret
)
```

### Why JWT?

✅ **Stateless** - No session storage needed  
✅ **Scalable** - Works across multiple servers  
✅ **Secure** - Cryptographically signed  
✅ **Self-contained** - All info in token  
✅ **Mobile-friendly** - Works with native apps  

---

## Implementation Details

### 1. JWT Secret Generation

**Security Critical:**

```javascript
// NEVER hardcode secrets in code
// ALWAYS use environment variables

if(!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is REQUIRED');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
```

### 2. Token Generation

```javascript
const jwt = require('jsonwebtoken');

function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',    // Algorithm
    expiresIn: '2h',       // 2-hour expiry
    issuer: 'restaurant-app', // Issuer
    subject: user.id.toString() // Subject
  });

  return token;
}
```

**Usage in Login:**

```javascript
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = users.find(u => u.email === email);
  if(!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Compare password
  const isValid = await bcrypt.compare(password, user.password);
  if(!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate token
  const token = generateToken(user);

  // Set secure cookie
  res.cookie('rm_auth', token, {
    httpOnly: true,        // Prevent JavaScript access
    secure: NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'Strict',    // CSRF protection
    maxAge: 2 * 60 * 60 * 1000 // 2 hours in milliseconds
  });

  res.json({ ok: true, message: 'Login successful' });
});
```

### 3. Token Verification

```javascript
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'restaurant-app'
    });
    return { valid: true, decoded };
  } catch(error) {
    if(error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token expired' };
    }
    if(error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid token' };
    }
    return { valid: false, error: 'Token verification failed' };
  }
}
```

### 4. Middleware for Protected Routes

```javascript
// Token blacklist (in-memory for demo, use Redis in production)
const tokenBlacklist = new Set();

/**
 * Authentication middleware
 * Verifies JWT token and checks blacklist
 */
function authenticateToken(req, res, next) {
  // Get token from cookie
  const token = req.cookies.rm_auth;

  if(!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Check blacklist
  if(tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }

  // Verify token
  const { valid, decoded, error } = verifyToken(token);

  if(!valid) {
    if(error === 'Token expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error });
  }

  // Attach user to request
  req.user = decoded;
  next();
}

// Usage
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});
```

### 5. Token Refresh

```javascript
/**
 * Optional: Token refresh endpoint
 * Allows client to get a new token without re-logging in
 */
app.post('/api/refresh', authenticateToken, (req, res) => {
  const newToken = generateToken(req.user);

  res.cookie('rm_auth', newToken, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 2 * 60 * 60 * 1000
  });

  res.json({ ok: true, message: 'Token refreshed' });
});
```

### 6. Logout with Blacklist

```javascript
app.post('/api/logout', authenticateToken, (req, res) => {
  const token = req.cookies.rm_auth;

  // Add token to blacklist
  tokenBlacklist.add(token);

  // Set expiry for blacklist cleanup (2 hours)
  setTimeout(() => {
    tokenBlacklist.delete(token);
  }, 2 * 60 * 60 * 1000);

  // Clear cookie
  res.clearCookie('rm_auth');

  res.json({ ok: true, message: 'Logged out successfully' });
});
```

---

## Configuration

### Environment Variables

**Required Variables:**

```env
JWT_SECRET=<32-character-hex-string>
```

**Optional Variables:**

```env
JWT_EXPIRE=2h                    # Token expiry (default: 2 hours)
JWT_ALGORITHM=HS256              # Algorithm (default: HS256)
JWT_ISSUER=restaurant-app        # Issuer claim
NODE_ENV=development             # development|production
PORT=5000                        # Server port
CORS_ORIGIN=http://localhost:3000 # Frontend URL
DB_FILE=./db.json                # Database file path
```

### Algorithm Options

| Algorithm | Use Case | Security Level |
|-----------|----------|-----------------|
| HS256 | Server signing/verification | Medium (symmetric) |
| RS256 | Distributed systems | High (asymmetric) |
| ES256 | Mobile apps | High (elliptic curve) |
| PS256 | High-security systems | Very High |

**Recommendation:** Use HS256 for single-server deployments, RS256 for distributed systems.

### Token Expiry Options

| Duration | Use Case |
|----------|----------|
| 15 min | High-security banking |
| 1 hour | Standard web apps |
| 2 hours | Restaurant POS |
| 24 hours | Mobile apps with refresh |
| 7 days | Long-lived tokens |

**Recommendation:** 2-hour expiry + refresh token mechanism.

---

## Usage Examples

### JavaScript/Fetch

```javascript
// 1. Register
async function register(userData) {
  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return await response.json();
}

// 2. Login
async function login(email, password) {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // IMPORTANT: Include cookies
    body: JSON.stringify({ email, password })
  });
  
  if(!response.ok) {
    throw new Error('Login failed');
  }
  
  return await response.json();
}

// 3. Get Current User
async function getCurrentUser() {
  const response = await fetch('/api/me', {
    credentials: 'include'
  });
  
  if(response.status === 401) {
    return null; // Not logged in
  }
  
  return await response.json();
}

// 4. Logout
async function logout() {
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'include'
  });
}
```

### React Hook

```jsx
import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/me', {
        credentials: 'include'
      });

      if(response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch(err) {
      setError(err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      if(!response.ok) {
        throw new Error('Login failed');
      }

      await checkAuth();
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch(err) {
      setError(err.message);
    }
  }, []);

  return { user, loading, error, login, logout };
}

// Usage in component
function Dashboard() {
  const { user, logout } = useAuth();

  if(!user) {
    return <div>Not logged in</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.firstName}!</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### cURL Examples

```bash
# 1. Register
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

# 2. Login (save cookies)
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'

# 3. Get Current User (with cookies)
curl -X GET http://localhost:5000/api/me \
  -b cookies.txt

# 4. Logout
curl -X POST http://localhost:5000/api/logout \
  -b cookies.txt
```

---

## Security Best Practices

### 1. Secret Management

```javascript
// ❌ NEVER DO THIS
const JWT_SECRET = 'my-secret-123';

// ✅ ALWAYS DO THIS
const JWT_SECRET = process.env.JWT_SECRET;
if(!JWT_SECRET) {
  console.error('JWT_SECRET not set');
  process.exit(1);
}
```

**Production Checklist:**
- [ ] JWT_SECRET from environment variable
- [ ] Secret is 32+ characters
- [ ] Secret is random and cryptographically secure
- [ ] Secret never committed to git
- [ ] Secret rotated regularly (quarterly)
- [ ] Secret stored in secure vault (AWS Secrets Manager, etc.)

### 2. Token Security

```javascript
// ✅ Include security claims
const payload = {
  id: user.id,
  email: user.email,
  role: user.role,
  iat: Math.floor(Date.now() / 1000),  // Issued at
  nbf: Math.floor(Date.now() / 1000)   // Not before
};

// ✅ Set appropriate expiry
expiresIn: '2h'

// ✅ Verify all claims
jwt.verify(token, JWT_SECRET, {
  algorithms: ['HS256'],
  issuer: 'restaurant-app',
  maxAge: '2h'
});
```

**Token Security Checklist:**
- [ ] Short expiry time (1-2 hours)
- [ ] Refresh token mechanism implemented
- [ ] Token blacklist on logout
- [ ] No sensitive data in payload (passwords, etc.)
- [ ] Payload verified on every request
- [ ] Timing attack protection

### 3. Cookie Security

```javascript
// ✅ Secure cookie settings
res.cookie('rm_auth', token, {
  httpOnly: true,              // Prevent XSS
  secure: NODE_ENV === 'production', // HTTPS only
  sameSite: 'Strict',          // CSRF protection
  maxAge: 2 * 60 * 60 * 1000,  // 2 hours
  path: '/',                   // Root path only
  domain: 'yourdomain.com'     // Specific domain
});
```

**Cookie Security Checklist:**
- [ ] HttpOnly flag set
- [ ] Secure flag for production
- [ ] SameSite=Strict
- [ ] Appropriate maxAge
- [ ] Specific domain set

### 4. Rate Limiting

```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 requests per window
  message: 'Too many login attempts',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip // Per IP
});

app.post('/api/login', loginLimiter, async (req, res) => {
  // Login logic
});
```

**Rate Limiting Checklist:**
- [ ] Login rate limited (10 per 15 min)
- [ ] Register rate limited (5 per 15 min)
- [ ] Per-IP enforcement
- [ ] Appropriate error messages

### 5. CORS Configuration

```javascript
// ✅ Strict CORS in production
app.use(cors({
  origin: process.env.CORS_ORIGIN, // Specific origin
  credentials: true,                // Allow cookies
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  maxAge: 3600
}));
```

**CORS Checklist:**
- [ ] Specific origin set (not *)
- [ ] Credentials allowed
- [ ] Methods restricted to needed ones
- [ ] Headers whitelisted

### 6. HTTPS Enforcement

```javascript
// Production: enforce HTTPS
if(NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if(req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

---

## Token Lifecycle

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Token Lifecycle                      │
└─────────────────────────────────────────────────────────┘

1. LOGIN REQUEST
   User submits email + password
   ↓
2. SERVER GENERATES TOKEN
   - Create payload (user id, email, role)
   - Sign with JWT_SECRET
   - Set 2-hour expiry
   ↓
3. SERVER SENDS TOKEN
   - Set in HttpOnly cookie
   - Also send in response body (optional)
   ↓
4. CLIENT STORES TOKEN
   - Browser stores in cookie (automatically)
   - Or localStorage (less secure)
   ↓
5. CLIENT MAKES REQUEST
   - Include token in cookie or Authorization header
   - credentials: 'include' in fetch
   ↓
6. SERVER VALIDATES TOKEN
   - Extract token from cookie
   - Check blacklist
   - Verify signature
   - Check expiry
   - Check claims (iss, aud, etc.)
   ↓
7. GRANT ACCESS
   - Attach user to request
   - Execute endpoint logic
   ↓
8. LOGOUT REQUEST
   - Client sends logout request
   - Server adds token to blacklist
   - Server clears cookie
   - Client clears local state
   ↓
9. TOKEN EXPIRES
   - 2-hour expiry reached
   - Token no longer valid
   - Client redirected to login
   ↓
10. TOKEN CLEANUP
    - Blacklist entry removed after 2 hours
    - In-memory cleanup or Redis cleanup
```

### Request/Response Examples

**Login Request:**
```http
POST /api/login HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Login Response:**
```http
HTTP/1.1 200 OK
Set-Cookie: rm_auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; 
  HttpOnly; Secure; SameSite=Strict; Max-Age=7200; Path=/
Content-Type: application/json

{
  "ok": true,
  "message": "Login successful"
}
```

**Protected Request:**
```http
GET /api/me HTTP/1.1
Host: localhost:5000
Cookie: rm_auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Protected Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "user": {
    "id": 1698076800000,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "owner"
  }
}
```

---

## Troubleshooting

### Issue: "JWT_SECRET not set"

**Cause:** Environment variable not configured

**Solution:**

```bash
# Create .env file
echo "JWT_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')" > .env

# Or set environment variable
export JWT_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')

# Verify
echo $JWT_SECRET
```

### Issue: "Token expired"

**Cause:** Token's expiry time has passed

**Solution:**

```javascript
// Option 1: Increase expiry
expiresIn: '24h'  // Changed from 2h

// Option 2: Implement refresh token
POST /api/refresh

// Option 3: Redirect to login
if(error === 'Token expired') {
  window.location.href = '/login';
}
```

### Issue: "Invalid token"

**Cause:** Token signature verification failed (wrong secret, corrupted token, etc.)

**Solution:**

```javascript
// Verify token hasn't been modified
const token = req.cookies.rm_auth;
const { valid, error } = verifyToken(token);

if(!valid) {
  console.error('Token validation error:', error);
  return res.status(401).json({ error });
}

// Clear cookie and require re-login
res.clearCookie('rm_auth');
```

### Issue: "CORS error"

**Cause:** Frontend origin not allowed

**Solution:**

```javascript
// Check CORS_ORIGIN configuration
console.log('Allowed origin:', process.env.CORS_ORIGIN);

// Update .env
CORS_ORIGIN=http://localhost:3000

// Restart server
npm start
```

### Issue: "No token provided"

**Cause:** Cookie not included in request

**Solution:**

```javascript
// Client: Include credentials
fetch('/api/me', {
  credentials: 'include'  // CRITICAL!
});

// Server: Verify cookie parser is configured
app.use(cookieParser());

// Check if cookie is being set
console.log('Cookies:', req.cookies);
```

### Issue: "Cannot read property 'rm_auth' of undefined"

**Cause:** Cookie parser not configured before use

**Solution:**

```javascript
// CORRECT ORDER
const cookieParser = require('cookie-parser');

// Add before routes
app.use(cookieParser());

// Then use in routes
app.get('/api/me', (req, res) => {
  const token = req.cookies.rm_auth;
  // ...
});
```

---

## Advanced Topics

### 1. Refresh Token Mechanism

Implement separate refresh and access tokens:

```javascript
/**
 * Refresh token: Long-lived, stored in database
 * Access token: Short-lived (15 min), stateless
 */

app.post('/api/login', async (req, res) => {
  // ... verify credentials ...

  // Access token (short-lived)
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m'
  });

  // Refresh token (long-lived)
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: '7d'
  });

  // Store refresh token in database
  db.saveRefreshToken(user.id, refreshToken);

  // Send refresh token as secure cookie
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  // Send access token in response
  res.json({ accessToken });
});

app.post('/api/refresh', (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    
    // Verify token in database
    const stored = db.getRefreshToken(decoded.id);
    if(stored !== refreshToken) {
      throw new Error('Invalid refresh token');
    }

    // Issue new access token
    const newAccessToken = jwt.sign(
      { id: decoded.id, email: decoded.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  } catch(err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### 2. Role-Based Access Control (RBAC)

```javascript
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if(!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if(!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Usage
app.post(
  '/api/admin/users',
  authenticateToken,
  authorize('admin'),
  (req, res) => {
    // Only admins can access
  }
);
```

### 3. Token Revocation with Redis

For production, use Redis for better performance:

```javascript
const redis = require('redis');
const client = redis.createClient();

async function revokeToken(token, expiresIn) {
  // Get token expiry time
  const decoded = jwt.decode(token);
  const ttl = decoded.exp - Math.floor(Date.now() / 1000);

  // Store in Redis
  if(ttl > 0) {
    await client.setex(`blacklist:${token}`, ttl, '1');
  }
}

async function isTokenRevoked(token) {
  const result = await client.get(`blacklist:${token}`);
  return result !== null;
}

app.post('/api/logout', authenticateToken, async (req, res) => {
  const token = req.cookies.rm_auth;
  await revokeToken(token, 2 * 60 * 60); // 2 hours

  res.clearCookie('rm_auth');
  res.json({ ok: true });
});
```

### 4. Multiple Authentication Methods

Support both session cookies and Authorization header:

```javascript
function extractToken(req) {
  // Try cookie first
  if(req.cookies.rm_auth) {
    return req.cookies.rm_auth;
  }

  // Try Authorization header
  const auth = req.headers.authorization;
  if(auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }

  return null;
}

function authenticateToken(req, res, next) {
  const token = extractToken(req);

  if(!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const { valid, decoded, error } = verifyToken(token);

  if(!valid) {
    return res.status(401).json({ error });
  }

  req.user = decoded;
  next();
}
```

### 5. Token Audience Claims

Add audience validation for different client types:

```javascript
// Web app
const webToken = jwt.sign(
  { ...payload, aud: 'web' },
  JWT_SECRET,
  { expiresIn: '2h' }
);

// Mobile app
const mobileToken = jwt.sign(
  { ...payload, aud: 'mobile' },
  JWT_SECRET,
  { expiresIn: '24h' }  // Longer expiry for mobile
);

// Verify with audience
jwt.verify(token, JWT_SECRET, {
  audience: 'web'  // Only accept web tokens
});
```

---

## Performance Considerations

### Token Verification Time

- HS256: ~0.5ms per verification
- RS256: ~1-2ms per verification
- Bcryptjs compare: ~100ms (intentionally slow)

**Optimization:** Cache token verification for repeated requests

```javascript
const verificationCache = new Map();

function getCachedToken(token, ttl = 60000) {
  if(verificationCache.has(token)) {
    const cached = verificationCache.get(token);
    if(Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }
  return null;
}

function setCachedToken(token, data) {
  verificationCache.set(token, {
    data,
    timestamp: Date.now()
  });
}
```

### Recommended Limits

| Metric | Value |
|--------|-------|
| Max token size | 10KB |
| Max concurrent tokens per user | 5 |
| Max password attempts | 10 per 15 min |
| Token verification cache TTL | 60 seconds |
| Blacklist cleanup interval | 1 hour |

---

## Deployment Checklist

- [ ] JWT_SECRET configured in production
- [ ] NODE_ENV set to 'production'
- [ ] CORS_ORIGIN configured for frontend domain
- [ ] HTTPS enabled (redirect HTTP to HTTPS)
- [ ] Secure cookie flags enabled
- [ ] Rate limiting configured
- [ ] Database backup strategy
- [ ] Error monitoring (Sentry, etc.)
- [ ] Log all authentication attempts
- [ ] Token expiry appropriate (2h recommended)
- [ ] Refresh token mechanism implemented
- [ ] Redis for token blacklist (optional)
- [ ] Load testing completed
- [ ] Security audit completed

---

## Summary

JWT authentication provides a secure, stateless mechanism for user authentication. When properly configured with strong secrets, appropriate expiry times, secure cookies, and rate limiting, it offers excellent security for the Restaurant Management System.

**Key Takeaways:**

✅ Use environment variables for JWT_SECRET  
✅ Set short token expiry (2 hours)  
✅ Use HttpOnly, Secure, SameSite cookies  
✅ Implement rate limiting  
✅ Verify tokens on every request  
✅ Blacklist tokens on logout  
✅ Use HTTPS in production  
✅ Regular secret rotation  

---

## Additional Resources

- [JWT.io](https://jwt.io) - JWT documentation and debugger
- [RFC 7519](https://tools.ietf.org/html/rfc7519) - JWT specification
- [Express-Rate-Limit](https://github.com/nfriedly/express-rate-limit) - Rate limiting middleware
- [Jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) - JWT package docs
- [OWASP Authentication](https://owasp.org/www-project-authentication-cheat-sheet/) - OWASP guidelines

