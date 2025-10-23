/**
 * Table Model
 * 
 * Represents physical tables in the restaurant with status tracking.
 */

const BaseModel = require('./BaseModel');

class Table extends BaseModel {
  constructor() {
    super('tables', [
      'id', 'restaurant_id', 'table_number', 'section', 'capacity',
      'status', 'qr_code', 'position_x', 'position_y', 'is_active',
      'created_at', 'updated_at'
    ], {
      restaurant_id: {
        required: true,
        type: 'string'
      },
      table_number: {
        required: true,
        type: 'string',
        maxLength: 20
      },
      capacity: {
        required: true,
        type: 'number',
        min: 1
      },
      status: {
        type: 'string',
        enum: ['available', 'occupied', 'reserved', 'cleaning']
      },
      section: {
        type: 'string',
        maxLength: 50
      }
    });
  }

  /**
   * Get tables by restaurant
   * @param {string} restaurantId - Restaurant ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of tables
   */
  async findByRestaurant(restaurantId, options = {}) {
    return await this.findAll({
      where: { restaurant_id: restaurantId, is_active: true, ...options.where },
      orderBy: options.orderBy || 'section ASC, table_number ASC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Get available tables
   * @param {string} restaurantId - Restaurant ID
   * @param {number} capacity - Minimum capacity needed
   * @returns {Promise<Array>} - Array of available tables
   */
  async findAvailable(restaurantId, capacity = null) {
    const where = {
      restaurant_id: restaurantId,
      status: 'available',
      is_active: true
    };

    let query = `SELECT * FROM ${this.tableName} WHERE restaurant_id = $1 AND status = $2 AND is_active = $3`;
    const params = [restaurantId, 'available', true];

    if (capacity) {
      query += ` AND capacity >= $4`;
      params.push(capacity);
    }

    query += ` ORDER BY capacity ASC`;

    return await this.query(query, params);
  }

  /**
   * Get tables by section
   * @param {string} restaurantId - Restaurant ID
   * @param {string} section - Section name
   * @returns {Promise<Array>} - Array of tables
   */
  async findBySection(restaurantId, section) {
    return await this.findAll({
      where: { restaurant_id: restaurantId, section, is_active: true },
      orderBy: 'table_number ASC'
    });
  }

  /**
   * Update table status
   * @param {string} id - Table ID
   * @param {string} status - New status
   * @returns {Promise<Object>} - Updated table
   */
  async updateStatus(id, status) {
    return await this.update(id, { status });
  }

  /**
   * Get table with current order
   * @param {string} id - Table ID
   * @returns {Promise<Object>} - Table with order details
   */
  async findWithCurrentOrder(id) {
    const query = `
      SELECT 
        t.*,
        json_build_object(
          'order_id', o.id,
          'order_number', o.order_number,
          'status', o.status,
          'total_amount', o.total_amount,
          'created_at', o.created_at
        ) as current_order
      FROM tables t
      LEFT JOIN LATERAL (
        SELECT * FROM orders
        WHERE table_id = t.id
          AND status NOT IN ('completed', 'cancelled')
        ORDER BY created_at DESC
        LIMIT 1
      ) o ON true
      WHERE t.id = $1
    `;

    const result = await this.query(query, [id]);
    return result[0] || null;
  }

  /**
   * Get table occupancy statistics
   * @param {string} restaurantId - Restaurant ID
   * @returns {Promise<Object>} - Occupancy stats
   */
  async getOccupancyStats(restaurantId) {
    const query = `
      SELECT 
        COUNT(*) as total_tables,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_tables,
        COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied_tables,
        COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved_tables,
        COUNT(CASE WHEN status = 'cleaning' THEN 1 END) as cleaning_tables,
        SUM(capacity) as total_capacity,
        SUM(CASE WHEN status = 'available' THEN capacity ELSE 0 END) as available_capacity
      FROM tables
      WHERE restaurant_id = $1 AND is_active = true
    `;

    const result = await this.query(query, [restaurantId]);
    return result[0];
  }

  /**
   * Mark table as occupied
   * @param {string} id - Table ID
   * @returns {Promise<Object>} - Updated table
   */
  async markOccupied(id) {
    return await this.updateStatus(id, 'occupied');
  }

  /**
   * Mark table as available
   * @param {string} id - Table ID
   * @returns {Promise<Object>} - Updated table
   */
  async markAvailable(id) {
    return await this.updateStatus(id, 'available');
  }

  /**
   * Mark table for cleaning
   * @param {string} id - Table ID
   * @returns {Promise<Object>} - Updated table
   */
  async markForCleaning(id) {
    return await this.updateStatus(id, 'cleaning');
  }
}

module.exports = new Table();
