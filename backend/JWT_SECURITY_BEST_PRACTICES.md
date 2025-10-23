# 🔒 JWT Security Best Practices & Implementation

## Executive Summary

This document outlines critical security considerations and best practices for JWT authentication implementation in the Restaurant Management System. Follow these guidelines to ensure maximum security.

---

## Table of Contents

1. [Secret Management](#secret-management)
2. [Token Security](#token-security)
3. [Cookie Security](#cookie-security)
4. [Endpoint Security](#endpoint-security)
5. [Attack Prevention](#attack-prevention)
6. [Monitoring & Detection](#monitoring--detection)
7. [Incident Response](#incident-response)
8. [Compliance](#compliance)

---

## Secret Management

### 1. JWT Secret Generation

**❌ NEVER DO THIS:**
```javascript
// DO NOT HARDCODE
const JWT_SECRET = 'my-secret-123';

// DO NOT USE WEAK SECRETS
const JWT_SECRET = 'secret';

// DO NOT USE DEFAULT VALUES
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// DO NOT USE TIMESTAMPS OR SEQUENTIAL VALUES
const JWT_SECRET = Date.now().toString();
```

**✅ ALWAYS DO THIS:**
```javascript
// Use cryptographically secure random values
const crypto = require('crypto');
const JWT_SECRET = crypto.randomBytes(32).toString('hex');

// Verify length (minimum 32 characters for HS256)
if(JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

// Store in environment variable
// Never in code, never in version control
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

if(!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set');
  process.exit(1);
}
```

### 2. Secret Storage

**Development:**
```
✅ Store in .env file (local machine only)
✅ Add .env to .gitignore
✅ Create .env.example with placeholder
✅ Never commit .env file
```

**Production:**
```
✅ AWS Secrets Manager
✅ HashiCorp Vault
✅ Azure Key Vault
✅ Google Cloud Secret Manager
✅ Environment variables (from secure deployment)
```

### 3. Secret Rotation

**Frequency:** Quarterly (every 3 months)

**Process:**
```
1. Generate new JWT_SECRET
2. Deploy with both old and new secrets
3. Accept tokens signed with either secret for 1 hour
4. Update client applications
5. Remove old secret
6. Monitor for authentication issues
```

**Implementation:**
```javascript
const JWT_SECRETS = {
  current: process.env.JWT_SECRET,
  previous: process.env.JWT_SECRET_PREVIOUS || null
};

function verifyTokenWithRotation(token) {
  // Try current secret first
  try {
    return jwt.verify(token, JWT_SECRETS.current);
  } catch(err) {
    // Try previous secret for backward compatibility
    if(JWT_SECRETS.previous) {
      try {
        return jwt.verify(token, JWT_SECRETS.previous);
      } catch(e) {
        throw err;
      }
    }
    throw err;
  }
}
```

### 4. Secret Compromise Response

**If JWT_SECRET is compromised:**

1. **Immediate (0-5 minutes):**
   - [ ] Generate new JWT_SECRET
   - [ ] Deploy new secret to servers
   - [ ] Clear all token blacklist entries

2. **Short-term (5-30 minutes):**
   - [ ] Invalidate all active sessions
   - [ ] Force all users to re-login
   - [ ] Enable enhanced monitoring

3. **Medium-term (30 min - 2 hours):**
   - [ ] Review access logs
   - [ ] Identify compromised accounts
   - [ ] Reset passwords for affected users

4. **Long-term (ongoing):**
   - [ ] Post-mortem analysis
   - [ ] Update security procedures
   - [ ] Implement additional monitoring

---

## Token Security

### 1. Appropriate Expiry Times

**Recommended Times:**

| Application Type | Expiry | Reason |
|------------------|--------|--------|
| High-security banking | 15 minutes | Minimal exposure window |
| Standard web app | 1 hour | Balance security and UX |
| Restaurant POS | 2 hours | Continuous operation |
| Mobile app | 24 hours | Offline capability |

**Implementation:**
```javascript
const TOKEN_EXPIRY = {
  development: '24h',    // Longer for development
  production: '2h',      // Shorter for production
  mobile: '24h',         // Longer for mobile
  admin: '1h'            // Shorter for admin panel
};

const tokenExpiry = TOKEN_EXPIRY[NODE_ENV] || '2h';

const token = jwt.sign(payload, JWT_SECRET, {
  expiresIn: tokenExpiry
});
```

### 2. Token Content (Payload)

**✅ SAFE to include:**
```javascript
{
  id: user.id,              // User ID
  email: user.email,        // Email
  role: user.role,          // Role for authorization
  iat: 1234567890,          // Issued at
  exp: 1234571490           // Expiration
}
```

**❌ NEVER include:**
```javascript
{
  password: user.password,           // Password
  passwordHash: user.passwordHash,   // Password hash
  creditCard: user.creditCard,       // Financial data
  ssn: user.ssn,                     // Social security
  apiKey: user.apiKey,               // API keys
  secret: user.apiSecret             // Secrets
}
```

**Why?** JWT tokens can be decoded (but not verified) by anyone. Sensitive data will be visible.

### 3. Token Claims Validation

```javascript
function createSecureToken(user) {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    // Standard claims (RFC 7519)
    iss: 'restaurant-app',           // Issuer
    sub: user.id.toString(),         // Subject (user ID)
    aud: 'restaurant-users',         // Audience
    iat: now,                        // Issued at
    exp: now + (2 * 60 * 60),        // Expiration (2 hours)
    nbf: now,                        // Not before (immediately)
    
    // Custom claims
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256'
  });
}

function verifySecureToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'restaurant-app',
    audience: 'restaurant-users',
    clockTolerance: 10  // 10 seconds clock skew tolerance
  });
}
```

### 4. Token Revocation (Blacklist)

**In-Memory (Development):**
```javascript
const tokenBlacklist = new Set();

app.post('/api/logout', authenticateToken, (req, res) => {
  const token = req.cookies.rm_auth;
  const decoded = jwt.decode(token);
  
  // Calculate TTL
  const now = Math.floor(Date.now() / 1000);
  const ttl = decoded.exp - now;
  
  // Add to blacklist
  tokenBlacklist.add(token);
  
  // Auto-cleanup
  setTimeout(() => {
    tokenBlacklist.delete(token);
  }, ttl * 1000);
  
  res.clearCookie('rm_auth');
  res.json({ ok: true });
});
```

**Redis (Production):**
```javascript
const redis = require('redis');
const client = redis.createClient();

async function revokeToken(token) {
  const decoded = jwt.decode(token);
  const now = Math.floor(Date.now() / 1000);
  const ttl = decoded.exp - now;

  if(ttl > 0) {
    await client.setex(`blacklist:${token}`, ttl, '1');
  }
}

async function isTokenRevoked(token) {
  const exists = await client.exists(`blacklist:${token}`);
  return exists === 1;
}

function authenticateToken(req, res, next) {
  const token = req.cookies.rm_auth;
  
  if(!token) {
    return res.status(401).json({ error: 'No token' });
  }

  // Check blacklist
  isTokenRevoked(token).then(revoked => {
    if(revoked) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    const { valid, decoded } = verifyToken(token);
    if(!valid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    next();
  });
}
```

---

## Cookie Security

### 1. Cookie Configuration

```javascript
// ✅ SECURE CONFIGURATION
res.cookie('rm_auth', token, {
  httpOnly: true,              // Prevent JavaScript access (XSS protection)
  secure: NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'Strict',          // CSRF protection (strictest option)
  maxAge: 2 * 60 * 60 * 1000,  // 2 hours in milliseconds
  path: '/',                   // Root path
  domain: 'yourdomain.com'     // Specific domain (production)
});
```

**Flag Explanations:**

| Flag | Value | Purpose |
|------|-------|---------|
| httpOnly | true | Prevents JavaScript access (stops XSS attacks) |
| secure | true (prod) | HTTPS only (prevents man-in-the-middle) |
| sameSite | Strict | Prevents CSRF attacks |
| maxAge | 7200000 | 2-hour expiry |
| path | / | Available to entire domain |
| domain | yourdomain.com | Specific domain only |

### 2. SameSite Values

```javascript
// STRICT (Recommended for most apps)
sameSite: 'Strict'
// Cookie sent only in first-party context
// Never sent with cross-site requests

// LAX (Alternative if needed)
sameSite: 'Lax'
// Cookie sent in first-party context
// Sent with top-level navigation (GET requests)
// Not sent with forms or images from other sites

// NONE (Not recommended without Secure flag)
sameSite: 'None'
// Cookie sent with all requests
// REQUIRES Secure: true
sameSite: 'None',
secure: true
```

### 3. Cookie Clearing on Logout

```javascript
app.post('/api/logout', authenticateToken, async (req, res) => {
  const token = req.cookies.rm_auth;

  // 1. Blacklist the token
  await revokeToken(token);

  // 2. Clear the cookie
  res.clearCookie('rm_auth', {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/'
  });

  // 3. Return success
  res.json({ ok: true, message: 'Logged out successfully' });
});
```

---

## Endpoint Security

### 1. Registration Endpoint Security

```javascript
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 attempts per IP
  message: 'Too many registration attempts',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

app.post('/api/register', registrationLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password, restaurantName, role } = req.body;

    // Input validation
    if(!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    if(!validatePassword(password)) {
      return res.status(400).json({ 
        error: 'Password must be 8+ chars with uppercase, lowercase, digit, and special char' 
      });
    }

    // Check for duplicate
    const existing = users.find(u => u.email === email);
    if(existing) {
      // Don't reveal user exists (user enumeration prevention)
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: Date.now(),
      firstName: sanitizeString(firstName),
      lastName: sanitizeString(lastName),
      email: email.toLowerCase(),
      passwordHash: hash,
      restaurantName: sanitizeString(restaurantName),
      role: role,
      createdAt: new Date()
    };

    users.push(user);

    res.status(201).json({
      id: user.id,
      email: user.email,
      message: 'User created successfully'
    });
  } catch(error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});
```

### 2. Login Endpoint Security

```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 failed attempts per IP
  message: 'Too many login attempts. Try again later.',
  skipSuccessfulRequests: true // Don't count successful logins
});

app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if(!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if(!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid credentials' }); // Generic message
    }

    // Find user
    const user = users.find(u => u.email === email.toLowerCase());

    if(!user) {
      // Delay response to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Timing-safe password comparison
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if(!isValid) {
      // Delay response
      await new Promise(resolve => setTimeout(resolve, 100));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate secure token
    const token = generateToken(user);

    // Set secure cookie
    res.cookie('rm_auth', token, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 2 * 60 * 60 * 1000,
      path: '/'
    });

    // Log successful login
    console.log(`[AUTH] User ${user.email} logged in at ${new Date().toISOString()}`);

    res.json({ ok: true, message: 'Login successful' });
  } catch(error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});
```

### 3. Protected Endpoint Security

```javascript
function authenticateToken(req, res, next) {
  try {
    const token = req.cookies.rm_auth;

    if(!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Check blacklist
    if(isTokenRevoked(token)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'restaurant-app',
      audience: 'restaurant-users'
    });

    // Attach user
    req.user = decoded;

    // Log access
    console.log(`[AUTH] User ${decoded.email} accessed protected resource`);

    next();
  } catch(error) {
    if(error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }

    if(error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    return res.status(401).json({ error: 'Authentication failed' });
  }
}

app.get('/api/me', authenticateToken, (req, res) => {
  // req.user is the decoded token
  const user = users.find(u => u.id === parseInt(req.user.id));

  if(!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }
  });
});
```

---

## Attack Prevention

### 1. Brute Force Prevention

```javascript
// Rate limiting (already covered)
// + Account lockout mechanism
// + Progressive delays

const loginAttempts = new Map();

function isAccountLocked(email) {
  const attempts = loginAttempts.get(email) || { count: 0, timestamp: Date.now() };
  
  // Reset after 15 minutes
  if(Date.now() - attempts.timestamp > 15 * 60 * 1000) {
    loginAttempts.delete(email);
    return false;
  }

  return attempts.count >= 10;
}

function recordFailedAttempt(email) {
  const attempts = loginAttempts.get(email) || { count: 0, timestamp: Date.now() };
  attempts.count++;
  loginAttempts.set(email, attempts);
}

function clearAttempts(email) {
  loginAttempts.delete(email);
}
```

### 2. User Enumeration Prevention

```javascript
// ❌ REVEALS USER EXISTS
if(!user) {
  return res.status(401).json({ error: 'User not found' });
}

// ✅ GENERIC MESSAGE
if(!user) {
  // Delay response to prevent timing attacks
  await new Promise(resolve => setTimeout(resolve, 100));
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Similar for registration
// ❌ REVEALS EMAIL EXISTS
const existing = users.find(u => u.email === email);
if(existing) {
  return res.status(400).json({ error: 'Email already registered' });
}

// ✅ STILL REJECTS BUT WITH GENERIC MESSAGE
if(existing) {
  return res.status(400).json({ error: 'Email already registered' });
  // Only mention that it's already registered, don't confirm user exists
}
```

### 3. CSRF Prevention

```javascript
// Use SameSite cookies (already configured)
res.cookie('rm_auth', token, {
  sameSite: 'Strict'  // This is CSRF protection
});

// Optional: CSRF token for additional protection
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

app.post('/api/login', csrfProtection, (req, res) => {
  // Verify CSRF token
  // Token should be in request headers or body
});
```

### 4. XSS Prevention

```javascript
// Use HttpOnly cookies (prevents JavaScript access)
res.cookie('rm_auth', token, {
  httpOnly: true  // JavaScript cannot access this cookie
});

// Input sanitization
function sanitizeString(input) {
  if(typeof input !== 'string') return '';
  
  return input
    .replace(/[<>\"']/g, '') // Remove HTML characters
    .trim()
    .substring(0, 255);      // Limit length
}

// Content Security Policy header
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  next();
});
```

### 5. Token Hijacking Prevention

```javascript
// IP Address Binding (optional)
function createSecureToken(user, ipAddress) {
  return jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role,
    ip: ipAddress  // Bind token to IP address
  }, JWT_SECRET, {
    expiresIn: '2h'
  });
}

function verifyTokenWithIP(token, ipAddress) {
  const decoded = jwt.verify(token, JWT_SECRET);
  
  if(decoded.ip !== ipAddress) {
    throw new Error('Token IP mismatch');
  }

  return decoded;
}

// Device fingerprinting (advanced)
const fingerprint = require('express-fingerprint');
app.use(fingerprint({
  parameters: [
    fingerprint.parsers.useragent,
    fingerprint.parsers.acceptLanguage,
    fingerprint.parsers.geoip
  ]
}));
```

---

## Monitoring & Detection

### 1. Audit Logging

```javascript
function logAuthEvent(event, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    event: event,
    details: details,
    level: 'INFO'
  };

  console.log(`[AUTH] ${JSON.stringify(entry)}`);
  
  // Also log to file or database
  // fs.appendFileSync('auth.log', JSON.stringify(entry) + '\n');
}

// Usage
logAuthEvent('LOGIN_SUCCESS', { email: 'user@example.com', ip: req.ip });
logAuthEvent('LOGIN_FAILED', { email: 'user@example.com', ip: req.ip, reason: 'Invalid password' });
logAuthEvent('RATE_LIMIT', { ip: req.ip, endpoint: '/api/login' });
```

### 2. Anomaly Detection

```javascript
// Track login patterns
const loginPatterns = new Map();

function recordLogin(email, ipAddress) {
  if(!loginPatterns.has(email)) {
    loginPatterns.set(email, []);
  }

  const logins = loginPatterns.get(email);
  logins.push({ timestamp: Date.now(), ip: ipAddress });

  // Keep only last 50 logins
  if(logins.length > 50) {
    logins.shift();
  }
}

function detectAnomaly(email, ipAddress) {
  const logins = loginPatterns.get(email) || [];

  if(logins.length === 0) {
    return false; // First login, not anomalous
  }

  // Check if new IP address
  const ips = new Set(logins.map(l => l.ip));
  if(!ips.has(ipAddress)) {
    console.warn(`[SECURITY] New IP detected for ${email}: ${ipAddress}`);
    return true;
  }

  // Check if unusual login time
  const now = new Date().getHours();
  const loginHours = new Set(logins.map(l => new Date(l.timestamp).getHours()));
  
  if(!loginHours.has(now)) {
    console.warn(`[SECURITY] Unusual login time for ${email}: ${now}:00`);
    return true;
  }

  return false;
}
```

### 3. Metrics Dashboard

```javascript
const metrics = {
  loginAttempts: 0,
  successfulLogins: 0,
  failedLogins: 0,
  registrations: 0,
  rateLimitTriggered: 0,
  tokenExpired: 0
};

function incrementMetric(metric) {
  metrics[metric]++;
  
  // Log every 100 events
  const total = Object.values(metrics).reduce((a, b) => a + b, 0);
  if(total % 100 === 0) {
    console.log('[METRICS]', metrics);
  }
}

// Usage
app.post('/api/login', (req, res) => {
  incrementMetric('loginAttempts');
  // ...
  if(loginSuccess) {
    incrementMetric('successfulLogins');
  } else {
    incrementMetric('failedLogins');
  }
});
```

---

## Incident Response

### Suspected Compromise

**Response Timeline:**

```
T+0:00  - Issue detected
T+0:05  - Declare incident
T+0:10  - Generate new JWT_SECRET
T+0:15  - Deploy new secret
T+0:20  - Invalidate all sessions
T+0:30  - Notify users
T+1:00  - Review access logs
T+2:00  - Complete analysis
T+4:00  - Post-mortem meeting
```

**Checklist:**

- [ ] Assess scope (number of affected users)
- [ ] Generate new JWT_SECRET immediately
- [ ] Deploy new secret to all servers
- [ ] Clear token blacklist
- [ ] Invalidate all active sessions
- [ ] Force all users to re-login
- [ ] Review authentication logs for suspicious activity
- [ ] Identify compromised accounts
- [ ] Reset passwords for affected users
- [ ] Enable enhanced monitoring
- [ ] Send incident notification to users
- [ ] Document incident details
- [ ] Conduct security review
- [ ] Implement preventive measures

---

## Compliance

### GDPR Requirements

- [ ] User consent for cookie storage
- [ ] Cookie privacy notice displayed
- [ ] Users can request data deletion
- [ ] Personal data minimized in tokens
- [ ] Secure data storage
- [ ] Regular security audits

### OWASP Top 10

| Issue | Mitigation |
|-------|-----------|
| A01: Broken Access Control | Implement proper authorization |
| A02: Cryptographic Failures | Use strong encryption for secrets |
| A03: Injection | Input validation and sanitization |
| A04: Insecure Design | Security-first architecture |
| A05: Security Misconfiguration | Proper environment setup |
| A06: Vulnerable Components | Keep dependencies updated |
| A07: Authentication Failures | Strong password + 2FA (optional) |
| A08: Data Integrity Failures | Token signature verification |
| A09: Logging Gaps | Audit logging implemented |
| A10: SSRF | Validate all user inputs |

### PCI DSS (If handling payments)

- [ ] Strong password policy
- [ ] Encrypt sensitive data in transit
- [ ] Encrypt sensitive data at rest
- [ ] Regular security testing
- [ ] Maintain secure systems
- [ ] Implement access control
- [ ] Identify and protect cardholder data
- [ ] Monitor network access

---

## Summary

Implementing JWT authentication securely requires attention to:

1. **Secrets:** Strong generation, secure storage, regular rotation
2. **Tokens:** Appropriate expiry, minimal claims, proper revocation
3. **Cookies:** Secure flags, HttpOnly, SameSite
4. **Endpoints:** Input validation, rate limiting, error security
5. **Attacks:** Brute force prevention, XSS protection, CSRF prevention
6. **Monitoring:** Audit logging, anomaly detection, alerting

Follow these best practices to ensure a robust and secure JWT authentication system.

