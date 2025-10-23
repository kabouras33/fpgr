/**
 * Enhanced Login Form Handler
 * Features:
 * - Real-time validation feedback
 * - Loading state with visual spinner
 * - Comprehensive error handling
 * - Network error recovery
 * - Accessible error messages
 * - Remember me functionality (placeholder)
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const successMessage = document.getElementById('successMessage');
  const generalError = document.getElementById('generalError');
  const rememberCheckbox = document.getElementById('remember');

  /**
   * Display error message for a specific field
   * @param {string} fieldName - Field identifier
   * @param {string} message - Error message to display
   */
  function showError(fieldName, message) {
    const errorEl = document.querySelector(`.error[data-for="${fieldName}"]`);
    if (errorEl) {
      errorEl.textContent = message || '';
      errorEl.style.display = message ? 'block' : 'none';
    }
  }

  /**
   * Clear all error messages and alerts
   */
  function clearErrors() {
    document.querySelectorAll('.error').forEach(e => {
      e.textContent = '';
      e.style.display = 'none';
    });
    generalError.style.display = 'none';
    generalError.textContent = '';
  }

  /**
   * Show loading state on submit button
   */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      loadingSpinner.style.display = 'inline-block';
      submitBtn.style.opacity = '0.8';
    } else {
      loadingSpinner.style.display = 'none';
      submitBtn.style.opacity = '1';
    }
  }

  /**
   * Show success message and prepare for redirect
   */
  function showSuccess() {
    successMessage.style.display = 'block';
    successMessage.setAttribute('role', 'status');
    successMessage.setAttribute('aria-live', 'polite');
  }

  /**
   * Validate email format (basic client-side check)
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email format
   */
  function isValidEmail(email) {
    // Basic email regex - server will do comprehensive validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Real-time email validation on input
   */
  emailInput.addEventListener('blur', () => {
    const email = emailInput.value.trim();
    
    if (email && !isValidEmail(email)) {
      showError('email', 'Please enter a valid email address');
    } else {
      showError('email', '');
    }
  });

  /**
   * Clear email error when user starts typing valid email
   */
  emailInput.addEventListener('input', () => {
    const email = emailInput.value.trim();
    
    if (email && isValidEmail(email)) {
      showError('email', '');
    }
  });

  /**
   * Form submission handler with comprehensive validation and error handling
   */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    // Get trimmed input values
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberCheckbox.checked;

    // Client-side validation
    let isValid = true;

    if (!email) {
      showError('email', 'Email address is required');
      isValid = false;
    } else if (!isValidEmail(email)) {
      showError('email', 'Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      showError('password', 'Password is required');
      isValid = false;
    }

    // Return early if validation fails
    if (!isValid) {
      return;
    }

    // Set loading state
    setLoading(true);

    try {
      // Send login request to backend API
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for HttpOnly session
        body: JSON.stringify({ email, password })
      });

      // Handle non-200 responses (401, 403, 500, etc.)
      if (!response.ok) {
        let errorMessage = 'Login failed';

        try {
          // Try to parse error details from response
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;

          // Handle specific HTTP status codes
          if (response.status === 401) {
            errorMessage = 'Invalid email or password';
          } else if (response.status === 403) {
            errorMessage = 'Account is locked. Please try again later.';
          } else if (response.status === 429) {
            errorMessage = 'Too many login attempts. Please try again later.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          }
        } catch (parseErr) {
          // Response was not JSON - use default message
          errorMessage = 'Login failed. Please try again.';
        }

        showError('email', errorMessage);
        setLoading(false);
        return;
      }

      // Successful login
      showSuccess();

      // Store remember me preference (optional)
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }

      // Redirect to dashboard after brief delay to show success message
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);

    } catch (error) {
      // Network error or other client-side issues
      console.error('Login error:', error);

      let errorMessage = 'Network error. Please check your connection and try again.';

      if (error.message === 'Failed to fetch') {
        errorMessage = 'Cannot reach the server. Check your internet connection.';
      } else if (error.timeout) {
        errorMessage = 'Request timed out. Please try again.';
      }

      // Show error in general error area
      generalError.textContent = errorMessage;
      generalError.style.display = 'block';
      generalError.setAttribute('role', 'alert');

      setLoading(false);
    }
  });

  /**
   * Keyboard shortcuts
   * - Enter key in password field submits form
   */
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      form.dispatchEvent(new Event('submit'));
    }
  });

  /**
   * Optional: Pre-fill email from localStorage if "remember me" was checked
   */
  if (localStorage.getItem('rememberMe') === 'true') {
    const savedEmail = localStorage.getItem('loginEmail');
    if (savedEmail) {
      emailInput.value = savedEmail;
      rememberCheckbox.checked = true;
    }
  }
});
