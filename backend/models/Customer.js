/**
 * Customer Model
 * 
 * Represents customers with loyalty points and preferences.
 */

const BaseModel = require('./BaseModel');

class Customer extends BaseModel {
  constructor() {
    super('customers', [
      'id', 'restaurant_id', 'first_name', 'last_name', 'email',
      'phone', 'date_of_birth', 'loyalty_points', 'total_orders',
      'total_spent', 'preferences', 'allergies', 'notes',
      'is_active', 'created_at', 'updated_at'
    ], {
      restaurant_id: {
        required: true,
        type: 'string'
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
      email: {
        type: 'string',
        email: true,
        maxLength: 254
      },
      phone: {
        required: true,
        type: 'string',
        maxLength: 20
      },
      loyalty_points: {
        type: 'number',
        min: 0
      }
    });
  }

  /**
   * Find customer by phone
   * @param {string} restaurantId - Restaurant ID
   * @param {string} phone - Customer phone
   * @returns {Promise<Object|null>} - Customer or null
   */
  async findByPhone(restaurantId, phone) {
    return await this.findOne({ restaurant_id: restaurantId, phone });
  }

  /**
   * Find customer by email
   * @param {string} restaurantId - Restaurant ID
   * @param {string} email - Customer email
   * @returns {Promise<Object|null>} - Customer or null
   */
  async findByEmail(restaurantId, email) {
    return await this.findOne({ restaurant_id: restaurantId, email });
  }

  /**
   * Get customers by restaurant
   * @param {string} restaurantId - Restaurant ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of customers
   */
  async findByRestaurant(restaurantId, options = {}) {
    return await this.findAll({
      where: { restaurant_id: restaurantId, is_active: true, ...options.where },
      orderBy: options.orderBy || 'created_at DESC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Search customers by name, email, or phone
   * @param {string} restaurantId - Restaurant ID
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching customers
   */
  async search(restaurantId, searchTerm) {
    const query = `
      SELECT * FROM customers
      WHERE restaurant_id = $1
        AND is_active = true
        AND (
          first_name ILIKE $2
          OR last_name ILIKE $2
          OR email ILIKE $2
          OR phone ILIKE $2
        )
      ORDER BY last_name, first_name
    `;

    return await this.query(query, [restaurantId, `%${searchTerm}%`]);
  }

  /**
   * Add loyalty points to customer
   * @param {string} id - Customer ID
   * @param {number} points - Points to add
   * @returns {Promise<Object>} - Updated customer
   */
  async addLoyaltyPoints(id, points) {
    const customer = await this.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const newPoints = (customer.loyalty_points || 0) + points;
    return await this.update(id, { loyalty_points: newPoints });
  }

  /**
   * Redeem loyalty points
   * @param {string} id - Customer ID
   * @param {number} points - Points to redeem
   * @returns {Promise<Object>} - Updated customer
   */
  async redeemLoyaltyPoints(id, points) {
    const customer = await this.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer.loyalty_points < points) {
      throw new Error('Insufficient loyalty points');
    }

    const newPoints = customer.loyalty_points - points;
    return await this.update(id, { loyalty_points: newPoints });
  }

  /**
   * Update customer order statistics
   * @param {string} id - Customer ID
   * @param {number} orderAmount - Order amount
   * @returns {Promise<Object>} - Updated customer
   */
  async updateOrderStats(id, orderAmount) {
    const customer = await this.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    return await this.update(id, {
      total_orders: (customer.total_orders || 0) + 1,
      total_spent: (customer.total_spent || 0) + orderAmount
    });
  }

  /**
   * Get top customers by spending
   * @param {string} restaurantId - Restaurant ID
   * @param {number} limit - Number of customers to return
   * @returns {Promise<Array>} - Top customers
   */
  async getTopCustomers(restaurantId, limit = 10) {
    const query = `
      SELECT *
      FROM customers
      WHERE restaurant_id = $1
        AND is_active = true
      ORDER BY total_spent DESC
      LIMIT $2
    `;

    return await this.query(query, [restaurantId, limit]);
  }

  /**
   * Get customer with order history
   * @param {string} id - Customer ID
   * @returns {Promise<Object>} - Customer with orders
   */
  async findWithOrderHistory(id) {
    const query = `
      SELECT 
        c.*,
        json_agg(
          json_build_object(
            'order_id', o.id,
            'order_number', o.order_number,
            'order_type', o.order_type,
            'total_amount', o.total_amount,
            'status', o.status,
            'created_at', o.created_at
          ) ORDER BY o.created_at DESC
        ) FILTER (WHERE o.id IS NOT NULL) as order_history
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `;

    const result = await this.query(query, [id]);
    return result[0] || null;
  }

  /**
   * Get customers with birthdays in date range
   * @param {string} restaurantId - Restaurant ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} - Customers with birthdays
   */
  async findBirthdaysInRange(restaurantId, startDate, endDate) {
    const query = `
      SELECT *
      FROM customers
      WHERE restaurant_id = $1
        AND is_active = true
        AND date_of_birth IS NOT NULL
        AND (
          (EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM $2::date) 
           AND EXTRACT(DAY FROM date_of_birth) >= EXTRACT(DAY FROM $2::date))
          OR
          (EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM $3::date) 
           AND EXTRACT(DAY FROM date_of_birth) <= EXTRACT(DAY FROM $3::date))
        )
      ORDER BY 
        EXTRACT(MONTH FROM date_of_birth),
        EXTRACT(DAY FROM date_of_birth)
    `;

    return await this.query(query, [restaurantId, startDate, endDate]);
  }

  /**
   * Deactivate customer
   * @param {string} id - Customer ID
   * @returns {Promise<Object>} - Updated customer
   */
  async deactivate(id) {
    return await this.update(id, { is_active: false });
  }

  /**
   * Activate customer
   * @param {string} id - Customer ID
   * @returns {Promise<Object>} - Updated customer
   */
  async activate(id) {
    return await this.update(id, { is_active: true });
  }
}

module.exports = new Customer();
