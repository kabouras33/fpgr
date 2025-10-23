# Getting Started - Restaurant Management System

Welcome to the Restaurant Management System! This guide will walk you through setting up and running the application locally.

## Prerequisites

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, for version control) - [Download here](https://git-scm.com/)

## Installation & Setup

### Step 1: Install Backend Dependencies

Open PowerShell and navigate to the backend folder:

```powershell
cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\backend"
npm install
```

This will install all required packages:
- `express` - Web framework
- `bcryptjs` - Password hashing
- `jsonwebtoken` - Session tokens
- `express-rate-limit` - Brute-force protection
- `cookie-parser` - Session cookies
- And more (see package.json)

### Step 2: Install Frontend Dependencies

Open a new PowerShell tab/window:

```powershell
cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\frontend"
npm install
```

**Note**: Frontend dependencies are minimal (just a static server).

### Step 3: Configure Environment Variables (Backend)

1. Navigate to the backend folder:
   ```powershell
   cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\backend"
   ```

2. Create a `.env` file by copying `.env.example`:
   ```powershell
   Copy-Item .env.example .env
   ```

3. Edit the `.env` file and set these values:
   ```
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your-super-secret-key-change-this-in-production
   DB_FILE=./db.json
   CORS_ORIGIN=*
   ```

   **Important for Production**:
   - Change `JWT_SECRET` to a long random string (32+ characters)
   - Set `NODE_ENV=production`
   - Set `CORS_ORIGIN` to your domain (e.g., `https://yourdomain.com`)

## Running the Application

### Terminal 1: Start the Backend Server

```powershell
cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\backend"
npm start
```

Expected output:
```
Server running on http://localhost:5000
```

### Terminal 2: Start the Frontend Server

Open a new PowerShell tab/window:

```powershell
cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\frontend"
npm start
```

Expected output:
```
Server running on http://localhost:8000
```

### Step 4: Access the Application

1. Open your browser and go to **http://localhost:8000**
2. You should see the Registration form
3. Create a new account:
   - Fill in all fields (first name, last name, email, phone, password, etc.)
   - Password must be at least 8 characters
   - Accept the Terms of Service
   - Click "Register"

4. After successful registration, you'll be redirected to the login page
5. Enter your credentials and click "Sign In"
6. You'll see the Dashboard showing your account information

## Testing the API

### Run the Test Suite

In the backend folder:

```powershell
cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\backend"
npm test
```

Expected output:
```
PASS  ./server.test.js
Tests:       25 passed, 25 total
```

All 25 tests verify:
- ✅ User registration and validation
- ✅ User login and authentication
- ✅ Session management
- ✅ Security features (rate limiting, input validation, etc.)
- ✅ Cookie security
- ✅ Protection against common attacks

### Manual API Testing (cURL or Postman)

#### Register a User

```powershell
$body = @{
    firstName = "John"
    lastName = "Doe"
    email = "john@example.com"
    phone = "555-1234"
    password = "SecurePass123"
    confirmPassword = "SecurePass123"
    restaurantName = "Pizza Palace"
    role = "manager"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

#### Login

```powershell
$body = @{
    email = "john@example.com"
    password = "SecurePass123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

#### Get Current User (requires valid session)

```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/me" `
  -Method GET
```

#### Logout

```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/logout" `
  -Method POST
```

## File Structure Overview

```
project/
├── backend/
│   ├── server.js              - Main backend application
│   ├── server.test.js         - Test suite (25 tests)
│   ├── db.json                - User database (auto-created)
│   ├── .env                   - Environment configuration
│   ├── .env.example           - Configuration template
│   ├── API.md                 - API documentation
│   ├── SECURITY.md            - Security details
│   ├── README.md              - Backend-specific guide
│   └── package.json           - Dependencies
│
├── frontend/
│   ├── index.html             - Registration page
│   ├── login.html             - Login page
│   ├── dashboard.html         - Dashboard (after login)
│   ├── script.js              - Registration logic
│   ├── login.js               - Login logic
│   ├── styles.css             - Styling
│   ├── server.js              - Static file server
│   └── README.md              - Frontend-specific guide
│
└── README.md                  - Main project overview
```

## Important Features

### Security Features Implemented ✅

1. **Password Hashing**: Bcryptjs with 10 salt rounds
2. **Session Tokens**: JWT-based authentication with 2-hour expiry
3. **Secure Cookies**: HttpOnly, SameSite=Strict, Secure (in production)
4. **Rate Limiting**: 
   - 5 registration attempts per IP per 15 minutes
   - 10 login attempts per IP per 15 minutes
   - 100 global requests per IP per 15 minutes
5. **Input Validation**: Email format, password strength, string length limits
6. **User Enumeration Prevention**: Unified error messages for login failures
7. **Error Handling**: Comprehensive try-catch blocks with proper logging

### Database

- Uses JSON file (`db.json`) for development/testing
- **For Production**: Migrate to PostgreSQL or MongoDB
- See `backend/SECURITY.md` for production migration guide

## Troubleshooting

### "Address already in use" error

This means the port is already being used. Either:
- Close the other application using the port
- Or change the port in `.env` (backend) or `frontend/server.js`

### CORS errors when calling API from frontend

Check that:
- Backend is running on http://localhost:5000
- `CORS_ORIGIN` in `.env` includes your frontend URL (use `*` for development)
- Frontend is making requests with `credentials: 'include'`

### "JWT_SECRET not set" error

Make sure your `.env` file has `JWT_SECRET` set:
```
JWT_SECRET=your-secret-key-here
```

### Rate limit errors (429 Too Many Requests)

This is intentional protection against brute-force attacks. Wait 15 minutes or restart the server.

## Next Steps

1. **Review Security**: Read `backend/SECURITY.md` for all implemented security measures
2. **Explore API**: See `backend/API.md` for complete endpoint documentation
3. **Customize**: Modify `frontend/styles.css` to match your branding
4. **Database**: Plan migration to production database (PostgreSQL/MongoDB)
5. **Features**: Add menu management, orders, and table management features

## Deployment Guide

For deploying to production, see:
- `backend/README.md` - Deployment instructions
- `backend/SECURITY.md` - Production security checklist
- `COMPLETION_REPORT.md` - Full project summary

## Support

For issues or questions:
1. Check the individual README files in `backend/` and `frontend/`
2. Review `API.md` for endpoint details
3. Check `SECURITY.md` for security implementation details
4. Review test files (`server.test.js`) for usage examples

---

**Happy Coding!** 🎉

Your restaurant management system is ready for development. Start registering users and building out additional features!
