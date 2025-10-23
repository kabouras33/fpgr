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
// Load environment variables with fallbacks
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'production' ? null : 'dev-secret-change-me');
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');

// Production safety check: JWT_SECRET is mandatory in production
if(NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is required in production');
  process.exit(1);
}

// ==================== Middleware Configuration ====================
// Body parser: Limit payload to 10KB to prevent DoS attacks
app.use(bodyParser.json({limit:'10kb'}));
app.use(bodyParser.urlencoded({limit:'10kb'}));

// Cookie parser: Enable cookie parsing for session management
app.use(cookieParser());

// CORS: Allow cross-origin requests from frontend
// In production, set CORS_ORIGIN to your specific domain (e.g., https://yourdomain.com)
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));

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

// ==================== Input Validation & Sanitization ====================
/**
 * Security Layer 1: Input Validation
 * These functions validate user input format before processing
 */

/**
 * Validate email format using regex
 * @param {string} email - Email to validate
 * @returns {boolean} True if email format is valid
 * Pattern: anything@anything.anything
 */
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Validate password strength
 * @param {string} pwd - Password to validate
 * @returns {boolean} True if password meets minimum requirements (8+ characters)
 */
const validatePassword = (pwd) => pwd && pwd.length >= 8;

/**
 * Sanitize string input
 * Security Layer 2: Input Sanitization - Prevents injection attacks
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string (trimmed, max 255 chars)
 * 
 * This function:
 * - Trims whitespace (prevents spacing attacks)
 * - Limits to 255 characters (prevents overflow attacks)
 * - Converts to string type (ensures consistent type)
 */
const sanitizeString = (str) => String(str||'').trim().slice(0,255);

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
    const { firstName, lastName, email, password, restaurantName, role } = req.body;
    
    // Step 1: Sanitize all input strings
    const cleanEmail = sanitizeString(email).toLowerCase();
    const cleanFirst = sanitizeString(firstName);
    const cleanLast = sanitizeString(lastName);
    const cleanRestaurant = sanitizeString(restaurantName);
    
    // Step 2: Validate email format
    if(!cleanEmail || !validateEmail(cleanEmail)) {
      return res.status(400).json({error:'Valid email is required'});
    }
    
    // Step 3: Validate password strength
    if(!password || !validatePassword(password)) {
      return res.status(400).json({error:'Password must be at least 8 characters'});
    }
    
    // Step 4: Validate first name
    if(!cleanFirst || cleanFirst.length < 2) {
      return res.status(400).json({error:'First name must be at least 2 characters'});
    }
    
    // Step 5: Validate last name
    if(!cleanLast || cleanLast.length < 2) {
      return res.status(400).json({error:'Last name must be at least 2 characters'});
    }
    
    // Step 6: Validate restaurant name
    if(!cleanRestaurant || cleanRestaurant.length < 2) {
      return res.status(400).json({error:'Restaurant name must be at least 2 characters'});
    }
    
    // Step 7: Validate role (whitelist approach - only allow specific roles)
    if(!role || !['owner','manager','staff'].includes(role)) {
      return res.status(400).json({error:'Invalid role'});
    }
    
    // Step 8: Check for duplicate email (prevent account hijacking)
    const db = readDB();
    if(db.users.find(u=>u.email === cleanEmail)){
      return res.status(409).json({error:'User already exists'});
    }
    
    // Step 9: Hash password with bcryptjs (10 salt rounds provides strong security)
    const hash = await bcrypt.hash(password, 10);
    
    // Step 10: Create user object with sanitized data
    const user = {
      id: Date.now(),
      firstName: cleanFirst,
      lastName: cleanLast,
      email: cleanEmail,
      passwordHash: hash, // Never store plain password
      restaurantName: cleanRestaurant,
      role,
      createdAt: new Date().toISOString()
    };
    
    // Step 11: Save to database and return success
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
 * Clears the authentication cookie to end the session
 * Note: JWT tokens remain valid until natural expiry (2 hours)
 * For production: Implement token blacklist for immediate revocation
 * 
 * @returns {200} {ok: true, message}
 */
app.post('/api/logout', (req, res)=>{
  // Clear cookie with same flags as when it was set (required by some browsers)
  res.clearCookie('rm_auth', {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'Strict'
  });
  res.json({ok:true, message:'Logged out successfully'});
});

/**
 * GET /api/me - Get Current User Endpoint
 * 
 * Protected endpoint - requires valid authentication cookie
 * 
 * Security Measures:
 * 1. JWT token validation prevents unauthorized access
 * 2. Token expiry enforcement (2 hours) limits session window
 * 3. Expired tokens trigger automatic cookie cleanup
 * 4. User existence verification prevents returning deleted users
 * 5. Password hash is stripped from response (never expose hashes)
 * 
 * @returns {200} {user: {id, firstName, lastName, email, ...}} (passwordHash excluded)
 * @returns {401} On missing/invalid/expired token: {error}
 * @returns {500} On server error: {error}
 */
app.get('/api/me', (req, res)=>{
  try {
    // Step 1: Extract JWT token from cookie
    const token = req.cookies.rm_auth;
    if(!token) {
      return res.status(401).json({error:'Not authenticated'});
    }
    
    // Step 2: Verify JWT signature and expiry
    const data = jwt.verify(token, JWT_SECRET);
    
    // Step 3: Lookup user in database
    const db = readDB();
    const user = db.users.find(u=>u.id === data.id);
    
    if(!user) {
      return res.status(401).json({error:'User not found'});
    }
    
    // Step 4: Remove sensitive data before returning
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
