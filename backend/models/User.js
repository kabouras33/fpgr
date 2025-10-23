/**
 * User Model
 * 
 * Represents users in the system with authentication and authorization.
 * Supports roles: owner, manager, staff, admin
 */

const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');

class User extends BaseModel {
  constructor() {
    super('users', [
      'id', 'email', 'password_hash', 'first_name', 'last_name',
      'phone', 'role', 'restaurant_id', 'is_active', 'last_login',
      'created_at', 'updated_at', 'created_by', 'updated_by'
    ], {
      email: {
        required: true,
        type: 'string',
        email: true,
        maxLength: 254
      },
      password: {
        required: true,
        type: 'string',
        minLength: 8,
        custom: (value) => {
          // Password strength validation
          if (!/[A-Z]/.test(value)) {
            return 'Password must contain at least one uppercase letter';
          }
          if (!/[a-z]/.test(value)) {
            return 'Password must contain at least one lowercase letter';
          }
          if (!/[0-9]/.test(value)) {
            return 'Password must contain at least one number';
          }
          return null;
        }
      },
      first_name: {
        required: true,
        type: 'string',
        maxLength: 50
      },
      last_name: {
        required: true,
        type: 'string',
        maxLength: 50
      },
      phone: {
        type: 'string',
        maxLength: 20
      },
      role: {
        required: true,
        type: 'string',
        enum: ['owner', 'manager', 'staff', 'admin']
      },
      restaurant_id: {
        type: 'string'
      }
    });
  }

  /**
   * Hash password before storing
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - True if password matches
   */
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Create a new user with hashed password
   * @param {Object} data - User data
   * @returns {Promise<Object>} - Created user
   */
  async create(data) {
    // Hash password before creating user
    if (data.password) {
      data.password_hash = await this.hashPassword(data.password);
      delete data.password;
    }

    const user = await super.create(data);
    
    // Remove password_hash from response
    delete user.password_hash;
    return user;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User or null
   */
  async findByEmail(email) {
    return await this.findOne({ email });
  }

  /**
   * Authenticate user with email and password
   * @param {string} email - User email
   * @param {string} password - Plain text password
   * @returns {Promise<Object|null>} - User object or null
   */
  async authenticate(email, password) {
    const user = await this.findByEmail(email);
    
    if (!user) {
      return null;
    }

    if (!user.is_active) {
      throw new Error('User account is deactivated');
    }

    const isValidPassword = await this.comparePassword(password, user.password_hash);
    
    if (!isValidPassword) {
      return null;
    }

    // Update last login
    await this.update(user.id, { last_login: new Date() });

    // Remove password_hash from response
    delete user.password_hash;
    return user;
  }

  /**
   * Get users by restaurant
   * @param {string} restaurantId - Restaurant ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of users
   */
  async findByRestaurant(restaurantId, options = {}) {
    return await this.findAll({
      where: { restaurant_id: restaurantId, ...options.where },
      orderBy: options.orderBy || 'created_at DESC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Get users by role
   * @param {string} role - User role
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of users
   */
  async findByRole(role, options = {}) {
    return await this.findAll({
      where: { role, ...options.where },
      orderBy: options.orderBy || 'created_at DESC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Deactivate user account
   * @param {string} id - User ID
   * @returns {Promise<Object>} - Updated user
   */
  async deactivate(id) {
    return await this.update(id, { is_active: false });
  }

  /**
   * Activate user account
   * @param {string} id - User ID
   * @returns {Promise<Object>} - Updated user
   */
  async activate(id) {
    return await this.update(id, { is_active: true });
  }

  /**
   * Change user password
   * @param {string} id - User ID
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} - True if password changed
   */
  async changePassword(id, oldPassword, newPassword) {
    const user = await this.findById(id);
    
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await this.comparePassword(oldPassword, user.password_hash);
    
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const newHash = await this.hashPassword(newPassword);
    await this.update(id, { password_hash: newHash });
    
    return true;
  }

  /**
   * Reset user password (admin function)
   * @param {string} id - User ID
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} - True if password reset
   */
  async resetPassword(id, newPassword) {
    const newHash = await this.hashPassword(newPassword);
    await this.update(id, { password_hash: newHash });
    return true;
  }
}

module.exports = new User();
