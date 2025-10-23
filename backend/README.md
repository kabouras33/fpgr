# Restaurant Management Backend

Express.js backend for user authentication and registration with JWT-based session management.

## Features

- **Secure Authentication**: Bcryptjs password hashing with salt rounds 10
- **JWT Sessions**: 2-hour expiring tokens with HttpOnly, Secure cookies
- **Rate Limiting**: Prevents brute-force attacks (5 reg/IP, 10 login/IP per 15 min)
- **Input Validation**: Comprehensive email format, password strength, and string sanitization
- **User Enumeration Prevention**: Unified error messages for invalid credentials
- **Error Handling**: Proper HTTP status codes and error messages
- **CORS Support**: Configurable cross-origin requests
- **Unit Tests**: 25 comprehensive tests covering all endpoints and security scenarios

## Setup

1. Install dependencies:
```powershell
cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\backend"
npm install
```

2. Create `.env` file (optional, see `.env.example`):
```powershell
# For development (defaults work fine)
# For production, set:
NODE_ENV=production
JWT_SECRET=your-secure-random-string-min-32-chars
```

## Run

### Development
```powershell
npm start
# Backend runs on http://localhost:5000
```

### Production
```powershell
NODE_ENV=production JWT_SECRET="your-secure-secret" npm start
```

### With ngrok (for external access)
```powershell
npm start
# In another terminal:
ngrok http 5000
# Share the ngrok URL with frontend config
```

## Testing

Run all unit tests:
```powershell
npm test
```

Tests cover (25 total):
- User registration with validation
- Login with password verification
- Session retrieval and expiry
- Logout functionality
- SQL injection and XSS prevention
- User enumeration prevention
- Cookie security flags
- Complete auth flow integration
- Error cases (invalid email, short password, duplicate user, etc.)

## API Endpoints

See `API.md` for full documentation.

### Quick Reference

- `POST /api/register` - Create account
- `POST /api/login` - Sign in (sets HttpOnly cookie)
- `GET /api/me` - Get current user (requires cookie)
- `POST /api/logout` - Sign out

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (default: development)
- `JWT_SECRET` - JWT signing key (required in production)
- `DB_FILE` - Database file path (default: ./db.json)
- `CORS_ORIGIN` - Allowed CORS origin (default: *)

## Security Features

✅ Bcryptjs password hashing (10 rounds)  
✅ JWT token expiry (2 hours)  
✅ HttpOnly cookies (XSS protection)  
✅ SameSite=Strict (CSRF protection)  
✅ Secure flag in production (HTTPS only)  
✅ Input validation and sanitization  
✅ Rate limiting (5 reg, 10 login per IP per 15 min)  
✅ Unified error messages (user enumeration prevention)  
✅ Error logging to console  
✅ Proper HTTP status codes  
✅ SQL injection prevention via input validation  

## Rate Limiting

- **Registration**: 5 attempts per IP per 15 minutes
- **Login**: 10 attempts per IP per 15 minutes (successful logins don't count)
- **Global**: 100 requests per IP per 15 minutes

Rate limiting is disabled in test mode (`NODE_ENV=test`) to allow comprehensive testing.

## Development Notes

- Database: JSON file (`db.json` in backend folder)
- Passwords: Never stored in plaintext, only bcrypt hashes
- Sessions: Stored as HttpOnly cookies with JWT tokens
- User passwords not returned in any API response
- All sensitive error messages logged to console only, generic messages to client

## Future Improvements

For production deployment:
- Implement token blacklist/revocation system for logout
- Use Redis for rate limiting across multiple server instances
- Add database connection pooling (PostgreSQL/MongoDB)
- Implement server-side session store
- Add two-factor authentication (2FA)
- Implement HTTPS enforcement

