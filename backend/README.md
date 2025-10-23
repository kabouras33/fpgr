# Restaurant Management Backend

Express.js backend for user authentication and registration with JWT-based session management.

## Features

- **Secure Authentication**: Bcryptjs password hashing with salt rounds 10
- **JWT Sessions**: 2-hour expiring tokens with HttpOnly, Secure cookies
- **Input Validation**: Comprehensive email format and password strength validation
- **Error Handling**: Proper HTTP status codes and error messages
- **CORS Support**: Configurable cross-origin requests
- **Unit Tests**: 15 comprehensive tests covering all endpoints

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

Tests cover:
- User registration with validation
- Login with password verification
- Session retrieval and expiry
- Logout functionality
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

✅ Bcryptjs password hashing  
✅ JWT token expiry (2 hours)  
✅ HttpOnly cookies (XSS protection)  
✅ SameSite=Strict (CSRF protection)  
✅ Secure flag in production (HTTPS only)  
✅ Input validation and sanitization  
✅ Error logging to console  
✅ Proper HTTP status codes  

## Development Notes

- Database: JSON file (`db.json` in backend folder)
- Passwords: Never stored in plaintext, only bcrypt hashes
- Sessions: Stored as HttpOnly cookies with JWT tokens
- User passwords not returned in any API response

