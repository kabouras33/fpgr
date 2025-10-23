/**
 * Restaurant Model
 * 
 * Represents restaurant locations with multi-location support.
 */

const BaseModel = require('./BaseModel');

class Restaurant extends BaseModel {
  constructor() {
    super('restaurants', [
      'id', 'name', 'legal_name', 'tax_id', 'phone', 'email', 'website',
      'address_line1', 'address_line2', 'city', 'state', 'postal_code',
      'country', 'timezone', 'currency', 'is_active', 'created_at', 'updated_at'
    ], {
      name: {
        required: true,
        type: 'string',
        maxLength: 100
      },
      legal_name: {
        type: 'string',
        maxLength: 150
      },
      phone: {
        type: 'string',
        maxLength: 20
      },
      email: {
        type: 'string',
        email: true,
        maxLength: 254
      },
      address_line1: {
        type: 'string',
        maxLength: 100
      },
      city: {
        type: 'string',
        maxLength: 50
      },
      state: {
        type: 'string',
        maxLength: 50
      },
      postal_code: {
        type: 'string',
        maxLength: 20
      },
      country: {
        type: 'string',
        maxLength: 50
      },
      timezone: {
        type: 'string',
        maxLength: 50
      },
      currency: {
        type: 'string',
        maxLength: 3
      }
    });
  }

  /**
   * Get active restaurants
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of active restaurants
   */
  async findActive(options = {}) {
    return await this.findAll({
      where: { is_active: true, ...options.where },
      orderBy: options.orderBy || 'name ASC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Get restaurant with user count
   * @param {string} id - Restaurant ID
   * @returns {Promise<Object>} - Restaurant with stats
   */
  async findWithStats(id) {
    const query = `
      SELECT r.*,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT t.id) as table_count,
        COUNT(DISTINCT mi.id) as menu_item_count
      FROM restaurants r
      LEFT JOIN users u ON u.restaurant_id = r.id AND u.is_active = true
      LEFT JOIN tables t ON t.restaurant_id = r.id AND t.is_active = true
      LEFT JOIN menu_items mi ON mi.restaurant_id = r.id AND mi.is_available = true
      WHERE r.id = $1
      GROUP BY r.id
    `;
    
    const result = await this.query(query, [id]);
    return result[0] || null;
  }

  /**
   * Deactivate restaurant
   * @param {string} id - Restaurant ID
   * @returns {Promise<Object>} - Updated restaurant
   */
  async deactivate(id) {
    return await this.update(id, { is_active: false });
  }

  /**
   * Activate restaurant
   * @param {string} id - Restaurant ID
   * @returns {Promise<Object>} - Updated restaurant
   */
  async activate(id) {
    return await this.update(id, { is_active: true });
  }
}

module.exports = new Restaurant();
