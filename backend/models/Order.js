/**
 * Order Model
 * 
 * Represents customer orders with status tracking and payment processing.
 */

const BaseModel = require('./BaseModel');

class Order extends BaseModel {
  constructor() {
    super('orders', [
      'id', 'restaurant_id', 'table_id', 'customer_id', 'order_number',
      'order_type', 'status', 'subtotal', 'tax_amount', 'tip_amount',
      'discount_amount', 'total_amount', 'payment_status', 'payment_method',
      'served_by', 'notes', 'created_at', 'updated_at', 'completed_at'
    ], {
      restaurant_id: {
        required: true,
        type: 'string'
      },
      order_number: {
        required: true,
        type: 'string',
        maxLength: 50
      },
      order_type: {
        required: true,
        type: 'string',
        enum: ['dine_in', 'takeout', 'delivery', 'online']
      },
      status: {
        type: 'string',
        enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled']
      },
      payment_status: {
        type: 'string',
        enum: ['pending', 'partial', 'paid', 'refunded']
      },
      payment_method: {
        type: 'string',
        enum: ['cash', 'credit_card', 'debit_card', 'mobile_payment', 'other']
      },
      subtotal: {
        required: true,
        type: 'number',
        min: 0
      },
      tax_amount: {
        type: 'number',
        min: 0
      },
      total_amount: {
        required: true,
        type: 'number',
        min: 0
      }
    });
  }

  /**
   * Generate unique order number
   * @param {string} restaurantId - Restaurant ID
   * @returns {Promise<string>} - Unique order number
   */
  async generateOrderNumber(restaurantId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of orders today for this restaurant
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const query = `
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE restaurant_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
    `;
    
    const result = await this.query(query, [restaurantId, startOfDay, endOfDay]);
    const count = parseInt(result[0].count) + 1;
    
    return `ORD-${dateStr}-${count.toString().padStart(4, '0')}`;
  }

  /**
   * Create order with items
   * @param {Object} orderData - Order data
   * @param {Array} items - Array of order items
   * @returns {Promise<Object>} - Created order with items
   */
  async createWithItems(orderData, items) {
    const client = await this.beginTransaction();
    
    try {
      // Generate order number if not provided
      if (!orderData.order_number) {
        orderData.order_number = await this.generateOrderNumber(orderData.restaurant_id);
      }

      // Calculate totals
      let subtotal = 0;
      for (const item of items) {
        subtotal += item.unit_price * item.quantity;
        
        // Add modifier costs if any
        if (item.modifiers && item.modifiers.length > 0) {
          for (const modifier of item.modifiers) {
            subtotal += (modifier.price_adjustment || 0) * (modifier.quantity || 1);
          }
        }
      }

      orderData.subtotal = subtotal;
      orderData.total_amount = subtotal + (orderData.tax_amount || 0) + (orderData.tip_amount || 0) - (orderData.discount_amount || 0);

      // Create order
      const createQuery = `
        INSERT INTO orders (${Object.keys(orderData).join(', ')})
        VALUES (${Object.keys(orderData).map((_, i) => `$${i + 1}`).join(', ')})
        RETURNING *
      `;
      
      const orderResult = await client.query(createQuery, Object.values(orderData));
      const order = orderResult.rows[0];

      // Create order items
      const orderItems = [];
      for (const item of items) {
        const itemQuery = `
          INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal, special_instructions, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        
        const itemSubtotal = item.unit_price * item.quantity;
        const itemResult = await client.query(itemQuery, [
          order.id,
          item.menu_item_id,
          item.quantity,
          item.unit_price,
          itemSubtotal,
          item.special_instructions || null,
          'pending'
        ]);
        
        const orderItem = itemResult.rows[0];

        // Add modifiers if any
        if (item.modifiers && item.modifiers.length > 0) {
          for (const modifier of item.modifiers) {
            await client.query(
              `INSERT INTO order_item_modifiers (order_item_id, modifier_option_id, quantity, price_adjustment)
               VALUES ($1, $2, $3, $4)`,
              [orderItem.id, modifier.modifier_option_id, modifier.quantity || 1, modifier.price_adjustment || 0]
            );
          }
        }

        orderItems.push(orderItem);
      }

      await this.commit(client);

      return {
        ...order,
        items: orderItems
      };
    } catch (error) {
      await this.rollback(client);
      throw error;
    }
  }

  /**
   * Get order with items and modifiers
   * @param {string} id - Order ID
   * @returns {Promise<Object>} - Complete order details
   */
  async findWithItems(id) {
    const query = `
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'menu_item_name', mi.name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'subtotal', oi.subtotal,
            'special_instructions', oi.special_instructions,
            'status', oi.status,
            'modifiers', (
              SELECT json_agg(
                json_build_object(
                  'modifier_option_id', oim.modifier_option_id,
                  'name', mo.name,
                  'quantity', oim.quantity,
                  'price_adjustment', oim.price_adjustment
                )
              )
              FROM order_item_modifiers oim
              JOIN menu_modifier_options mo ON mo.id = oim.modifier_option_id
              WHERE oim.order_item_id = oi.id
            )
          ) ORDER BY oi.created_at
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.id = $1
      GROUP BY o.id
    `;
    
    const result = await this.query(query, [id]);
    return result[0] || null;
  }

  /**
   * Get orders by restaurant
   * @param {string} restaurantId - Restaurant ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of orders
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
   * Get active orders (not completed or cancelled)
   * @param {string} restaurantId - Restaurant ID
   * @returns {Promise<Array>} - Array of active orders
   */
  async findActive(restaurantId) {
    const query = `
      SELECT * FROM orders
      WHERE restaurant_id = $1
        AND status NOT IN ('completed', 'cancelled')
      ORDER BY created_at ASC
    `;
    
    return await this.query(query, [restaurantId]);
  }

  /**
   * Get orders by status
   * @param {string} restaurantId - Restaurant ID
   * @param {string} status - Order status
   * @returns {Promise<Array>} - Array of orders
   */
  async findByStatus(restaurantId, status) {
    return await this.findAll({
      where: { restaurant_id: restaurantId, status },
      orderBy: 'created_at DESC'
    });
  }

  /**
   * Get orders by table
   * @param {string} tableId - Table ID
   * @returns {Promise<Array>} - Array of orders
   */
  async findByTable(tableId) {
    return await this.findAll({
      where: { table_id: tableId },
      orderBy: 'created_at DESC'
    });
  }

  /**
   * Get orders by date range
   * @param {string} restaurantId - Restaurant ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} - Array of orders
   */
  async findByDateRange(restaurantId, startDate, endDate) {
    const query = `
      SELECT * FROM orders
      WHERE restaurant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      ORDER BY created_at DESC
    `;
    
    return await this.query(query, [restaurantId, startDate, endDate]);
  }

  /**
   * Update order status
   * @param {string} id - Order ID
   * @param {string} status - New status
   * @returns {Promise<Object>} - Updated order
   */
  async updateStatus(id, status) {
    const updateData = { status };
    
    // Set completed_at when status is completed
    if (status === 'completed') {
      updateData.completed_at = new Date();
    }
    
    return await this.update(id, updateData);
  }

  /**
   * Update payment status
   * @param {string} id - Order ID
   * @param {string} paymentStatus - New payment status
   * @param {string} paymentMethod - Payment method
   * @returns {Promise<Object>} - Updated order
   */
  async updatePaymentStatus(id, paymentStatus, paymentMethod = null) {
    const updateData = { payment_status: paymentStatus };
    
    if (paymentMethod) {
      updateData.payment_method = paymentMethod;
    }
    
    return await this.update(id, updateData);
  }

  /**
   * Cancel order
   * @param {string} id - Order ID
   * @returns {Promise<Object>} - Cancelled order
   */
  async cancel(id) {
    return await this.updateStatus(id, 'cancelled');
  }

  /**
   * Get sales report by date range
   * @param {string} restaurantId - Restaurant ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} - Sales statistics
   */
  async getSalesReport(restaurantId, startDate, endDate) {
    const query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'completed' THEN total_amount ELSE NULL END) as average_order_value,
        SUM(CASE WHEN status = 'completed' THEN tip_amount ELSE 0 END) as total_tips,
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN DATE(created_at) END) as business_days
      FROM orders
      WHERE restaurant_id = $1
        AND created_at >= $2
        AND created_at <= $3
    `;
    
    const result = await this.query(query, [restaurantId, startDate, endDate]);
    return result[0];
  }

  /**
   * Get popular items report
   * @param {string} restaurantId - Restaurant ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {number} limit - Number of items to return
   * @returns {Promise<Array>} - Popular items
   */
  async getPopularItems(restaurantId, startDate, endDate, limit = 10) {
    const query = `
      SELECT 
        mi.id,
        mi.name,
        COUNT(oi.id) as times_ordered,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.subtotal) as total_revenue
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.restaurant_id = $1
        AND o.status = 'completed'
        AND o.created_at >= $2
        AND o.created_at <= $3
      GROUP BY mi.id, mi.name
      ORDER BY total_quantity DESC
      LIMIT $4
    `;
    
    return await this.query(query, [restaurantId, startDate, endDate, limit]);
  }
}

module.exports = new Order();
