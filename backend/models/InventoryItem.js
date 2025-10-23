/**
 * Inventory Item Model
 * 
 * Represents inventory items with stock tracking and reorder alerts.
 */

const BaseModel = require('./BaseModel');

class InventoryItem extends BaseModel {
  constructor() {
    super('inventory_items', [
      'id', 'restaurant_id', 'category_id', 'name', 'description',
      'sku', 'unit_of_measure', 'current_quantity', 'reorder_point',
      'reorder_quantity', 'unit_cost', 'supplier_id', 'storage_location',
      'expiry_date', 'is_active', 'created_at', 'updated_at'
    ], {
      restaurant_id: {
        required: true,
        type: 'string'
      },
      name: {
        required: true,
        type: 'string',
        maxLength: 100
      },
      sku: {
        type: 'string',
        maxLength: 50
      },
      unit_of_measure: {
        required: true,
        type: 'string',
        maxLength: 20
      },
      current_quantity: {
        required: true,
        type: 'number',
        min: 0
      },
      reorder_point: {
        type: 'number',
        min: 0
      },
      unit_cost: {
        type: 'number',
        min: 0
      }
    });
  }

  /**
   * Get inventory items by restaurant
   * @param {string} restaurantId - Restaurant ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of inventory items
   */
  async findByRestaurant(restaurantId, options = {}) {
    return await this.findAll({
      where: { restaurant_id: restaurantId, is_active: true, ...options.where },
      orderBy: options.orderBy || 'name ASC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Get items below reorder point
   * @param {string} restaurantId - Restaurant ID
   * @returns {Promise<Array>} - Items needing reorder
   */
  async findBelowReorderPoint(restaurantId) {
    const query = `
      SELECT *
      FROM inventory_items
      WHERE restaurant_id = $1
        AND is_active = true
        AND current_quantity <= reorder_point
      ORDER BY (reorder_point - current_quantity) DESC
    `;

    return await this.query(query, [restaurantId]);
  }

  /**
   * Get items expiring soon
   * @param {string} restaurantId - Restaurant ID
   * @param {number} daysAhead - Days to look ahead
   * @returns {Promise<Array>} - Items expiring soon
   */
  async findExpiringSoon(restaurantId, daysAhead = 7) {
    const query = `
      SELECT *
      FROM inventory_items
      WHERE restaurant_id = $1
        AND is_active = true
        AND expiry_date IS NOT NULL
        AND expiry_date <= NOW() + INTERVAL '${daysAhead} days'
        AND expiry_date > NOW()
      ORDER BY expiry_date ASC
    `;

    return await this.query(query, [restaurantId]);
  }

  /**
   * Get expired items
   * @param {string} restaurantId - Restaurant ID
   * @returns {Promise<Array>} - Expired items
   */
  async findExpired(restaurantId) {
    const query = `
      SELECT *
      FROM inventory_items
      WHERE restaurant_id = $1
        AND is_active = true
        AND expiry_date IS NOT NULL
        AND expiry_date < NOW()
      ORDER BY expiry_date DESC
    `;

    return await this.query(query, [restaurantId]);
  }

  /**
   * Update item quantity
   * @param {string} id - Item ID
   * @param {number} quantity - New quantity
   * @param {string} transactionType - Transaction type (purchase, usage, adjustment, waste)
   * @param {string} notes - Transaction notes
   * @returns {Promise<Object>} - Updated item
   */
  async updateQuantity(id, quantity, transactionType = 'adjustment', notes = null) {
    const client = await this.beginTransaction();

    try {
      const item = await this.findById(id);
      if (!item) {
        throw new Error('Inventory item not found');
      }

      const oldQuantity = item.current_quantity;
      const newQuantity = quantity;
      const quantityChange = newQuantity - oldQuantity;

      // Update inventory item
      const updatedItem = await this.update(id, { current_quantity: newQuantity });

      // Record transaction
      await client.query(
        `INSERT INTO inventory_transactions 
         (inventory_item_id, transaction_type, quantity_change, quantity_before, quantity_after, unit_cost, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, transactionType, quantityChange, oldQuantity, newQuantity, item.unit_cost, notes]
      );

      await this.commit(client);
      return updatedItem;
    } catch (error) {
      await this.rollback(client);
      throw error;
    }
  }

  /**
   * Add stock
   * @param {string} id - Item ID
   * @param {number} quantity - Quantity to add
   * @param {number} unitCost - Unit cost
   * @param {string} notes - Transaction notes
   * @returns {Promise<Object>} - Updated item
   */
  async addStock(id, quantity, unitCost = null, notes = null) {
    const item = await this.findById(id);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    const newQuantity = item.current_quantity + quantity;
    
    const client = await this.beginTransaction();

    try {
      // Update quantity and cost if provided
      const updateData = { current_quantity: newQuantity };
      if (unitCost !== null) {
        updateData.unit_cost = unitCost;
      }

      const updatedItem = await this.update(id, updateData);

      // Record transaction
      await client.query(
        `INSERT INTO inventory_transactions 
         (inventory_item_id, transaction_type, quantity_change, quantity_before, quantity_after, unit_cost, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, 'purchase', quantity, item.current_quantity, newQuantity, unitCost || item.unit_cost, notes]
      );

      await this.commit(client);
      return updatedItem;
    } catch (error) {
      await this.rollback(client);
      throw error;
    }
  }

  /**
   * Remove stock (usage)
   * @param {string} id - Item ID
   * @param {number} quantity - Quantity to remove
   * @param {string} notes - Transaction notes
   * @returns {Promise<Object>} - Updated item
   */
  async removeStock(id, quantity, notes = null) {
    const item = await this.findById(id);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    if (item.current_quantity < quantity) {
      throw new Error('Insufficient stock');
    }

    const newQuantity = item.current_quantity - quantity;

    const client = await this.beginTransaction();

    try {
      const updatedItem = await this.update(id, { current_quantity: newQuantity });

      // Record transaction
      await client.query(
        `INSERT INTO inventory_transactions 
         (inventory_item_id, transaction_type, quantity_change, quantity_before, quantity_after, unit_cost, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, 'usage', -quantity, item.current_quantity, newQuantity, item.unit_cost, notes]
      );

      await this.commit(client);
      return updatedItem;
    } catch (error) {
      await this.rollback(client);
      throw error;
    }
  }

  /**
   * Record waste
   * @param {string} id - Item ID
   * @param {number} quantity - Quantity wasted
   * @param {string} reason - Waste reason
   * @returns {Promise<Object>} - Updated item
   */
  async recordWaste(id, quantity, reason = null) {
    const item = await this.findById(id);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    if (item.current_quantity < quantity) {
      throw new Error('Waste quantity exceeds current stock');
    }

    const newQuantity = item.current_quantity - quantity;

    const client = await this.beginTransaction();

    try {
      const updatedItem = await this.update(id, { current_quantity: newQuantity });

      // Record transaction
      await client.query(
        `INSERT INTO inventory_transactions 
         (inventory_item_id, transaction_type, quantity_change, quantity_before, quantity_after, unit_cost, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, 'waste', -quantity, item.current_quantity, newQuantity, item.unit_cost, reason]
      );

      await this.commit(client);
      return updatedItem;
    } catch (error) {
      await this.rollback(client);
      throw error;
    }
  }

  /**
   * Get inventory value
   * @param {string} restaurantId - Restaurant ID
   * @returns {Promise<Object>} - Inventory value stats
   */
  async getInventoryValue(restaurantId) {
    const query = `
      SELECT 
        COUNT(*) as total_items,
        SUM(current_quantity * unit_cost) as total_value,
        SUM(CASE WHEN current_quantity <= reorder_point THEN 1 ELSE 0 END) as items_to_reorder,
        SUM(CASE WHEN expiry_date < NOW() THEN current_quantity * unit_cost ELSE 0 END) as expired_value
      FROM inventory_items
      WHERE restaurant_id = $1 AND is_active = true
    `;

    const result = await this.query(query, [restaurantId]);
    return result[0];
  }

  /**
   * Search inventory items
   * @param {string} restaurantId - Restaurant ID
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Matching items
   */
  async search(restaurantId, searchTerm) {
    const query = `
      SELECT * FROM inventory_items
      WHERE restaurant_id = $1
        AND is_active = true
        AND (
          name ILIKE $2
          OR description ILIKE $2
          OR sku ILIKE $2
        )
      ORDER BY name ASC
    `;

    return await this.query(query, [restaurantId, `%${searchTerm}%`]);
  }

  /**
   * Get transaction history for item
   * @param {string} id - Item ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Transaction history
   */
  async getTransactionHistory(id, options = {}) {
    const query = `
      SELECT * FROM inventory_transactions
      WHERE inventory_item_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const limit = options.limit || 50;
    return await this.query(query, [id, limit]);
  }
}

module.exports = new InventoryItem();
