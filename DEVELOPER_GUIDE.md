# Developer Guide - Restaurant Management System Backend

This guide provides comprehensive documentation for developers maintaining and extending the backend authentication system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Security Implementation](#security-implementation)
3. [Code Comments Reference](#code-comments-reference)
4. [Adding New Features](#adding-new-features)
5. [Troubleshooting](#troubleshooting)

## Architecture Overview

### Layered Security Approach

The backend implements a 4-layer security model:

```
Layer 1: Rate Limiting
  ↓ (Prevents brute-force attacks)
Layer 2: Input Validation & Sanitization
  ↓ (Validates format, prevents injection)
Layer 3: Authentication & Authorization
  ↓ (JWT tokens, secure cookies)
Layer 4: Error Handling
  ↓ (Generic messages, secure logging)
Response to Client
```

### Request Flow Example: User Registration

```
POST /api/register
    ↓
Global Rate Limiter (100 req/IP/15min)
    ↓
Register Rate Limiter (5 attempts/IP/15min)
    ↓
Middleware: bodyParser.json (max 10KB)
    ↓
CORS Validation
    ↓
Handler Function:
  1. Extract & sanitize inputs
  2. Validate email format
  3. Validate password strength
  4. Validate other fields
  5. Check for duplicate email
  6. Hash password with bcryptjs
  7. Save to database
  8. Return 201 Created
    ↓
Error Handling (if error at any step)
    ↓
Response to Client
```

## Security Implementation

### 1. Rate Limiting

**Purpose**: Prevent brute-force attacks and DoS attempts

**Configuration** (in `server.js`):
```javascript
// Registration limiter: 5 attempts per IP per 15 minutes
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: () => skipRateLimit,  // Disabled in test mode
});

// Login limiter: 10 failed attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,  // Only count failed logins
  skip: () => skipRateLimit,
});

// Global limiter: 100 requests per IP per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => skipRateLimit,
});
```

**Key Points**:
- Rate limiting is applied at multiple levels (global + endpoint-specific)
- Successful logins don't count toward login limit (prevents lockout of legitimate users)
- Disabled in test mode (`NODE_ENV === 'test'`) for rapid testing

### 2. Input Validation & Sanitization

**Purpose**: Prevent injection attacks (SQL, XSS) and invalid data

**Validation Functions**:

```javascript
// Email format validation using regex
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Password strength requirement
const validatePassword = (pwd) => pwd && pwd.length >= 8;

// String sanitization
const sanitizeString = (str) => String(str||'').trim().slice(0,255);
```

**Validation in Register Endpoint**:
```javascript
// 1. Sanitize all inputs first
const cleanEmail = sanitizeString(email).toLowerCase();
const cleanFirst = sanitizeString(firstName);

// 2. Validate format
if(!validateEmail(cleanEmail)) {
  return res.status(400).json({error:'Valid email is required'});
}

// 3. Validate field lengths
if(!cleanFirst || cleanFirst.length < 2) {
  return res.status(400).json({error:'First name must be at least 2 characters'});
}

// 4. Validate enum fields (whitelist approach)
if(!['owner','manager','staff'].includes(role)) {
  return res.status(400).json({error:'Invalid role'});
}
```

**Why This Matters**:
- Sanitization prevents buffer overflow attacks (255 char limit)
- Whitelist validation for enums prevents arbitrary values
- Lowercase email prevents case-sensitive duplicate detection

### 3. Password Security

**Algorithm**: Bcryptjs with 10 salt rounds

```javascript
// Hashing (during registration)
const hash = await bcrypt.hash(password, 10);

// Verification (during login)
const match = await bcrypt.compare(password, user.passwordHash);
```

**Why Bcryptjs?**
- Adaptive hashing: Salt rounds can increase as computers get faster
- Timing-safe comparison: Resistant to timing attacks
- Industry standard: Used by major companies

**Security Implications**:
- Never store plain passwords
- Never log passwords
- Password hash should never be sent to frontend

### 4. Session Management

**Mechanism**: JWT tokens + HttpOnly cookies

```javascript
// Create JWT token (2-hour expiry)
const token = jwt.sign(
  {id: user.id, email: user.email},
  JWT_SECRET,
  {expiresIn: '2h'}
);

// Set secure cookie
res.cookie('rm_auth', token, {
  httpOnly: true,        // Prevent XSS access
  secure: secure,        // Enforce HTTPS in production
  sameSite: 'Strict',    // Prevent CSRF attacks
  maxAge: 2 * 60 * 60 * 1000  // 2 hours
});
```

**Cookie Flags Explained**:
- `httpOnly: true` - JavaScript cannot access the cookie (protects against XSS)
- `secure: true` (production) - Only sent over HTTPS (prevents man-in-the-middle)
- `sameSite: 'Strict'` - Never sent with cross-site requests (prevents CSRF)
- `maxAge: 7200000` - Cookie expires after 2 hours

### 5. User Enumeration Prevention

**Vulnerability**: Attacker can determine if email exists by comparing login error messages

**Solution**: Unified error messages

```javascript
// DON'T do this (vulnerable):
const user = db.users.find(u => u.email === email);
if (!user) return res.status(401).json({error:'User not found'});  // Reveals user doesn't exist
if (!match) return res.status(401).json({error:'Wrong password'});  // Reveals user exists

// DO this instead (secure):
const user = db.users.find(u => u.email === email);
if (!user) return res.status(401).json({error:'Invalid credentials'});  // Generic message
if (!match) return res.status(401).json({error:'Invalid credentials'});  // Same message
```

**Test Example** (from `server.test.js`):
```javascript
it('login should use unified error for invalid email and password', async () => {
  // Both scenarios should return same status and message
  const res1 = await request(app)
    .post('/api/login')
    .send({email: 'nonexistent@test.com', password: 'Test1234'});
  
  const res2 = await request(app)
    .post('/api/login')
    .send({email: testEmail, password: 'WrongPassword'});
  
  expect(res1.status).toBe(401);
  expect(res2.status).toBe(401);
  expect(res1.body.error).toBe(res2.body.error);  // Same message
});
```

### 6. Environment Variable Management

**Production Safety**:

```javascript
// Production requires explicit JWT_SECRET
if(NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is required in production');
  process.exit(1);
}
```

**Environment Variables** (see `.env.example`):
```
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secure-random-secret-key-here
DB_FILE=./db.json
CORS_ORIGIN=*
```

**Production Setup**:
```bash
export NODE_ENV=production
export JWT_SECRET=$(openssl rand -base64 32)  # Generate 32-char random key
export CORS_ORIGIN=https://yourdomain.com
export DB_FILE=/var/lib/restaurant-app/db.json

npm start
```

## Code Comments Reference

### Understanding the Validation Pipeline

```javascript
app.post('/api/register', registerLimiter, async (req, res) => {
  try {
    // Step 1: Extract fields from request body
    const { firstName, lastName, email, password, restaurantName, role } = req.body;
    
    // Step 2: Sanitize (trim, limit length)
    const cleanEmail = sanitizeString(email).toLowerCase();
    const cleanFirst = sanitizeString(firstName);
    
    // Step 3: Validate email format
    if(!cleanEmail || !validateEmail(cleanEmail)) {
      return res.status(400).json({error:'Valid email is required'});
    }
    
    // Step 4: Validate password strength
    if(!password || !validatePassword(password)) {
      return res.status(400).json({error:'Password must be at least 8 characters'});
    }
    
    // Step 5: Check duplicate email
    const db = readDB();
    if(db.users.find(u=>u.email === cleanEmail)){
      return res.status(409).json({error:'User already exists'});
    }
    
    // Step 6: Hash password
    const hash = await bcrypt.hash(password, 10);
    
    // Step 7: Save user
    const user = {
      id: Date.now(),
      firstName: cleanFirst,
      lastName: cleanLast,
      email: cleanEmail,
      passwordHash: hash,  // Hashed, never plain text
      restaurantName: cleanRestaurant,
      role,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    writeDB(db);
    
    // Step 8: Return success (never expose passwordHash)
    res.status(201).json({id:user.id, email:user.email, message:'User created successfully'});
  }catch(e){
    // Step 9: Error handling (generic message, log details)
    console.error('Register error:', e.message);
    res.status(500).json({error:'Registration failed'});
  }
});
```

### Understanding Authentication Flow

```javascript
app.get('/api/me', (req, res) => {
  try {
    // Step 1: Extract token from HttpOnly cookie
    const token = req.cookies.rm_auth;
    if(!token) return res.status(401).json({error:'Not authenticated'});
    
    // Step 2: Verify JWT signature and check expiry
    // This will throw TokenExpiredError if expired
    const data = jwt.verify(token, JWT_SECRET);
    
    // Step 3: Lookup user in database (token could be forged)
    const db = readDB();
    const user = db.users.find(u=>u.id === data.id);
    if(!user) return res.status(401).json({error:'User not found'});
    
    // Step 4: Remove sensitive data before returning
    const {passwordHash, ...safe} = user;
    res.json({user:safe});
  }catch(e){
    // Step 5: Handle specific errors
    if(e.name === 'TokenExpiredError') {
      res.clearCookie('rm_auth');  // Clean up expired cookie
      return res.status(401).json({error:'Session expired'});
    }
    res.status(401).json({error:'Invalid token'});
  }
});
```

## Adding New Features

### Example: Add Email Verification

```javascript
// 1. Update user schema (db.json structure)
const user = {
  id: Date.now(),
  firstName: cleanFirst,
  lastName: cleanLast,
  email: cleanEmail,
  passwordHash: hash,
  emailVerified: false,        // NEW: Track verification status
  emailVerifyToken: uuid.v4(), // NEW: Token for verification
  emailVerifyExpiry: Date.now() + 24 * 60 * 60 * 1000,  // 24 hours
  restaurantName: cleanRestaurant,
  role,
  createdAt: new Date().toISOString()
};

// 2. Add new endpoint
app.post('/api/verify-email/:token', (req, res) => {
  try {
    const {token} = req.params;
    const db = readDB();
    
    // Find user by verification token
    const user = db.users.find(u => u.emailVerifyToken === token);
    if(!user) return res.status(404).json({error:'Invalid token'});
    
    // Check token expiry
    if(Date.now() > user.emailVerifyExpiry) {
      return res.status(401).json({error:'Token expired'});
    }
    
    // Mark email as verified
    user.emailVerified = true;
    user.emailVerifyToken = null;  // Clear token
    writeDB(db);
    
    res.json({ok:true, message:'Email verified successfully'});
  }catch(e){
    console.error('Email verification error:', e.message);
    res.status(500).json({error:'Verification failed'});
  }
});

// 3. Update login to check verification
if(!user.emailVerified) {
  return res.status(403).json({error:'Please verify your email before logging in'});
}

// 4. Add test cases
it('should require email verification before login', async () => {
  // Register user
  await request(app).post('/api/register').send({...validUser});
  
  // Try to login (should fail - not verified)
  const res = await request(app)
    .post('/api/login')
    .send({email: validUser.email, password: validUser.password});
  
  expect(res.status).toBe(403);
  expect(res.body.error).toContain('verify your email');
});
```

### Example: Add Password Reset

```javascript
// 1. Add reset token to user schema
const user = {
  // ... existing fields
  resetToken: null,
  resetTokenExpiry: null
};

// 2. New endpoint: Request password reset
app.post('/api/forgot-password', async (req, res) => {
  try {
    const {email} = req.body;
    const cleanEmail = sanitizeString(email).toLowerCase();
    
    if(!validateEmail(cleanEmail)) {
      return res.status(400).json({error:'Valid email is required'});
    }
    
    const db = readDB();
    const user = db.users.find(u => u.email === cleanEmail);
    
    // Same message whether user exists or not (prevent enumeration)
    if(!user) {
      return res.status(200).json({message:'If email exists, reset link will be sent'});
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 60 * 60 * 1000;  // 1 hour
    writeDB(db);
    
    // TODO: Send email with reset link
    // const resetLink = `https://yourdomain.com/reset-password?token=${resetToken}`;
    // await sendEmail(user.email, 'Password Reset', `Click here: ${resetLink}`);
    
    res.status(200).json({message:'If email exists, reset link will be sent'});
  }catch(e){
    console.error('Forgot password error:', e.message);
    res.status(500).json({error:'Request failed'});
  }
});

// 3. New endpoint: Reset password with token
app.post('/api/reset-password', async (req, res) => {
  try {
    const {token, newPassword} = req.body;
    
    if(!validatePassword(newPassword)) {
      return res.status(400).json({error:'Password must be at least 8 characters'});
    }
    
    const db = readDB();
    const user = db.users.find(u => u.resetToken === token);
    
    if(!user || Date.now() > user.resetTokenExpiry) {
      return res.status(401).json({error:'Invalid or expired token'});
    }
    
    // Hash new password
    const hash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hash;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    writeDB(db);
    
    res.json({ok:true, message:'Password reset successfully'});
  }catch(e){
    console.error('Reset password error:', e.message);
    res.status(500).json({error:'Reset failed'});
  }
});
```

## Troubleshooting

### Issue: Tests fail with "Rate limit exceeded"

**Cause**: Rate limiters were enabled during testing

**Solution**: Verify `NODE_ENV` is set to 'test' in tests
```javascript
// In server.test.js
process.env.NODE_ENV = 'test';
```

### Issue: JWT_SECRET error in production

**Cause**: Missing environment variable

**Solution**: 
```bash
export JWT_SECRET=$(openssl rand -base64 32)
npm start
```

### Issue: "SameSite cookie warning" in browser

**Cause**: Cookie flags not properly set

**Solution**: Verify cookie configuration in login endpoint
```javascript
res.cookie('rm_auth', token, {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: 'Strict',  // Must be capital 'S'
  maxAge: 2 * 60 * 60 * 1000
});
```

### Issue: Credentials not being sent with fetch requests

**Cause**: Frontend not including credentials

**Solution**: Add credentials to fetch
```javascript
fetch('/api/me', {
  credentials: 'include'  // Include cookies in request
});
```

---

**Next Steps**:
- Review test cases in `server.test.js` for usage examples
- Check `SECURITY.md` for production deployment checklist
- Read `API.md` for complete endpoint reference
