# Integration & Deployment Guide

**Last Updated**: October 23, 2025  
**Build Status**: 80% Complete - Frontend & Backend Integration Ready

---

## Quick Start for Developers

### 1. Clone & Install

```bash
# Clone the repository (if from Git)
git clone https://github.com/kabouras33/fpgr.git
cd fpgr

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to project root
cd ..
```

### 2. Configure Environment

```bash
# Backend configuration
cd backend
cp .env.example .env

# Edit .env with your values:
# PORT=5000
# NODE_ENV=development
# JWT_SECRET=your-dev-secret-key
# DB_FILE=./db.json
# CORS_ORIGIN=http://localhost:8000

cd ..
```

### 3. Start Development Servers

**Terminal 1 - Backend**:
```bash
cd backend
npm start
# Output: Backend running on http://localhost:5000 (development)
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm start
# Output: Server running on http://localhost:8000
```

### 4. Test the Application

1. Open browser to `http://localhost:8000`
2. Fill registration form with test data
3. Click "Register"
4. On success, you'll see login page
5. Enter credentials and click "Sign In"
6. Dashboard shows user info

---

## Frontend-Backend Integration

### API Communication Architecture

```
Frontend (HTML/CSS/JavaScript)
    ↓
HTTP Requests (with credentials: 'include')
    ↓
Backend Express Server
    ↓
Middleware Chain:
  1. Global Rate Limiter
  2. Body Parser
  3. Cookie Parser
  4. CORS
  5. Endpoint-Specific Rate Limiter
    ↓
API Endpoint Handler
    ↓
Response (with cookies)
    ↓
Browser stores HttpOnly cookie
    ↓
Automatic cookie inclusion on next request
```

### Frontend Features

**Registration** (`index.html`):
- Form validation (client-side and server-side)
- Password strength meter
- File upload for avatar
- Terms of service acceptance
- Error display inline

**Login** (`login.html`):
- Email and password fields
- Error message display
- Redirect to dashboard on success
- Link to registration

**Dashboard** (`dashboard.html`):
- Protected page (redirects if not authenticated)
- Displays user information
- Logout button
- Secure session management

### Backend API Endpoints

```
POST /api/register
├─ Body: {firstName, lastName, email, phone, password, confirmPassword, restaurantName, role, avatar}
├─ Response: {id, email, message} or {error}
└─ Rate Limited: 5 attempts/IP/15min

POST /api/login
├─ Body: {email, password}
├─ Response: {ok: true, message} or {error}
├─ Sets HttpOnly cookie: rm_auth
└─ Rate Limited: 10 failed attempts/IP/15min

GET /api/me
├─ Requires: rm_auth cookie
├─ Response: {user: {id, firstName, lastName, email, ...}}
└─ Authorization: JWT token validation

POST /api/logout
├─ Clears: rm_auth cookie
├─ Response: {ok: true, message}
└─ No rate limit
```

---

## Security Features Implementation

### 1. Session Management Flow

```
1. User Registration
   ├─ Sanitize inputs
   ├─ Validate fields
   ├─ Hash password (bcryptjs)
   └─ Save to database

2. User Login
   ├─ Validate email format
   ├─ Find user by email
   ├─ Compare password (bcryptjs)
   ├─ Create JWT token
   ├─ Set HttpOnly cookie
   └─ Return success

3. Authenticated Request
   ├─ Browser includes HttpOnly cookie automatically
   ├─ Server extracts JWT from cookie
   ├─ Verify JWT signature
   ├─ Check token expiry
   ├─ Process request
   └─ Return response

4. Token Expiry
   ├─ After 2 hours
   ├─ JWT verification fails
   ├─ Cookie cleared automatically
   └─ User redirected to login
```

### 2. Attack Prevention

**Brute Force Attack Prevention**:
- Rate limiting on registration (5/IP/15min)
- Rate limiting on login (10 failed/IP/15min)
- Failed login attempts only (successful logins don't count)

**User Enumeration Prevention**:
- Unified error message: "Invalid credentials"
- Same message for non-existent email or wrong password
- Attackers cannot determine if email exists

**XSS Attack Prevention**:
- HttpOnly flag on cookies (JavaScript cannot access)
- Passwords never exposed to frontend
- No sensitive data in HTML/JavaScript

**CSRF Attack Prevention**:
- SameSite=Strict on cookies
- Cookies never sent with cross-site requests
- Requires legitimate frontend to send requests

**SQL Injection Prevention**:
- Input sanitization (trim + length limit)
- Type validation (email format, role enum)
- Direct JavaScript object comparison (not SQL queries)

**Password Security**:
- Bcryptjs hashing with 10 salt rounds
- Industry-standard algorithm
- Resistant to timing attacks
- Adaptive cost factor

---

## Testing

### Run Test Suite

```bash
cd backend
npm test
```

**Expected Output**:
```
PASS  ./server.test.js
Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
Snapshots:   0 total
Time:        1.44 s
```

### Manual Testing Checklist

- [ ] Register with valid data → Success
- [ ] Register with duplicate email → Error
- [ ] Register with weak password → Error
- [ ] Register with invalid email → Error
- [ ] Login with valid credentials → Success
- [ ] Login with wrong password → Error
- [ ] Login with non-existent email → Error (same message)
- [ ] Access /api/me with valid session → Returns user info
- [ ] Access /api/me without session → 401 Unauthorized
- [ ] Logout → Cookie cleared
- [ ] Try request after logout → 401 Unauthorized
- [ ] Rapid registration attempts (>5/IP/15min) → 429 Too Many Requests
- [ ] Rapid login attempts (>10/IP/15min) → 429 Too Many Requests

### Security Testing

```bash
# Test rate limiting (login)
for i in {1..12}; do
  curl -X POST http://localhost:5000/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Should get 429 on 11th attempt

# Test user enumeration
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com","password":"Test1234"}'
# Response: {"error":"Invalid credentials"} (status 401)

curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"existing@test.com","password":"WrongPass"}'
# Response: {"error":"Invalid credentials"} (status 401)
# Same message = secure!

# Test SQL injection prevention
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@test.com","password":"Test1234","restaurantName":"Restaurant","role":"owner"}'
# Should work normally (SQL injection attempt ignored)
```

---

## Deployment

### Development Deployment

```bash
# 1. Start backend server
cd backend
npm start

# 2. Start frontend server (in another terminal)
cd frontend
npm start

# 3. Access at http://localhost:8000
```

### Staging Deployment

```bash
# 1. Configure environment
export NODE_ENV=staging
export JWT_SECRET=$(openssl rand -base64 32)
export CORS_ORIGIN=https://staging.yourdomain.com

# 2. Start server
npm start

# 3. Run tests
npm test

# 4. Verify all endpoints
curl https://staging.yourdomain.com/api/me
```

### Production Deployment

**Prerequisites**:
- [ ] HTTPS/SSL certificate configured
- [ ] Database migrated to PostgreSQL
- [ ] Environment variables set
- [ ] Monitoring and logging configured
- [ ] Backup strategy in place
- [ ] Disaster recovery plan documented

**Deployment Steps**:

```bash
# 1. Production environment setup
export NODE_ENV=production
export JWT_SECRET=$(openssl rand -base64 32)
export CORS_ORIGIN=https://yourdomain.com
export DB_FILE=/var/lib/restaurant-app/db.json  # or PostgreSQL connection string
export PORT=3000  # Use process manager to expose as port 80/443

# 2. Install dependencies
npm install --production

# 3. Run tests
npm test

# 4. Start with process manager (e.g., PM2)
pm2 start backend/server.js --name "restaurant-api" --instances 4 --env production

# 5. Configure reverse proxy (Nginx)
# See nginx.conf example below

# 6. Monitor
pm2 logs restaurant-api
pm2 monit

# 7. Backup database
# Cron job: 0 2 * * * pg_dump -U user -h localhost db > /backups/db-$(date +%Y%m%d).sql
```

### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;  # Redirect HTTP to HTTPS
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend static files
    location / {
        root /var/www/restaurant-app/frontend;
        try_files $uri $uri/ /index.html;  # SPA routing
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### PM2 Ecosystem File Example

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'restaurant-api',
    script: './backend/server.js',
    instances: 4,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_SECRET: process.env.JWT_SECRET,
      CORS_ORIGIN: 'https://yourdomain.com',
      DB_FILE: '/var/lib/restaurant-app/db.json'
    },
    error_file: '/var/log/restaurant-app/err.log',
    out_file: '/var/log/restaurant-app/out.log',
    log_file: '/var/log/restaurant-app/combined.log',
    time: true
  }]
};

// Usage:
// pm2 start ecosystem.config.js
// pm2 save
// pm2 startup
// pm2 logs
```

---

## Database Migration

### From JSON to PostgreSQL

**Step 1: Create PostgreSQL Database**

```sql
CREATE DATABASE restaurant_app;

CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  firstName VARCHAR(255) NOT NULL,
  lastName VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  restaurantName VARCHAR(255) NOT NULL,
  role VARCHAR(50) CHECK (role IN ('owner', 'manager', 'staff')) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email ON users(email);
```

**Step 2: Update Backend Code**

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function readDB() {
  try {
    const result = await pool.query('SELECT * FROM users');
    return { users: result.rows };
  } catch(e) {
    console.error('Error reading DB:', e.message);
    return { users: [] };
  }
}

async function writeDB(db) {
  try {
    for (const user of db.users) {
      await pool.query(
        'INSERT INTO users (id, firstName, lastName, email, passwordHash, restaurantName, role, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET ...',
        [user.id, user.firstName, user.lastName, user.email, user.passwordHash, user.restaurantName, user.role, user.createdAt]
      );
    }
  } catch(e) {
    console.error('Error writing DB:', e.message);
    throw new Error('Database write failed');
  }
}
```

**Step 3: Add Dependencies**

```bash
npm install pg
```

**Step 4: Set Environment Variable**

```bash
export DATABASE_URL=postgresql://user:password@localhost:5432/restaurant_app
```

---

## Monitoring & Logging

### Application Logging Setup

```bash
npm install winston
```

**Winston Configuration**:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Usage
logger.error('Authentication failed for user', { email: user.email });
logger.info('User registered successfully', { userId: user.id });
```

### Health Check Endpoint

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### Monitoring Services

**Recommended**:
- **Error Tracking**: Sentry (sentry.io)
- **Performance Monitoring**: New Relic or Datadog
- **Uptime Monitoring**: UptimeRobot or Pingdom
- **Log Aggregation**: ELK Stack (Elasticsearch, Logstash, Kibana)

---

## Troubleshooting

### Backend Issues

**Server won't start**:
```bash
# Check if port is in use
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Use different port
PORT=5001 npm start
```

**Database connection error**:
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Check db.json exists
ls -la backend/db.json

# Recreate if missing
echo '{"users":[]}' > backend/db.json
```

**Rate limit keeps triggering**:
```bash
# Check NODE_ENV
echo $NODE_ENV

# Should be 'test' for testing, not 'production'
NODE_ENV=test npm test
```

### Frontend Issues

**Can't connect to backend**:
```bash
# Verify backend is running
curl http://localhost:5000/api/me

# Check CORS_ORIGIN
# Should include frontend URL

# Verify credentials: 'include' in fetch calls
```

**Cookies not persisting**:
```javascript
// Ensure fetch includes credentials
fetch('/api/login', {
  method: 'POST',
  credentials: 'include',  // MUST be included
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({email, password})
});
```

---

## Rollback Procedures

### Database Rollback

```bash
# If migration to PostgreSQL failed, rollback to JSON
rm backend/db.json
cp backend/db.json.backup backend/db.json

# Restart server
npm start
```

### Code Rollback (Git)

```bash
# If deployment has issues
git revert <commit-hash>

# Or
git checkout <previous-tag>
npm install
npm test
npm start
```

---

## Support & Resources

- **Documentation**: See `DEVELOPER_GUIDE.md` for code details
- **Security**: See `SECURITY_AUDIT_REPORT.md` for security assessment
- **API Reference**: See `backend/API.md` for endpoint documentation
- **Getting Started**: See `GETTING_STARTED.md` for setup instructions

---

**Next Steps**:
1. Set up your environment variables
2. Start the development servers
3. Run the test suite
4. Customize the frontend styling
5. Plan your database migration
6. Set up production monitoring

**Happy Deployment!** 🚀
