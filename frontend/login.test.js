/**
 * Unit Tests for Frontend Login Component
 * Tests cover: form validation, API calls, error handling, user interactions
 * Uses vanilla JavaScript testing approach compatible with Jest
 */

// Mock DOM elements setup
class LoginFormTestSuite {
  constructor() {
    this.formElement = null;
    this.emailInput = null;
    this.passwordInput = null;
    this.errorElements = null;
    this.fetchMock = null;
  }

  /**
   * Setup: Create mock HTML structure before each test
   */
  setup() {
    // Clear DOM
    document.body.innerHTML = '';

    // Create login form structure
    const html = `
      <form id="loginForm" novalidate>
        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required autocomplete="email">
          <span class="error" data-for="email"></span>
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" required autocomplete="current-password">
          <span class="error" data-for="password"></span>
        </div>

        <div class="actions">
          <button type="submit" class="btn primary">Sign in</button>
        </div>
      </form>
    `;

    document.body.innerHTML = html;

    this.formElement = document.getElementById('loginForm');
    this.emailInput = document.getElementById('email');
    this.passwordInput = document.getElementById('password');
    this.errorElements = document.querySelectorAll('.error');

    // Mock fetch globally
    this.mockFetch();

    // Load and initialize login.js logic
    this.initializeLoginLogic();
  }

  /**
   * Mock global fetch function for testing API calls
   */
  mockFetch() {
    global.fetch = jest.fn();
  }

  /**
   * Initialize the login form event listeners
   * This replicates the logic from login.js
   */
  initializeLoginLogic() {
    const form = this.formElement;

    const showError = (name, message) => {
      const el = document.querySelector(`.error[data-for="${name}"]`);
      if (el) el.textContent = message || '';
    };

    const clearErrors = () => {
      document.querySelectorAll('.error').forEach(e => e.textContent = '');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      let valid = true;

      // Validation checks
      if (!email) {
        showError('email', 'Enter your email');
        valid = false;
      }

      if (!password) {
        showError('password', 'Enter your password');
        valid = false;
      }

      if (!valid) return;

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Login failed' }));
          showError('email', err.error || 'Login failed');
          return;
        }

        // Success - would redirect in real app
        window.location.href = 'dashboard.html';
      } catch (err) {
        showError('email', 'Network error');
      }
    });
  }

  /**
   * TEST 1: Form loads with empty fields
   */
  testFormInitialization() {
    expect(this.emailInput.value).toBe('');
    expect(this.passwordInput.value).toBe('');
    
    // All error messages should be empty initially
    this.errorElements.forEach(el => {
      expect(el.textContent).toBe('');
    });
  }

  /**
   * TEST 2: Email validation - missing email error
   */
  testMissingEmailError() {
    this.emailInput.value = '';
    this.passwordInput.value = 'TestPass123!';

    this.formElement.dispatchEvent(new Event('submit'));

    const emailError = document.querySelector('.error[data-for="email"]');
    expect(emailError.textContent).toBe('Enter your email');
  }

  /**
   * TEST 3: Password validation - missing password error
   */
  testMissingPasswordError() {
    this.emailInput.value = 'test@example.com';
    this.passwordInput.value = '';

    this.formElement.dispatchEvent(new Event('submit'));

    const passwordError = document.querySelector('.error[data-for="password"]');
    expect(passwordError.textContent).toBe('Enter your password');
  }

  /**
   * TEST 4: Both fields empty - show both errors
   */
  testBothFieldsEmpty() {
    this.emailInput.value = '';
    this.passwordInput.value = '';

    this.formElement.dispatchEvent(new Event('submit'));

    const emailError = document.querySelector('.error[data-for="email"]');
    const passwordError = document.querySelector('.error[data-for="password"]');

    expect(emailError.textContent).toBe('Enter your email');
    expect(passwordError.textContent).toBe('Enter your password');
  }

  /**
   * TEST 5: Whitespace-only email is treated as empty
   */
  testWhitespaceOnlyEmail() {
    this.emailInput.value = '   ';
    this.passwordInput.value = 'TestPass123!';

    this.formElement.dispatchEvent(new Event('submit'));

    const emailError = document.querySelector('.error[data-for="email"]');
    expect(emailError.textContent).toBe('Enter your email');
  }

  /**
   * TEST 6: Valid credentials submitted successfully
   */
  async testSuccessfulLogin() {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'abc123' })
    });

    // Mock window.location.href
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };

    this.emailInput.value = 'user@example.com';
    this.passwordInput.value = 'TestPass123!';

    this.formElement.dispatchEvent(new Event('submit'));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check that fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        email: 'user@example.com', 
        password: 'TestPass123!' 
      })
    }));

    // Check redirect occurred
    expect(window.location.href).toBe('dashboard.html');

    // Restore window.location
    window.location = originalLocation;
  }

  /**
   * TEST 7: API returns error response
   */
  async testLoginFailure() {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' })
    });

    this.emailInput.value = 'user@example.com';
    this.passwordInput.value = 'WrongPassword';

    this.formElement.dispatchEvent(new Event('submit'));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    const emailError = document.querySelector('.error[data-for="email"]');
    expect(emailError.textContent).toBe('Invalid credentials');
  }

  /**
   * TEST 8: Network error handling
   */
  async testNetworkError() {
    global.fetch.mockRejectedValueOnce(new Error('Network unreachable'));

    this.emailInput.value = 'user@example.com';
    this.passwordInput.value = 'TestPass123!';

    this.formElement.dispatchEvent(new Event('submit'));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    const emailError = document.querySelector('.error[data-for="email"]');
    expect(emailError.textContent).toBe('Network error');
  }

  /**
   * TEST 9: API returns malformed JSON
   */
  async testMalformedErrorResponse() {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('Invalid JSON');
      }
    });

    this.emailInput.value = 'user@example.com';
    this.passwordInput.value = 'TestPass123!';

    this.formElement.dispatchEvent(new Event('submit'));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    const emailError = document.querySelector('.error[data-for="email"]');
    expect(emailError.textContent).toBe('Login failed');
  }

  /**
   * TEST 10: Error messages clear on new submission attempt
   */
  async testErrorClearOnNewSubmit() {
    // First submission with error
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' })
    });

    this.emailInput.value = 'user@example.com';
    this.passwordInput.value = 'WrongPassword';
    this.formElement.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 0));

    let emailError = document.querySelector('.error[data-for="email"]');
    expect(emailError.textContent).toBe('Invalid credentials');

    // Second submission with different error
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Account locked' })
    });

    this.emailInput.value = 'another@example.com';
    this.passwordInput.value = 'AnotherPass123!';
    this.formElement.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 0));

    emailError = document.querySelector('.error[data-for="email"]');
    expect(emailError.textContent).toBe('Account locked');
  }

  /**
   * TEST 11: Form prevents default submission behavior
   */
  testFormPreventDefault() {
    const submitEvent = new Event('submit');
    const preventDefaultSpy = jest.spyOn(submitEvent, 'preventDefault');

    this.emailInput.value = '';
    this.passwordInput.value = '';

    this.formElement.dispatchEvent(submitEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    preventDefaultSpy.mockRestore();
  }

  /**
   * TEST 12: Special characters in email are handled
   */
  testSpecialCharactersInEmail() {
    this.emailInput.value = 'user+tag@example.co.uk';
    this.passwordInput.value = 'TestPass123!';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'abc123' })
    });

    this.formElement.dispatchEvent(new Event('submit'));

    // Should not show error
    const emailError = document.querySelector('.error[data-for="email"]');
    expect(emailError.textContent).toBe('');
  }

  /**
   * TEST 13: Very long email is submitted (no client-side length limit)
   */
  testVeryLongEmail() {
    const longEmail = 'a'.repeat(200) + '@example.com';
    this.emailInput.value = longEmail;
    this.passwordInput.value = 'TestPass123!';

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid email' })
    });

    this.formElement.dispatchEvent(new Event('submit'));

    // Should submit to API (server validates)
    expect(global.fetch).toHaveBeenCalled();
  }

  /**
   * TEST 14: Credentials are sent via POST with proper headers
   */
  async testCorrectHTTPMethod() {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'abc123' })
    });

    this.emailInput.value = 'test@example.com';
    this.passwordInput.value = 'TestPass123!';

    this.formElement.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 0));

    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/login');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].headers['Content-Type']).toBe('application/json');
    expect(callArgs[1].credentials).toBe('include');
  }

  /**
   * TEST 15: Password is not visible in network request (HTTPS implicit)
   */
  testPasswordNotLogged() {
    this.emailInput.value = 'user@example.com';
    this.passwordInput.value = 'MySecretPass123!';

    global.fetch.mockResolvedValueOnce({
      ok: true
    });

    this.formElement.dispatchEvent(new Event('submit'));

    // Verify password is sent in body but not visible in URL
    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).not.toContain('MySecretPass123!');
    expect(callArgs[1].body).toContain('MySecretPass123!');
  }

  /**
   * Run all tests
   */
  runAllTests() {
    describe('Frontend Login Component', () => {
      beforeEach(() => {
        this.setup();
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      test('Form initializes with empty fields', () => {
        this.testFormInitialization();
      });

      test('Shows error when email is missing', () => {
        this.testMissingEmailError();
      });

      test('Shows error when password is missing', () => {
        this.testMissingPasswordError();
      });

      test('Shows both errors when both fields are empty', () => {
        this.testBothFieldsEmpty();
      });

      test('Treats whitespace-only email as empty', () => {
        this.testWhitespaceOnlyEmail();
      });

      test('Successful login redirects to dashboard', async () => {
        await this.testSuccessfulLogin();
      });

      test('API error response shows error message', async () => {
        await this.testLoginFailure();
      });

      test('Network error shows appropriate message', async () => {
        await this.testNetworkError();
      });

      test('Malformed error response shows default message', async () => {
        await this.testMalformedErrorResponse();
      });

      test('Error messages clear on new submission', async () => {
        await this.testErrorClearOnNewSubmit();
      });

      test('Form prevents default submission behavior', () => {
        this.testFormPreventDefault();
      });

      test('Special characters in email are handled', () => {
        this.testSpecialCharactersInEmail();
      });

      test('Very long email is submitted to API', () => {
        this.testVeryLongEmail();
      });

      test('Credentials sent with correct HTTP method and headers', async () => {
        await this.testCorrectHTTPMethod();
      });

      test('Password not exposed in URL', () => {
        this.testPasswordNotLogged();
      });
    });
  }
}

// Run tests if this file is executed
if (typeof describe !== 'undefined') {
  const suite = new LoginFormTestSuite();
  suite.runAllTests();
}

module.exports = LoginFormTestSuite;
