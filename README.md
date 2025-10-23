# Restaurant Management System

A full-stack web application for managing restaurant operations with user authentication, registration, and role-based access control

## Project Structure

```
Fpga_test/
├── frontend/          - React/HTML registration and login forms
│   ├── index.html    - User registration page
│   ├── login.html    - User login page
│   ├── dashboard.html - Post-login user dashboard
│   ├── styles.css    - Styling
│   ├── script.js     - Registration form logic
│   ├── login.js      - Login page logic
│   ├── package.json  - Frontend dependencies
│   ├── server.js     - Static file server
│   └── README.md
├── backend/          - Express.js authentication API
│   ├── server.js     - Main backend server
│   ├── server.test.js - Unit tests
│   ├── package.json  - Backend dependencies
│   ├── db.json       - User database (auto-created)
│   ├── API.md        - API documentation
│   ├── .env.example  - Environment variables template
│   └── README.md
└── README.md         - This file
```

## Quick Start

### Frontend

```powershell
cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\frontend"
npm install
npm start
# Open http://localhost:8000
```

### Backend

```powershell
cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\backend"
npm install
npm start
# Runs on http://localhost:5000
```

Both services can run simultaneously. Frontend communicates with backend via `/api/*` endpoints.

## Features

### Frontend
- User registration with validation
- User login with password verification
- Dashboard showing authenticated user info
- Responsive design
- Client-side form validation
- Session persistence via HttpOnly cookies

### Backend
- Secure user registration
- JWT-based authentication
- Bcryptjs password hashing
- HttpOnly, Secure, SameSite cookies
- Comprehensive input validation
- Full error handling
- 15 comprehensive unit tests
- API documentation

## Development

### Run Backend Tests
```powershell
cd backend
npm test
```

All 15 tests cover registration, login, session retrieval, logout, and error cases.

### Environment Setup

Copy `.env.example` to `.env` and fill in values:

```powershell
# backend/.env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-dev-secret
```

In production:
- Set `NODE_ENV=production`
- Use a secure `JWT_SECRET` (32+ chars)
- Enable HTTPS (secure cookies auto-enable)

## Security

✅ Passwords: Bcryptjs hashed (never stored plaintext)  
✅ Sessions: JWT tokens in HttpOnly cookies  
✅ CSRF Protection: SameSite=Strict  
✅ XSS Protection: HttpOnly cookies  
✅ Input Validation: All fields sanitized  
✅ Error Messages: Generic to prevent user enumeration  

## Next Steps

- [ ] Add menu management interface
- [ ] Implement order management system
- [ ] Add table management features
- [ ] Create reporting dashboard
- [ ] Add payment integration
- [ ] Implement inventory tracking
- [ ] Add CRM features
- [ ] Deploy to production

## API Reference

See `backend/API.md` for complete endpoint documentation.

### Key Endpoints

- `POST /api/register` - Create new account
- `POST /api/login` - Authenticate user
- `GET /api/me` - Get current user
- `POST /api/logout` - End session

## License

MIT

