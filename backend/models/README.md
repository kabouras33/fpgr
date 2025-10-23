# Database Models Documentation

## Overview

This directory contains all database models for the Restaurant Management System. The models are built on top of PostgreSQL and provide a clean, object-oriented interface for database operations.

## Architecture

### Base Model Pattern

All models extend the `BaseModel` class, which provides:
- **CRUD Operations**: Create, Read, Update, Delete
- **Validation**: Built-in field validation
- **Query Building**: Flexible query construction
- **Transaction Support**: Begin, commit, rollback
- **Timestamps**: Automatic created_at and updated_at management

### Database Connection

The `db.js` module manages the PostgreSQL connection pool with:
- Connection pooling (configurable min/max connections)
- Automatic reconnection
- Query logging and monitoring
- Transaction support
- SSL support for production

## Available Models

### 1. User Model (`User.js`)

Handles user authentication and authorization.

**Key Features:**
- Password hashing with bcrypt
- Role-based access control (owner, manager, staff, admin)
- Email-based authentication
- Account activation/deactivation
- Last login tracking

**Common Methods:**
```javascript
const User = require('./models/User');

// Create user
const user = await User.create({
  email: 'john@example.com',
  password: 'SecurePass123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'manager',
  restaurant_id: 'uuid-here'
});

// Authenticate
const authenticatedUser = await User.authenticate('john@example.com', 'SecurePass123');

// Find by email
const user = await User.findByEmail('john@example.com');

// Change password
await User.changePassword(userId, 'oldPassword', 'newPassword');

// Get users by restaurant
const staff = await User.findByRestaurant(restaurantId);
```

**Validations:**
- Email format validation
- Password strength (min 8 chars, uppercase, lowercase, number)
- Required fields: email, password, first_name, last_name, role

---

### 2. Restaurant Model (`Restaurant.js`)

Manages restaurant locations and settings.

**Key Features:**
- Multi-location support
- Address and contact information
- Timezone and currency configuration
- Active/inactive status

**Common Methods:**
```javascript
const Restaurant = require('./models/Restaurant');

// Create restaurant
const restaurant = await Restaurant.create({
  name: 'The Great Restaurant',
  email: 'info@restaurant.com',
  phone: '+1-555-0123',
  address_line1: '123 Main St',
  city: 'New York',
  state: 'NY',
  timezone: 'America/New_York',
  currency: 'USD'
});

// Get active restaurants
const activeRestaurants = await Restaurant.findActive();

// Get restaurant with statistics
const stats = await Restaurant.findWithStats(restaurantId);
// Returns: user_count, table_count, menu_item_count
```

---

### 3. MenuItem Model (`MenuItem.js`)

Manages menu items with pricing, availability, and dietary information.

**Key Features:**
- Price and cost tracking
- Allergen and dietary tag support
- Featured items
- Category organization
- Modifier support
- Profit margin calculations

**Common Methods:**
```javascript
const MenuItem = require('./models/MenuItem');

// Create menu item
const item = await MenuItem.create({
  restaurant_id: 'uuid',
  category_id: 'uuid',
  name: 'Grilled Salmon',
  description: 'Fresh Atlantic salmon with herbs',
  price: 24.99,
  cost: 12.50,
  allergens: ['fish'],
  dietary_tags: ['gluten-free', 'high-protein'],
  is_available: true
});

// Get available items
const items = await MenuItem.findAvailable(restaurantId);

// Get featured items
const featured = await MenuItem.findFeatured(restaurantId);

// Search menu
const results = await MenuItem.search(restaurantId, 'salmon');

// Get item with modifiers
const itemDetails = await MenuItem.findWithModifiers(itemId);

// Get profit margins
const profitAnalysis = await MenuItem.findWithProfitMargin(restaurantId);
```

---

### 4. Order Model (`Order.js`)

Handles order processing, tracking, and analytics.

**Key Features:**
- Order number generation
- Status tracking (pending → confirmed → preparing → ready → served → completed)
- Payment status management
- Tax, tip, and discount calculations
- Order items with modifiers
- Sales reporting

**Common Methods:**
```javascript
const Order = require('./models/Order');

// Create order with items
const order = await Order.createWithItems(
  {
    restaurant_id: 'uuid',
    order_type: 'dine_in',
    table_id: 'uuid',
    tax_amount: 2.50,
    tip_amount: 5.00
  },
  [
    {
      menu_item_id: 'uuid',
      quantity: 2,
      unit_price: 24.99,
      modifiers: [
        {
          modifier_option_id: 'uuid',
          price_adjustment: 2.00
        }
      ]
    }
  ]
);

// Get order with full details
const orderDetails = await Order.findWithItems(orderId);

// Update order status
await Order.updateStatus(orderId, 'preparing');

// Get active orders
const activeOrders = await Order.findActive(restaurantId);

// Sales report
const report = await Order.getSalesReport(restaurantId, startDate, endDate);
// Returns: total_orders, completed_orders, total_revenue, average_order_value, etc.

// Popular items
const popular = await Order.getPopularItems(restaurantId, startDate, endDate, 10);
```

---

### 5. Table Model (`Table.js`)

Manages physical restaurant tables and status.

**Key Features:**
- Table status (available, occupied, reserved, cleaning)
- Section organization
- Capacity tracking
- QR code support
- Floor plan positioning

**Common Methods:**
```javascript
const Table = require('./models/Table');

// Create table
const table = await Table.create({
  restaurant_id: 'uuid',
  table_number: 'T-12',
  section: 'Main Dining',
  capacity: 4,
  status: 'available'
});

// Get available tables
const available = await Table.findAvailable(restaurantId, 4); // min capacity 4

// Update status
await Table.updateStatus(tableId, 'occupied');
await Table.markOccupied(tableId); // Shorthand

// Get table with current order
const tableWithOrder = await Table.findWithCurrentOrder(tableId);

// Get occupancy statistics
const stats = await Table.getOccupancyStats(restaurantId);
// Returns: total_tables, available_tables, occupied_tables, etc.
```

---

### 6. Customer Model (`Customer.js`)

Manages customer information and loyalty program.

**Key Features:**
- Customer profiles
- Loyalty points system
- Order history tracking
- Preferences and allergies
- Birthday tracking
- Total spending analytics

**Common Methods:**
```javascript
const Customer = require('./models/Customer');

// Create customer
const customer = await Customer.create({
  restaurant_id: 'uuid',
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane@example.com',
  phone: '+1-555-0199',
  preferences: { favorite_table: 'window', dietary: 'vegetarian' }
});

// Find by phone
const customer = await Customer.findByPhone(restaurantId, '+1-555-0199');

// Search customers
const results = await Customer.search(restaurantId, 'jane');

// Loyalty points
await Customer.addLoyaltyPoints(customerId, 100);
await Customer.redeemLoyaltyPoints(customerId, 50);

// Update order stats (called after order completion)
await Customer.updateOrderStats(customerId, 45.99);

// Get top customers
const topCustomers = await Customer.getTopCustomers(restaurantId, 10);

// Get customer with order history
const customerProfile = await Customer.findWithOrderHistory(customerId);

// Birthday marketing
const birthdays = await Customer.findBirthdaysInRange(restaurantId, startDate, endDate);
```

---

### 7. InventoryItem Model (`InventoryItem.js`)

Manages inventory tracking and reordering.

**Key Features:**
- Stock level tracking
- Reorder point alerts
- Expiry date management
- Transaction history
- Multiple units of measure
- Supplier tracking
- Waste recording

**Common Methods:**
```javascript
const InventoryItem = require('./models/InventoryItem');

// Create inventory item
const item = await InventoryItem.create({
  restaurant_id: 'uuid',
  name: 'Atlantic Salmon Fillet',
  sku: 'FISH-SAL-001',
  unit_of_measure: 'lb',
  current_quantity: 50,
  reorder_point: 20,
  reorder_quantity: 50,
  unit_cost: 8.50,
  supplier_id: 'uuid'
});

// Add stock (purchase)
await InventoryItem.addStock(itemId, 30, 8.75, 'Weekly delivery');

// Remove stock (usage)
await InventoryItem.removeStock(itemId, 5, 'Used for order #1234');

// Record waste
await InventoryItem.recordWaste(itemId, 2, 'Expired');

// Get items needing reorder
const needsReorder = await InventoryItem.findBelowReorderPoint(restaurantId);

// Get expiring items
const expiringSoon = await InventoryItem.findExpiringSoon(restaurantId, 7); // 7 days

// Get inventory value
const value = await InventoryItem.getInventoryValue(restaurantId);
// Returns: total_items, total_value, items_to_reorder, expired_value

// Transaction history
const history = await InventoryItem.getTransactionHistory(itemId);
```

---

## Environment Configuration

Create a `.env` file in the backend directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurant_db
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Connection Pool Settings
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Environment
NODE_ENV=development
```

## Installation

1. **Install PostgreSQL Driver:**
```bash
npm install pg
```

2. **Run Database Schema:**
```bash
psql -U postgres -d restaurant_db -f database/schema.sql
```

3. **Test Connection:**
```javascript
const { db } = require('./models');

async function init() {
  const isConnected = await db.testConnection();
  if (!isConnected) {
    process.exit(1);
  }
}

init();
```

## Usage Examples

### Complete Order Flow

```javascript
const { Order, MenuItem, Table, Customer } = require('./models');

async function createOrder(restaurantId, customerId, tableId) {
  // Get menu items
  const items = await MenuItem.findAvailable(restaurantId);
  
  // Mark table as occupied
  await Table.updateStatus(tableId, 'occupied');
  
  // Create order
  const order = await Order.createWithItems(
    {
      restaurant_id: restaurantId,
      table_id: tableId,
      customer_id: customerId,
      order_type: 'dine_in',
      tax_amount: 5.00
    },
    [
      {
        menu_item_id: items[0].id,
        quantity: 2,
        unit_price: items[0].price
      }
    ]
  );
  
  // Update customer stats
  await Customer.updateOrderStats(customerId, order.total_amount);
  
  return order;
}
```

### Inventory Management Flow

```javascript
const { InventoryItem } = require('./models');

async function checkInventory(restaurantId) {
  // Check items needing reorder
  const needsReorder = await InventoryItem.findBelowReorderPoint(restaurantId);
  console.log(`${needsReorder.length} items need reordering`);
  
  // Check expiring items
  const expiring = await InventoryItem.findExpiringSoon(restaurantId, 7);
  console.log(`${expiring.length} items expiring in 7 days`);
  
  // Get inventory value
  const value = await InventoryItem.getInventoryValue(restaurantId);
  console.log(`Total inventory value: $${value.total_value}`);
  
  return { needsReorder, expiring, value };
}
```

### Sales Analytics

```javascript
const { Order } = require('./models');

async function getDailySales(restaurantId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const report = await Order.getSalesReport(restaurantId, today, tomorrow);
  const popular = await Order.getPopularItems(restaurantId, today, tomorrow, 5);
  
  return {
    revenue: report.total_revenue,
    orders: report.completed_orders,
    averageOrder: report.average_order_value,
    topItems: popular
  };
}
```

## Transaction Handling

For operations that require multiple database changes:

```javascript
const BaseModel = require('./models/BaseModel');

async function transferInventory(fromItemId, toItemId, quantity) {
  const model = new BaseModel('inventory_items', []);
  const client = await model.beginTransaction();
  
  try {
    // Remove from source
    await client.query(
      'UPDATE inventory_items SET current_quantity = current_quantity - $1 WHERE id = $2',
      [quantity, fromItemId]
    );
    
    // Add to destination
    await client.query(
      'UPDATE inventory_items SET current_quantity = current_quantity + $1 WHERE id = $2',
      [quantity, toItemId]
    );
    
    await model.commit(client);
    return true;
  } catch (error) {
    await model.rollback(client);
    throw error;
  }
}
```

## Validation

All models include built-in validation:

```javascript
const User = require('./models/User');

try {
  await User.create({
    email: 'invalid-email', // Will fail email validation
    password: '123', // Will fail password strength validation
    first_name: 'John',
    role: 'manager'
  });
} catch (error) {
  console.error(error.message);
  // "Validation failed: email must be a valid email address, 
  //  password must be at least 8 characters, ..."
}
```

## Performance Considerations

1. **Use Indexes**: All foreign keys and frequently queried fields are indexed
2. **Connection Pooling**: Configured for optimal performance
3. **Prepared Statements**: All queries use parameterized statements
4. **Batch Operations**: Use transactions for multiple related operations
5. **Pagination**: Use `limit` and `offset` options for large datasets

```javascript
// Good: Paginated query
const items = await MenuItem.findByRestaurant(restaurantId, {
  limit: 20,
  offset: 0
});

// Bad: Loading all items
const allItems = await MenuItem.findByRestaurant(restaurantId);
```

## Testing

Create test files for each model:

```javascript
const User = require('./models/User');

describe('User Model', () => {
  test('should create user with hashed password', async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'SecurePass123',
      first_name: 'Test',
      last_name: 'User',
      role: 'staff',
      restaurant_id: 'uuid'
    });
    
    expect(user.email).toBe('test@example.com');
    expect(user.password_hash).toBeUndefined(); // Should not return hash
  });
});
```

## Troubleshooting

### Connection Issues
```javascript
// Test database connection
const { db } = require('./models');
await db.testConnection();
```

### Query Logging
All queries are automatically logged with execution time and row count.

### Pool Monitoring
The connection pool logs connect/disconnect events and warns about long-running queries.

## Future Enhancements

Potential additions to the model layer:
- Soft deletes (deleted_at column)
- Model hooks (beforeCreate, afterUpdate, etc.)
- Query caching
- Full-text search
- Relationship preloading
- Bulk operations optimization

## Support

For issues or questions about the models:
1. Check the schema documentation in `database/DATABASE_SCHEMA_DOCUMENTATION.md`
2. Review model source code for specific method details
3. Check PostgreSQL logs for database-level issues
4. Verify environment variables are correctly set
