/**
 * Restaurant Management System - Backend Authentication Server
 * 
 * This backend provides secure user registration and authentication for the restaurant management app.
 * 
 * Key Security Features:
 * - Bcryptjs password hashing (10 salt rounds)
 * - JWT-based session tokens (2-hour expiry)
 * - HttpOnly, Secure, SameSite cookies for session persistence
 * - Express rate limiting for brute-force protection
 * - Input validation and sanitization on all endpoints
 * - Unified error messages to prevent user enumeration
 * - Environment-based configuration for production safety
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();

// ==================== Configuration ====================
// Load environment variables - NEVER use hardcoded secrets
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');

// JWT_SECRET: ALWAYS required from environment, NEVER hardcoded
// Security: Even in development, use environment variables to prevent accidental commits of secrets
// Generate a secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
if(!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is REQUIRED');
  console.error('In development, create a .env file with: JWT_SECRET=<your-secret>');
  console.error('Generate a secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// ==================== Middleware Configuration ====================
// Body parser: Limit payload to 10KB to prevent DoS attacks
app.use(bodyParser.json({limit:'10kb'}));
app.use(bodyParser.urlencoded({limit:'10kb'}));

// Cookie parser: Enable cookie parsing for session management
app.use(cookieParser());

// ==================== Security Headers & CORS Configuration ====================
/**
 * CORS Configuration - Strict origin control for production
 * 
 * Security:
 * - Development (NODE_ENV !== 'production'): localhost:3000 only
 * - Production: CORS_ORIGIN environment variable (REQUIRED, no fallback)
 * 
 * If CORS_ORIGIN is not set in production, server will not start.
 * This prevents accidentally allowing all origins in production.
 */

// CORS_ORIGIN configuration with production safety checks
let corsOrigin = process.env.CORS_ORIGIN;

if(NODE_ENV === 'production') {
  if(!corsOrigin) {
    console.error('FATAL ERROR: CORS_ORIGIN environment variable is REQUIRED in production');
    console.error('Set CORS_ORIGIN to your frontend domain (e.g., https://yourdomain.com)');
    process.exit(1);
  }
  // Production: Validate CORS_ORIGIN is a valid URL
  try {
    new URL(corsOrigin);
  } catch(e) {
    console.error('FATAL ERROR: CORS_ORIGIN must be a valid URL in production');
    console.error('Example: CORS_ORIGIN=https://yourdomain.com');
    process.exit(1);
  }
} else {
  // Development: Default to localhost
  corsOrigin = corsOrigin || 'http://localhost:3000';
}

// Apply CORS middleware with strict configuration
app.use(cors({
  origin: corsOrigin,
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

// Add security headers to all responses
app.use((req, res, next) => {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Enable XSS protection in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Disable content security policy (can be customized)
  res.setHeader('Content-Security-Policy', 'default-src \'self\'');
  // Disable referrer information to third parties
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ==================== Rate Limiting Middleware ====================
/**
 * Rate limiting is crucial for preventing brute-force attacks against:
 * 1. Registration endpoint: Prevents rapid account creation attacks
 * 2. Login endpoint: Protects against password guessing attempts
 * 3. Global limiter: Provides general DoS protection
 * 
 * These are disabled in test mode (NODE_ENV === 'test') to allow rapid test execution.
 * In production, rate limits are enforced across all endpoints.
 */

// Flag to disable rate limiting in test environment
const skipRateLimit = NODE_ENV === 'test';

/**
 * Registration Rate Limiter
 * Limits: 5 attempts per IP per 15 minutes
 * Purpose: Prevent rapid account creation spam/abuse
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registration attempts per IP
  message: 'Too many registration attempts, please try again later',
  standardHeaders: false, // Don't send RateLimit-* headers
  legacyHeaders: false,
  skip: () => skipRateLimit, // Disable in test mode
});

/**
 * Login Rate Limiter
 * Limits: 10 attempts per IP per 15 minutes
 * Special: skipSuccessfulRequests ignores successful logins (only counts failures)
 * Purpose: Prevent brute-force password guessing attacks
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per IP
  message: 'Too many login attempts, please try again later',
  standardHeaders: false,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed login attempts
  skip: () => skipRateLimit, // Disable in test mode
});

/**
 * Global Rate Limiter
 * Limits: 100 requests per IP per 15 minutes
 * Purpose: General DoS protection for all endpoints
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  standardHeaders: false,
  legacyHeaders: false,
  skip: () => skipRateLimit, // Disable in test mode
});

// Apply global rate limiter to all routes
app.use(globalLimiter);

// ==================== JWT Token Blacklist System ====================
/**
 * Token Blacklist for Enhanced Logout Security
 * 
 * Purpose: Allow immediate logout by blacklisting JWT tokens
 * Without blacklist: User token remains valid until expiry (2 hours)
 * With blacklist: User token is immediately revoked on logout
 * 
 * In production, use Redis for:
 * - Distributed token blacklist across multiple servers
 * - Automatic expiry of blacklist entries
 * - Persistent storage
 * 
 * For development, use in-memory storage (cleared on server restart)
 */

// Store blacklisted tokens: {token: expiryTimestamp}
// In production: Replace with Redis.set(token, true, 'EX', remainingTime)
const tokenBlacklist = new Map();

/**
 * Add token to blacklist
 * @param {string} token - JWT token to blacklist
 * @param {number} expiresIn - Token expiry time in milliseconds
 */
function blacklistToken(token, expiresIn) {
  const expiryTime = Date.now() + expiresIn;
  tokenBlacklist.set(token, expiryTime);
  
  // Cleanup: Remove expired tokens from blacklist after expiry
  setTimeout(() => {
    tokenBlacklist.delete(token);
  }, expiresIn);
}

/**
 * Check if token is blacklisted
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is blacklisted, false otherwise
 */
function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token);
}

/**
 * Get blacklist statistics (for monitoring)
 * @returns {Object} Blacklist size and memory usage info
 */
function getBlacklistStats() {
  return {
    blacklistedTokens: tokenBlacklist.size,
    timestamp: new Date().toISOString()
  };
}

// ==================== Input Validation & Sanitization ====================
/**
 * Security Layer 1: Input Validation
 * These functions validate user input format before processing
 * Prevents: SQL Injection, NoSQL Injection, XSS, Command Injection
 */

/**
 * Validate email format with strict rules
 * @param {string} email - Email to validate
 * @returns {boolean} True if email format is valid
 * 
 * Pattern breakdown:
 * ^[^\s@]+ - Local part: no spaces/@ symbols
 * @[^\s@]+ - At symbol followed by domain without spaces/@
 * \.[^\s@]+ - TLD: dot followed by domain extension
 * 
 * Prevents:
 * - Space injection attacks
 * - Double @ symbols (allows XSS)
 * - Missing TLD (prevents invalid domains)
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false; // RFC 5321
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if phone format is valid (or empty)
 * 
 * Pattern: Optional international format
 * - Allows digits, +, -, (), spaces only
 * - Min 7 chars (e.g., 555-0000)
 * - Max 20 chars (longest international format)
 * 
 * Prevents:
 * - Script injection through phone field
 * - SQL injection characters
 */
const validatePhone = (phone) => {
  if (!phone || phone === '') return true; // Phone is optional
  if (typeof phone !== 'string') return false;
  if (phone.length < 7 || phone.length > 20) return false;
  return /^[\d\s+\-()]*$/.test(phone);
};

/**
 * Validate name format (firstName, lastName)
 * @param {string} name - Name to validate
 * @returns {boolean} True if name format is valid
 * 
 * Pattern: Alphabetic characters, hyphens, apostrophes, spaces only
 * - Min 2 characters (single letter + space = invalid)
 * - Max 50 characters (prevent buffer overflow)
 * 
 * Prevents:
 * - Script injection
 * - SQL injection
 * - Numbers/special characters that indicate attack
 */
const validateName = (name) => {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 2 || name.length > 50) return false;
  // Allow letters, hyphens, apostrophes, spaces only
  return /^[a-zA-Z\s\-']*$/.test(name);
};

/**
 * Validate password strength
 * Enhanced requirements for stronger security:
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (!@#$%^&*)
 * 
 * @param {string} pwd - Password to validate
 * @returns {Object|boolean} Returns {valid: false, reason: 'error'} on failure, or true on success
 * 
 * Rationale: Complex passwords are significantly harder to brute-force
 * Estimated crack time: ~1000x harder than simple passwords
 */
const validatePassword = (pwd) => {
  if (!pwd || pwd.length < 8) {
    return {valid: false, reason: 'Password must be at least 8 characters'};
  }
  
  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(pwd)) {
    return {valid: false, reason: 'Password must include uppercase letter'};
  }
  
  // Check for at least one lowercase letter
  if (!/[a-z]/.test(pwd)) {
    return {valid: false, reason: 'Password must include lowercase letter'};
  }
  
  // Check for at least one number
  if (!/[0-9]/.test(pwd)) {
    return {valid: false, reason: 'Password must include number'};
  }
  
  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
    return {valid: false, reason: 'Password must include special character'};
  }
  
  return true;
};

/**
 * Sanitize string input - Comprehensive XSS and Injection Prevention
 * Security Layer 2: Input Sanitization
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 * 
 * This function:
 * 1. Ensures string type (prevents type confusion attacks)
 * 2. Trims whitespace (prevents spacing-based injection)
 * 3. Removes HTML/script tags (prevents XSS)
 * 4. Limits to 255 characters (prevents overflow attacks)
 * 5. Escapes special characters that could break out of queries
 * 
 * Prevents:
 * - NoSQL injection: {"$gt": ""} bypass attempts
 * - XSS attacks: <script> tags
 * - Command injection: System command execution
 * - Buffer overflow: Excessive character input
 */
const sanitizeString = (str) => {
  let result = String(str || '').trim().slice(0, 255);
  
  // Remove HTML/script tags to prevent XSS
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  result = result.replace(/<[^>]*>/g, '');
  
  // HTML encode potentially dangerous characters
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // Remove NoSQL injection attempts: ${...}, $ne, etc.
  result = result.replace(/\$\{[^}]*\}/g, '');
  result = result.replace(/\$[a-zA-Z]+/g, '');
  
  return result;
};

// ==================== Database Functions ====================
/**
 * Read database from JSON file with error handling
 * 
 * Security consideration: File I/O errors are caught and logged (not exposed to client)
 * 
 * @returns {Object} Database object with users array, or empty object on error
 */
function readDB(){
  try{
    const data = fs.readFileSync(DB_FILE,'utf8');
    return JSON.parse(data || '{}');
  }catch(e){
    console.error('Error reading DB:', e.message);
    return {users:[]};
  }
}

/**
 * Write database to JSON file with error handling
 * 
 * Security consideration: Write errors are caught, logged, and propagated as generic error
 * 
 * @param {Object} db - Database object to write
 * @throws {Error} Generic error on write failure (doesn't expose file path)
 */
function writeDB(db){
  try{
    fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2));
  }catch(e){
    console.error('Error writing DB:', e.message);
    throw new Error('Database write failed');
  }
}

/**
 * Initialize database file if it doesn't exist
 * Creates empty users array on first run
 */
try{
  if(!fs.existsSync(DB_FILE)) writeDB({users:[]});
}catch(e){
  console.error('Failed to initialize database:', e.message);
}

// ==================== API ENDPOINTS ====================

/**
 * POST /api/register - User Registration Endpoint
 * 
 * Rate Limited: 5 attempts per IP per 15 minutes
 * 
 * Security Measures:
 * 1. Rate limiting prevents rapid account creation abuse
 * 2. All inputs are sanitized before processing
 * 3. Email format validation prevents invalid entries
 * 4. Password strength requirement (8+ chars) ensures minimum security
 * 5. Bcryptjs hashing with 10 salt rounds protects password storage
 * 6. Duplicate email check prevents account takeover
 * 
 * @param {string} firstName - User's first name (2+ chars)
 * @param {string} lastName - User's last name (2+ chars)
 * @param {string} email - User's email (valid format, unique)
 * @param {string} password - User's password (8+ chars)
 * @param {string} restaurantName - Restaurant name (2+ chars)
 * @param {string} role - User role (owner, manager, or staff)
 * 
 * @returns {201} On success: {id, email, message}
 * @returns {400} On validation failure: {error}
 * @returns {409} On duplicate email: {error}
 * @returns {500} On server error: {error}
 */
app.post('/api/register', registerLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password, restaurantName, role, phone } = req.body;
    
    // Step 1: Validate phone number FIRST (before sanitizing - to catch injection attempts)
    if(phone && !validatePhone(phone)) {
      return res.status(400).json({error:'Phone number format is invalid'});
    }
    
    // Step 2: Sanitize all input strings
    const cleanEmail = sanitizeString(email).toLowerCase();
    const cleanFirst = sanitizeString(firstName);
    const cleanLast = sanitizeString(lastName);
    const cleanRestaurant = sanitizeString(restaurantName);
    const cleanPhone = sanitizeString(phone || '');
    
    // Step 3: Validate first name using strict format validation
    if(!cleanFirst || !validateName(cleanFirst)) {
      return res.status(400).json({error:'First name must be 2-50 characters, letters only'});
    }
    
    // Step 4: Validate last name using strict format validation
    if(!cleanLast || !validateName(cleanLast)) {
      return res.status(400).json({error:'Last name must be 2-50 characters, letters only'});
    }
    
    // Step 5: Validate email format with strict rules
    if(!cleanEmail || !validateEmail(cleanEmail)) {
      return res.status(400).json({error:'Valid email is required'});
    }
    
    // Step 6: Validate password strength (8+ chars with uppercase, lowercase, number, special char)
    const passwordValidation = validatePassword(password);
    if(passwordValidation !== true) {
      return res.status(400).json({error: passwordValidation.reason});
    }
    
    // Step 7: Validate restaurant name
    if(!cleanRestaurant || cleanRestaurant.length < 2 || cleanRestaurant.length > 255) {
      return res.status(400).json({error:'Restaurant name must be 2-255 characters'});
    }
    
    // Step 8: Validate role (whitelist approach - only allow specific roles)
    if(!role || !['owner','manager','staff'].includes(role)) {
      return res.status(400).json({error:'Invalid role'});
    }
    
    // Step 9: Check for duplicate email (prevent account hijacking)
    const db = readDB();
    if(db.users.find(u=>u.email === cleanEmail)){
      return res.status(409).json({error:'User already exists'});
    }
    
    // Step 10: Hash password with bcryptjs (10 salt rounds provides strong security)
    const hash = await bcrypt.hash(password, 10);
    
    // Step 11: Create user object with sanitized data
    const user = {
      id: Date.now(),
      firstName: cleanFirst,
      lastName: cleanLast,
      email: cleanEmail,
      passwordHash: hash, // Never store plain password
      phone: cleanPhone || null,
      restaurantName: cleanRestaurant,
      role,
      createdAt: new Date().toISOString()
    };
    
    // Step 12: Save to database and return success
    db.users.push(user);
    writeDB(db);
    
    res.status(201).json({id:user.id, email:user.email, message:'User created successfully'});
  }catch(e){
    // Error handling: Log internally, return generic message to client
    console.error('Register error:', e.message);
    res.status(500).json({error:'Registration failed'});
  }
});

/**
 * POST /api/login - User Login Endpoint
 * 
 * Rate Limited: 10 failed attempts per IP per 15 minutes
 * (Successful logins don't count toward limit)
 * 
 * Security Measures:
 * 1. Rate limiting prevents brute-force password attacks
 * 2. Bcryptjs password comparison is timing-safe (resistant to timing attacks)
 * 3. Unified error messages prevent user enumeration
 * 4. JWT token expires in 2 hours (forces re-authentication)
 * 5. HttpOnly cookies prevent XSS token theft
 * 6. Secure flag prevents HTTP transmission in production
 * 7. SameSite=Strict prevents CSRF attacks
 * 
 * @param {string} email - User's email
 * @param {string} password - User's password
 * 
 * @returns {200} On success: {ok: true, message}
 * @returns {400} On validation failure: {error}
 * @returns {401} On invalid credentials: {error} (same message for missing email/wrong password)
 * @returns {500} On server error: {error}
 */
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Step 1: Sanitize and validate email
    const cleanEmail = sanitizeString(email).toLowerCase();
    
    if(!cleanEmail || !validateEmail(cleanEmail)) {
      return res.status(400).json({error:'Valid email is required'});
    }
    
    // Step 2: Validate password presence
    if(!password) {
      return res.status(400).json({error:'Password is required'});
    }
    
    // Step 3: Lookup user by email
    const db = readDB();
    const user = db.users.find(u=>u.email === cleanEmail);
    
    // Security: Unified error message prevents user enumeration attacks
    // Attacker cannot distinguish between "email not found" and "wrong password"
    if(!user) {
      return res.status(401).json({error:'Invalid credentials'});
    }
    
    // Step 4: Compare password with bcryptjs (timing-safe comparison)
    const match = await bcrypt.compare(password, user.passwordHash);
    if(!match) {
      // Same error message as "user not found" - prevents user enumeration
      return res.status(401).json({error:'Invalid credentials'});
    }
    
    // Step 5: Create JWT token with 2-hour expiry
    const token = jwt.sign({id:user.id, email:user.email}, JWT_SECRET, {expiresIn:'2h'});
    
    // Step 6: Set secure cookie with appropriate flags
    // Note: Cookie maxAge is 2 hours, matching JWT expiry
    const secure = NODE_ENV === 'production'; // Only allow HTTPS in production
    res.cookie('rm_auth', token, {
      httpOnly: true,       // Prevent JavaScript access (XSS protection)
      secure: secure,       // Enforce HTTPS in production
      sameSite: 'Strict',   // Prevent CSRF attacks, stricter than 'Lax'
      maxAge: 2 * 60 * 60 * 1000 // 2 hours in milliseconds
    });
    
    res.json({ok:true, message:'Login successful'});
  }catch(e){
    console.error('Login error:', e.message);
    res.status(500).json({error:'Login failed'});
  }
});

/**
 * POST /api/logout - User Logout Endpoint
 * 
 * Security Features:
 * 1. Clears the authentication cookie
 * 2. Blacklists the JWT token for immediate revocation
 * 3. Prevents unauthorized access even if token is compromised
 * 
 * Token Blacklist:
 * - Token added to blacklist immediately
 * - Remains blacklisted for original expiry duration (2 hours)
 * - Protected endpoints check against blacklist
 * - Automatic cleanup when token naturally expires
 * 
 * @returns {200} {ok: true, message}
 */
app.post('/api/logout', (req, res)=>{
  try {
    const token = req.cookies.rm_auth;
    
    // Step 1: Clear cookie
    res.clearCookie('rm_auth', {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'Strict'
    });
    
    // Step 2: Blacklist token for immediate revocation
    if (token) {
      // Token remains valid for 2 hours, so blacklist for 2 hours
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      blacklistToken(token, TWO_HOURS_MS);
    }
    
    res.json({ok:true, message:'Logged out successfully'});
  } catch(e) {
    console.error('Logout error:', e.message);
    res.status(500).json({error:'Logout failed'});
  }
});

/**
 * GET /api/me - Get Current User Endpoint
 * 
 * Protected endpoint - requires valid authentication cookie
 * 
 * Security Measures:
 * 1. Token blacklist check prevents access after logout
 * 2. JWT token validation prevents unauthorized access
 * 3. Token expiry enforcement (2 hours) limits session window
 * 4. Expired tokens trigger automatic cookie cleanup
 * 5. User existence verification prevents returning deleted users
 * 6. Password hash is stripped from response (never expose hashes)
 * 
 * @returns {200} {user: {id, firstName, lastName, email, ...}} (passwordHash excluded)
 * @returns {401} On missing/invalid/expired/blacklisted token: {error}
 * @returns {500} On server error: {error}
 */
app.get('/api/me', (req, res)=>{
  try {
    // Step 1: Extract JWT token from cookie
    const token = req.cookies.rm_auth;
    if(!token) {
      return res.status(401).json({error:'Not authenticated'});
    }
    
    // Step 2: Check if token is blacklisted (logged out)
    if(isTokenBlacklisted(token)) {
      res.clearCookie('rm_auth');
      return res.status(401).json({error:'Session has been revoked'});
    }
    
    // Step 3: Verify JWT signature and expiry
    const data = jwt.verify(token, JWT_SECRET);
    
    // Step 4: Lookup user in database
    const db = readDB();
    const user = db.users.find(u=>u.id === data.id);
    
    if(!user) {
      return res.status(401).json({error:'User not found'});
    }
    
    // Step 5: Remove sensitive data before returning
    const {passwordHash, ...safe} = user;
    res.json({user:safe});
  }catch(e){
    // Handle specific error types
    if(e.name === 'TokenExpiredError') {
      // Clean up expired token cookie
      res.clearCookie('rm_auth');
      return res.status(401).json({error:'Session expired'});
    }
    console.error('Auth error:', e.message);
    res.status(401).json({error:'Invalid token'});
  }
});

// ==================== Static File Serving & Server Startup ====================
// Serve frontend files from /frontend directory
app.use(express.static(path.join(__dirname,'..','frontend')));

// Start server (only if this file is run directly, not imported by tests)
if(require.main === module){
  app.listen(PORT, ()=>console.log(`Backend running on http://localhost:${PORT} (${NODE_ENV})`));
}

// Export app for testing with Jest/Supertest
module.exports = app;
