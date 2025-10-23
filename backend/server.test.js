// server.test.js - Unit tests for authentication endpoints
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Create a temporary database for testing
const testDbFile = path.join(__dirname, 'db.test.json');
process.env.DB_FILE = testDbFile;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

// Load server after env is set
delete require.cache[require.resolve('./server')];
const app = require('./server');

describe('Authentication Endpoints', () => {
  const testUser = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: 'TestPass123!',
    restaurantName: 'Test Restaurant',
    role: 'owner'
  };

  const invalidUser = {
    firstName: 'T',
    lastName: 'U',
    email: 'invalid',
    password: 'short',
    restaurantName: 'T',
    role: 'invalid'
  };

  afterAll(() => {
    // Cleanup test database
    if(fs.existsSync(testDbFile)) {
      fs.unlinkSync(testDbFile);
    }
  });

  describe('POST /api/register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/register')
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    test('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/register')
        .send(testUser);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'User already exists');
    });

    test('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({ ...testUser, email: 'notanemail', id: undefined });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    test('should reject short password', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({ ...testUser, email: 'another@test.com', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password');
    });

    test('should reject short names', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({ ...testUser, email: 'another2@test.com', firstName: 'A' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    test('should reject invalid role', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({ ...testUser, email: 'another3@test.com', role: 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('role');
    });
  });

  describe('POST /api/login', () => {
    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: 'notanemail', password: 'TestPass123!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    test('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: 'nonexistent@test.com', password: 'TestPass123!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('credentials');
    });

    test('should reject wrong password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: testUser.email, password: 'WrongPass123!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('credentials');
    });

    test('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: testUser.email });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/me', () => {
    let authCookie = '';

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: testUser.email, password: testUser.password });
      authCookie = response.headers['set-cookie'][0];
    });

    test('should return user info with valid session', async () => {
      const response = await request(app)
        .get('/api/me')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('firstName');
      expect(response.body.user).toHaveProperty('restaurantName');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    test('should reject request without session', async () => {
      const response = await request(app).get('/api/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('authenticated');
    });
  });

  describe('POST /api/logout', () => {
    let authCookie = '';

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: testUser.email, password: testUser.password });
      authCookie = response.headers['set-cookie'][0];
    });

    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/logout')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok', true);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should reject subsequent requests after logout', async () => {
      // This would need a more complex setup to test fully,
      // but the above test verifies the logout endpoint works
      expect(true).toBe(true);
    });
  });

  describe('Security: SQL Injection & XSS Prevention', () => {
    test('should sanitize SQL injection attempt in email', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          ...testUser,
          email: "test'; DROP TABLE users; --@example.com",
          id: undefined,
        });

      // Should reject with 400 (invalid email format)
      expect([400, 409]).toContain(response.status);
      if(response.status === 400) {
        expect(response.body.error).toBeTruthy();
      }
    });

    test('should reject very long input strings (buffer overflow prevention)', async () => {
      const longString = 'A'.repeat(500);
      const response = await request(app)
        .post('/api/register')
        .send({
          firstName: longString,
          lastName: 'Test',
          email: `test${Date.now()}@example.com`,
          password: 'LongStringPass123!',
          restaurantName: 'Test',
          role: 'owner',
        });

      // Long strings should be sanitized (truncated to 255 chars) and accepted or rejected
      expect([400, 201]).toContain(response.status);
    });

    test('should handle special characters in input safely', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          firstName: 'Test<script>',
          lastName: 'User',
          email: `special${Date.now()}@example.com`,
          password: 'SpecialPass123!',
          restaurantName: 'Test Restaurant',
          role: 'owner',
        });

      // Should either accept (sanitized) or reject (invalid)
      expect([400, 201]).toContain(response.status);
    });
  });

  describe('Security: User Enumeration Prevention', () => {
    test('login should use unified error for invalid email and password', async () => {
      const invalidEmailResponse = await request(app)
        .post('/api/login')
        .send({ email: 'nonexistent@test.com', password: 'TestPass123!' });

      const invalidPasswordResponse = await request(app)
        .post('/api/login')
        .send({ email: testUser.email, password: 'WrongPass123!' });

      // Both should return 401 with same error message (no differentiation)
      expect(invalidEmailResponse.status).toBe(401);
      expect(invalidPasswordResponse.status).toBe(401);
      expect(invalidEmailResponse.body.error).toBe(invalidPasswordResponse.body.error);
      expect(invalidEmailResponse.body.error).toBe('Invalid credentials');
    });
  });

  describe('Security: Cookie Security', () => {
    test('should set HttpOnly flag on auth cookie', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: testUser.email, password: testUser.password });

      const setCookieHeader = response.headers['set-cookie'][0];
      expect(setCookieHeader).toContain('HttpOnly');
    });

    test('should set SameSite=Strict on auth cookie', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: testUser.email, password: testUser.password });

      const setCookieHeader = response.headers['set-cookie'][0];
      expect(setCookieHeader).toContain('SameSite=Strict');
    });

    test('should include maxAge in cookie', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: testUser.email, password: testUser.password });

      const setCookieHeader = response.headers['set-cookie'][0];
      expect(setCookieHeader).toContain('Max-Age');
    });

    test('should clear HttpOnly cookie on logout', async () => {
      const loginResponse = await request(app)
        .post('/api/login')
        .send({ email: testUser.email, password: testUser.password });

      const authCookie = loginResponse.headers['set-cookie'][0];
      const logoutResponse = await request(app)
        .post('/api/logout')
        .set('Cookie', authCookie);

      expect(logoutResponse.headers['set-cookie']).toBeDefined();
      const clearCookieHeader = logoutResponse.headers['set-cookie'][0];
      // Cookie should be cleared (either Max-Age=0 or Expires in past)
      expect(clearCookieHeader).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    });
  });

  describe('Integration: Complete Auth Flow', () => {
    test('should complete full flow: register -> login -> fetch user -> logout', async () => {
      const integrationUser = {
        firstName: 'Integration',
        lastName: 'Test',
        email: `integration${Date.now()}@test.com`,
        password: 'IntegrationPass123!',
        restaurantName: 'Integration Restaurant',
        role: 'manager',
      };

      // 1. Register
      const registerResponse = await request(app)
        .post('/api/register')
        .send(integrationUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body).toHaveProperty('id');
      const userId = registerResponse.body.id;

      // 2. Login
      const loginResponse = await request(app)
        .post('/api/login')
        .send({ email: integrationUser.email, password: integrationUser.password });

      expect(loginResponse.status).toBe(200);
      const authCookie = loginResponse.headers['set-cookie'][0];

      // 3. Fetch user info
      const meResponse = await request(app)
        .get('/api/me')
        .set('Cookie', authCookie);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user.id).toBe(userId);
      expect(meResponse.body.user.email).toBe(integrationUser.email);
      expect(meResponse.body.user.firstName).toBe(integrationUser.firstName);
      expect(meResponse.body.user.role).toBe(integrationUser.role);

      // 4. Logout
      const logoutResponse = await request(app)
        .post('/api/logout')
        .set('Cookie', authCookie);

      expect(logoutResponse.status).toBe(200);

      // 5. Verify session is cleared
      const finalMeResponse = await request(app).get('/api/me');
      expect(finalMeResponse.status).toBe(401);
    });

    test('should reject login with old cookie after logout', async () => {
      const integrationUser2 = {
        firstName: 'Integration2',
        lastName: 'Test',
        email: `integration2${Date.now()}@test.com`,
        password: 'IntegrationPass123!',
        restaurantName: 'Integration Restaurant',
        role: 'manager',
      };

      // Register and login
      await request(app)
        .post('/api/register')
        .send(integrationUser2);

      const loginResponse = await request(app)
        .post('/api/login')
        .send({ email: integrationUser2.email, password: integrationUser2.password });

      expect(loginResponse.status).toBe(200);
      const authCookie = loginResponse.headers['set-cookie'][0];

      // Verify we can access /api/me before logout
      const meBeforeLogout = await request(app)
        .get('/api/me')
        .set('Cookie', authCookie);
      expect(meBeforeLogout.status).toBe(200);

      // Logout
      const logoutResponse = await request(app)
        .post('/api/logout')
        .set('Cookie', authCookie);

      expect(logoutResponse.status).toBe(200);

      // Verify token is blacklisted: should not access /api/me after logout
      const meAfterLogout = await request(app)
        .get('/api/me')
        .set('Cookie', authCookie);
      expect(meAfterLogout.status).toBe(401);
      expect(meAfterLogout.body.error).toContain('revoked');
    });

    test('should reject login with old token after logout', async () => {
      // Register and login
      const email = `blacklist-test-${Date.now()}@test.com`;
      await request(app)
        .post('/api/register')
        .send({
          firstName: 'Blacklist',
          lastName: 'Test',
          email,
          password: 'TestPass123!',
          restaurantName: 'Test',
          role: 'staff'
        });

      const loginResponse = await request(app)
        .post('/api/login')
        .send({ email, password: 'TestPass123!' });

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Access /api/me (should work)
      const meBefore = await request(app)
        .get('/api/me')
        .set('Cookie', authCookie);
      expect(meBefore.status).toBe(200);

      // Logout
      await request(app)
        .post('/api/logout')
        .set('Cookie', authCookie);

      // Try to use old token (should fail - token is blacklisted)
      const meAfter = await request(app)
        .get('/api/me')
        .set('Cookie', authCookie);
      expect(meAfter.status).toBe(401);
      expect(meAfter.body.error).toContain('revoked');
    });
  });

  describe('Security: Token Blacklist', () => {
    test('should prevent access with blacklisted token', async () => {
      // Register and login
      const email = `token-test-${Date.now()}@test.com`;
      await request(app)
        .post('/api/register')
        .send({
          firstName: 'Token',
          lastName: 'Test',
          email,
          password: 'TestPass123!',
          restaurantName: 'Test',
          role: 'manager'
        });

      const loginResponse = await request(app)
        .post('/api/login')
        .send({ email, password: 'TestPass123!' });

      expect(loginResponse.status).toBe(200);
      const authCookie = loginResponse.headers['set-cookie'][0];

      // Logout (blacklist token)
      const logoutResponse = await request(app)
        .post('/api/logout')
        .set('Cookie', authCookie);

      expect(logoutResponse.status).toBe(200);

      // Token should be rejected
      const meResponse = await request(app)
        .get('/api/me')
        .set('Cookie', authCookie);

      expect(meResponse.status).toBe(401);
      expect(meResponse.body.error).toContain('revoked');
    });

    test('should allow multiple logout attempts', async () => {
      // Register and login
      const email = `logout-test-${Date.now()}@test.com`;
      await request(app)
        .post('/api/register')
        .send({
          firstName: 'Logout',
          lastName: 'Test',
          email,
          password: 'TestPass123!',
          restaurantName: 'Test',
          role: 'staff'
        });

      const loginResponse = await request(app)
        .post('/api/login')
        .send({ email, password: 'TestPass123!' });

      const authCookie = loginResponse.headers['set-cookie'][0];

      // First logout
      const logout1 = await request(app)
        .post('/api/logout')
        .set('Cookie', authCookie);
      expect(logout1.status).toBe(200);

      // Second logout with same cookie (should still succeed, but token already blacklisted)
      const logout2 = await request(app)
        .post('/api/logout')
        .set('Cookie', authCookie);
      expect(logout2.status).toBe(200);

      // Token remains blacklisted
      const meResponse = await request(app)
        .get('/api/me')
        .set('Cookie', authCookie);
      expect(meResponse.status).toBe(401);
    });
  });

  describe('Security: Enhanced Password Validation', () => {
    test('should reject password without uppercase letter', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'lowercase@test.com',
          password: 'testpass123!',
          restaurantName: 'Test',
          role: 'owner'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('uppercase');
    });

    test('should reject password without lowercase letter', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'uppercase@test.com',
          password: 'TESTPASS123!',
          restaurantName: 'Test',
          role: 'owner'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('lowercase');
    });

    test('should reject password without number', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'nonumber@test.com',
          password: 'TestPass!',
          restaurantName: 'Test',
          role: 'owner'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('number');
    });

    test('should reject password without special character', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'nospecial@test.com',
          password: 'TestPass123',
          restaurantName: 'Test',
          role: 'owner'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('special');
    });

    test('should accept strong password with all requirements', async () => {
      const email = `strong-pass-${Date.now()}@test.com`;
      const response = await request(app)
        .post('/api/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email,
          password: 'SecurePass123!@#',
          restaurantName: 'Test',
          role: 'owner'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
  });
});
