/**
 * Base Model Class
 * 
 * Provides common database operations for all models including:
 * - CRUD operations (Create, Read, Update, Delete)
 * - Query building
 * - Validation
 * - Timestamps management
 * 
 * All models should extend this base class.
 */

const { pool } = require('./db');

class BaseModel {
  /**
   * Constructor
   * @param {string} tableName - The name of the database table
   * @param {Array} columns - Array of column names
   * @param {Object} validations - Validation rules for columns
   */
  constructor(tableName, columns, validations = {}) {
    this.tableName = tableName;
    this.columns = columns;
    this.validations = validations;
  }

  /**
   * Validate data against defined rules
   * @param {Object} data - Data to validate
   * @returns {Object} - { isValid: boolean, errors: Array }
   */
  validate(data) {
    const errors = [];

    for (const [field, rules] of Object.entries(this.validations)) {
      const value = data[field];

      // Required check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip other validations if value is not provided and not required
      if (value === undefined || value === null) continue;

      // Type check
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
      }

      // Min length
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      // Max length
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must not exceed ${rules.maxLength} characters`);
      }

      // Email validation
      if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`${field} must be a valid email address`);
      }

      // Min value
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }

      // Max value
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must not exceed ${rules.max}`);
      }

      // Enum check
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }

      // Custom validation function
      if (rules.custom && typeof rules.custom === 'function') {
        const customError = rules.custom(value, data);
        if (customError) {
          errors.push(customError);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Find all records with optional filtering
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of records
   */
  async findAll(options = {}) {
    try {
      const { where = {}, orderBy = 'created_at DESC', limit, offset } = options;

      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];
      let paramCount = 1;

      // WHERE clause
      if (Object.keys(where).length > 0) {
        const conditions = [];
        for (const [key, value] of Object.entries(where)) {
          if (value === null) {
            conditions.push(`${key} IS NULL`);
          } else if (Array.isArray(value)) {
            conditions.push(`${key} = ANY($${paramCount})`);
            params.push(value);
            paramCount++;
          } else {
            conditions.push(`${key} = $${paramCount}`);
            params.push(value);
            paramCount++;
          }
        }
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      // ORDER BY
      if (orderBy) {
        query += ` ORDER BY ${orderBy}`;
      }

      // LIMIT
      if (limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(limit);
        paramCount++;
      }

      // OFFSET
      if (offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(offset);
      }

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding records in ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Find a single record by ID
   * @param {string} id - Record ID (UUID)
   * @returns {Promise<Object|null>} - Record or null
   */
  async findById(id) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding record by ID in ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Find a single record by criteria
   * @param {Object} where - Query conditions
   * @returns {Promise<Object|null>} - Record or null
   */
  async findOne(where = {}) {
    try {
      const records = await this.findAll({ where, limit: 1 });
      return records[0] || null;
    } catch (error) {
      throw new Error(`Error finding one record in ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @returns {Promise<Object>} - Created record
   */
  async create(data) {
    try {
      // Validate data
      const validation = this.validate(data);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Add timestamps
      data.created_at = new Date();
      data.updated_at = new Date();

      // Build INSERT query
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO ${this.tableName} (${keys.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating record in ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Update a record by ID
   * @param {string} id - Record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} - Updated record
   */
  async update(id, data) {
    try {
      // Validate data (partial validation for updates)
      const validation = this.validate(data);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Add updated timestamp
      data.updated_at = new Date();

      // Build UPDATE query
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

      const query = `
        UPDATE ${this.tableName}
        SET ${setClause}
        WHERE id = $${keys.length + 1}
        RETURNING *
      `;

      const result = await pool.query(query, [...values, id]);
      
      if (result.rows.length === 0) {
        throw new Error(`Record with ID ${id} not found`);
      }

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating record in ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<boolean>} - True if deleted
   */
  async delete(id) {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING id`;
      const result = await pool.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Error deleting record from ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Count records with optional filtering
   * @param {Object} where - Query conditions
   * @returns {Promise<number>} - Count of records
   */
  async count(where = {}) {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params = [];
      let paramCount = 1;

      if (Object.keys(where).length > 0) {
        const conditions = [];
        for (const [key, value] of Object.entries(where)) {
          conditions.push(`${key} = $${paramCount}`);
          params.push(value);
          paramCount++;
        }
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await pool.query(query, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      throw new Error(`Error counting records in ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Execute a raw SQL query
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Query results
   */
  async query(query, params = []) {
    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error executing query: ${error.message}`);
    }
  }

  /**
   * Begin a transaction
   * @returns {Promise<Object>} - Client object for transaction
   */
  async beginTransaction() {
    const client = await pool.connect();
    await client.query('BEGIN');
    return client;
  }

  /**
   * Commit a transaction
   * @param {Object} client - Client object
   */
  async commit(client) {
    await client.query('COMMIT');
    client.release();
  }

  /**
   * Rollback a transaction
   * @param {Object} client - Client object
   */
  async rollback(client) {
    await client.query('ROLLBACK');
    client.release();
  }
}

module.exports = BaseModel;
