/**
 * Menu Item Model
 * 
 * Represents menu items with pricing, availability, and dietary information.
 */

const BaseModel = require('./BaseModel');

class MenuItem extends BaseModel {
  constructor() {
    super('menu_items', [
      'id', 'restaurant_id', 'category_id', 'name', 'description',
      'price', 'cost', 'sku', 'barcode', 'image_url', 'is_available',
      'is_featured', 'preparation_time', 'calories', 'allergens',
      'dietary_tags', 'display_order', 'created_at', 'updated_at'
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
      price: {
        required: true,
        type: 'number',
        min: 0
      },
      cost: {
        type: 'number',
        min: 0
      },
      description: {
        type: 'string'
      },
      preparation_time: {
        type: 'number',
        min: 0
      },
      calories: {
        type: 'number',
        min: 0
      }
    });
  }

  /**
   * Get menu items by restaurant
   * @param {string} restaurantId - Restaurant ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of menu items
   */
  async findByRestaurant(restaurantId, options = {}) {
    return await this.findAll({
      where: { restaurant_id: restaurantId, ...options.where },
      orderBy: options.orderBy || 'display_order ASC, name ASC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Get available menu items
   * @param {string} restaurantId - Restaurant ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of available items
   */
  async findAvailable(restaurantId, options = {}) {
    return await this.findAll({
      where: { restaurant_id: restaurantId, is_available: true, ...options.where },
      orderBy: options.orderBy || 'display_order ASC, name ASC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Get menu items by category
   * @param {string} categoryId - Category ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of menu items
   */
  async findByCategory(categoryId, options = {}) {
    return await this.findAll({
      where: { category_id: categoryId, ...options.where },
      orderBy: options.orderBy || 'display_order ASC, name ASC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Get featured menu items
   * @param {string} restaurantId - Restaurant ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of featured items
   */
  async findFeatured(restaurantId, options = {}) {
    return await this.findAll({
      where: { restaurant_id: restaurantId, is_featured: true, is_available: true },
      orderBy: options.orderBy || 'display_order ASC',
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Search menu items by name or description
   * @param {string} restaurantId - Restaurant ID
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching items
   */
  async search(restaurantId, searchTerm) {
    const query = `
      SELECT * FROM menu_items
      WHERE restaurant_id = $1 
        AND is_available = true
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
   * Get menu item with modifiers
   * @param {string} id - Menu item ID
   * @returns {Promise<Object>} - Menu item with modifiers
   */
  async findWithModifiers(id) {
    const query = `
      SELECT 
        mi.*,
        json_agg(
          json_build_object(
            'modifier_id', m.id,
            'modifier_name', m.name,
            'modifier_type', m.modifier_type,
            'is_required', m.is_required,
            'min_selections', m.min_selections,
            'max_selections', m.max_selections,
            'options', (
              SELECT json_agg(
                json_build_object(
                  'id', mo.id,
                  'name', mo.name,
                  'price_adjustment', mo.price_adjustment,
                  'is_available', mo.is_available
                )
              )
              FROM menu_modifier_options mo
              WHERE mo.modifier_id = m.id AND mo.is_available = true
              ORDER BY mo.display_order
            )
          ) ORDER BY mim.display_order
        ) FILTER (WHERE m.id IS NOT NULL) as modifiers
      FROM menu_items mi
      LEFT JOIN menu_item_modifiers mim ON mim.item_id = mi.id
      LEFT JOIN menu_modifiers m ON m.id = mim.modifier_id
      WHERE mi.id = $1
      GROUP BY mi.id
    `;
    
    const result = await this.query(query, [id]);
    return result[0] || null;
  }

  /**
   * Get menu items with profit margin
   * @param {string} restaurantId - Restaurant ID
   * @returns {Promise<Array>} - Items with profit calculations
   */
  async findWithProfitMargin(restaurantId) {
    const query = `
      SELECT *,
        CASE 
          WHEN cost > 0 THEN ((price - cost) / price * 100)
          ELSE NULL
        END as profit_margin_percentage,
        CASE 
          WHEN cost > 0 THEN (price - cost)
          ELSE NULL
        END as profit_per_item
      FROM menu_items
      WHERE restaurant_id = $1
      ORDER BY profit_margin_percentage DESC NULLS LAST
    `;
    
    return await this.query(query, [restaurantId]);
  }

  /**
   * Update item availability
   * @param {string} id - Menu item ID
   * @param {boolean} isAvailable - Availability status
   * @returns {Promise<Object>} - Updated item
   */
  async updateAvailability(id, isAvailable) {
    return await this.update(id, { is_available: isAvailable });
  }

  /**
   * Toggle featured status
   * @param {string} id - Menu item ID
   * @returns {Promise<Object>} - Updated item
   */
  async toggleFeatured(id) {
    const item = await this.findById(id);
    if (!item) {
      throw new Error('Menu item not found');
    }
    return await this.update(id, { is_featured: !item.is_featured });
  }

  /**
   * Get items with low profit margin
   * @param {string} restaurantId - Restaurant ID
   * @param {number} threshold - Minimum profit margin percentage
   * @returns {Promise<Array>} - Items below threshold
   */
  async findLowProfitItems(restaurantId, threshold = 20) {
    const query = `
      SELECT *,
        ((price - cost) / price * 100) as profit_margin_percentage
      FROM menu_items
      WHERE restaurant_id = $1 
        AND cost > 0
        AND ((price - cost) / price * 100) < $2
      ORDER BY profit_margin_percentage ASC
    `;
    
    return await this.query(query, [restaurantId, threshold]);
  }
}

module.exports = new MenuItem();
