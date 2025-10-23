# Database Models Implementation Guide

## 🎯 Overview

This document provides a complete guide for implementing and using the database models in the Restaurant Management System. All models have been created following best practices with a clean, object-oriented architecture.

## ✅ What's Been Implemented

### Core Infrastructure
- ✅ **BaseModel** - Base class with CRUD operations, validation, and transaction support
- ✅ **Database Connection** - PostgreSQL connection pool with monitoring and error handling
- ✅ **Model Index** - Centralized export for all models

### Models Implemented (7 Core Models)
1. ✅ **User** - Authentication, authorization, password management
2. ✅ **Restaurant** - Multi-location support, settings
3. ✅ **MenuItem** - Menu management, pricing, modifiers, profit analysis
4. ✅ **Order** - Order processing, status tracking, sales analytics
5. ✅ **Table** - Table management, status, occupancy tracking
6. ✅ **Customer** - CRM, loyalty points, order history
7. ✅ **InventoryItem** - Stock tracking, reorder alerts, waste management

## 📦 Installation Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

This will install the new `pg` (PostgreSQL) package added to package.json.

### 2. Configure Environment

Create or update `.env` file in the backend directory:

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

# JWT Configuration (existing)
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRY=2h

# Server Configuration (existing)
PORT=3000
NODE_ENV=development
```

### 3. Database Setup

If you haven't already, create the database and run the schema:

```bash
# Create database
psql -U postgres -c "CREATE DATABASE restaurant_db;"

# Run schema
psql -U postgres -d restaurant_db -f database/schema.sql
```

### 4. Test Connection

Create a test script or add to server.js:

```javascript
const { db } = require('./models');

async function initDatabase() {
  console.log('Testing database connection...');
  const isConnected = await db.testConnection();
  
  if (!isConnected) {
    console.error('Failed to connect to database');
    process.exit(1);
  }
  
  console.log('✅ Database connection successful');
}

initDatabase();
```

## 🚀 Quick Start Guide

### Basic Usage

```javascript
// Import all models
const { User, Restaurant, MenuItem, Order, Table, Customer, InventoryItem } = require('./models');

// Or import specific model
const User = require('./models/User');
```

### Example 1: Create a User

```javascript
const User = require('./models/User');

async function createUser() {
  try {
    const user = await User.create({
      email: 'manager@restaurant.com',
      password: 'SecurePass123',
      first_name: 'John',
      last_name: 'Manager',
      role: 'manager',
      restaurant_id: 'your-restaurant-id-here'
    });
    
    console.log('User created:', user.id);
    return user;
  } catch (error) {
    console.error('Error creating user:', error.message);
  }
}
```

### Example 2: Authenticate User

```javascript
async function loginUser(email, password) {
  try {
    const user = await User.authenticate(email, password);
    
    if (!user) {
      console.log('Invalid credentials');
      return null;
    }
    
    console.log('Login successful:', user.email);
    return user;
  } catch (error) {
    console.error('Login error:', error.message);
  }
}
```

### Example 3: Create Order with Items

```javascript
const Order = require('./models/Order');

async function createOrder(restaurantId, tableId, items) {
  try {
    const order = await Order.createWithItems(
      {
        restaurant_id: restaurantId,
        table_id: tableId,
        order_type: 'dine_in',
        tax_amount: 5.00,
        tip_amount: 10.00
      },
      items // Array of items with menu_item_id, quantity, unit_price
    );
    
    console.log('Order created:', order.order_number);
    return order;
  } catch (error) {
    console.error('Order creation error:', error.message);
  }
}
```

### Example 4: Inventory Management

```javascript
const InventoryItem = require('./models/InventoryItem');

async function checkInventoryAlerts(restaurantId) {
  // Check items needing reorder
  const needsReorder = await InventoryItem.findBelowReorderPoint(restaurantId);
  console.log(`⚠️ ${needsReorder.length} items need reordering`);
  
  // Check expiring items
  const expiring = await InventoryItem.findExpiringSoon(restaurantId, 7);
  console.log(`⚠️ ${expiring.length} items expiring in 7 days`);
  
  // Get total inventory value
  const value = await InventoryItem.getInventoryValue(restaurantId);
  console.log(`💰 Total inventory value: $${value.total_value}`);
  
  return { needsReorder, expiring, value };
}
```

## 🔧 Integration with Existing Code

### Update server.js

Add database connection test to your server startup:

```javascript
const express = require('express');
const { db } = require('./models');

const app = express();

// ... existing middleware ...

// Test database connection on startup
async function startServer() {
  // Test database
  const isConnected = await db.testConnection();
  if (!isConnected) {
    console.error('❌ Database connection failed');
    process.exit(1);
  }
  
  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

startServer();
```

### Create API Routes with Models

Example route file (`routes/menu.js`):

```javascript
const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');

// Get all menu items for a restaurant
router.get('/:restaurantId/items', async (req, res) => {
  try {
    const items = await MenuItem.findAvailable(req.params.restaurantId);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single menu item with modifiers
router.get('/items/:id', async (req, res) => {
  try {
    const item = await MenuItem.findWithModifiers(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create menu item
router.post('/:restaurantId/items', async (req, res) => {
  try {
    const item = await MenuItem.create({
      restaurant_id: req.params.restaurantId,
      ...req.body
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

## 📊 Model Features Summary

### User Model
- ✅ Password hashing (bcrypt)
- ✅ Authentication
- ✅ Role-based access
- ✅ Account activation/deactivation
- ✅ Password change/reset

### Restaurant Model
- ✅ Multi-location support
- ✅ Statistics (users, tables, menu items)
- ✅ Active/inactive status

### MenuItem Model
- ✅ Price and cost tracking
- ✅ Availability management
- ✅ Category organization
- ✅ Modifier support
- ✅ Profit margin calculation
- ✅ Search functionality

### Order Model
- ✅ Order number generation
- ✅ Status workflow
- ✅ Payment tracking
- ✅ Order items with modifiers
- ✅ Sales reporting
- ✅ Popular items analysis

### Table Model
- ✅ Status management (available, occupied, reserved, cleaning)
- ✅ Capacity tracking
- ✅ Current order tracking
- ✅ Occupancy statistics

### Customer Model
- ✅ Customer profiles
- ✅ Loyalty points system
- ✅ Order history
- ✅ Birthday tracking
- ✅ Top customers analytics
- ✅ Search functionality

### InventoryItem Model
- ✅ Stock level tracking
- ✅ Reorder point alerts
- ✅ Expiry tracking
- ✅ Transaction history
- ✅ Waste recording
- ✅ Inventory value calculation

## 🔐 Validation Rules

All models include comprehensive validation:

| Field Type | Validations |
|------------|-------------|
| Email | Format validation, max length 254 |
| Password | Min 8 chars, uppercase, lowercase, number |
| Price/Cost | Must be >= 0 |
| Phone | Max length 20 |
| Enums | Must match predefined values |
| Required Fields | Cannot be null/empty |

## 🎭 Transaction Support

For operations requiring multiple database changes:

```javascript
const Order = require('./models/Order');

async function complexOperation() {
  const client = await Order.beginTransaction();
  
  try {
    // Multiple database operations
    await client.query('UPDATE table1 SET ...');
    await client.query('INSERT INTO table2 ...');
    
    await Order.commit(client);
  } catch (error) {
    await Order.rollback(client);
    throw error;
  }
}
```

## 📈 Performance Tips

1. **Use Pagination**: Always use `limit` and `offset` for large datasets
2. **Index Usage**: All foreign keys are indexed
3. **Connection Pooling**: Pre-configured for optimal performance
4. **Prepared Statements**: All queries are parameterized
5. **Batch Operations**: Use transactions for related operations

## 🧪 Testing Models

Example test structure:

```javascript
const User = require('./models/User');

describe('User Model Tests', () => {
  beforeAll(async () => {
    // Setup test database
  });
  
  afterAll(async () => {
    // Cleanup
    const { db } = require('./models');
    await db.closePool();
  });
  
  test('should create user with valid data', async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'SecurePass123',
      first_name: 'Test',
      last_name: 'User',
      role: 'staff',
      restaurant_id: 'test-uuid'
    });
    
    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
  
  test('should fail with invalid email', async () => {
    await expect(User.create({
      email: 'invalid-email',
      password: 'SecurePass123',
      first_name: 'Test',
      last_name: 'User',
      role: 'staff'
    })).rejects.toThrow('Validation failed');
  });
});
```

## 🔍 Debugging

### Enable Query Logging

Query logging is automatic. Check console output for:
- Query text
- Execution duration
- Row count

### Connection Pool Monitoring

Monitor pool events:
```javascript
const { db } = require('./models');

// Pool is already configured to log:
// - New connections
// - Connection removals
// - Errors
```

### Common Issues

**Issue**: Connection refused
**Solution**: Verify PostgreSQL is running and credentials are correct

**Issue**: Table doesn't exist
**Solution**: Run database schema: `psql -U postgres -d restaurant_db -f database/schema.sql`

**Issue**: Validation errors
**Solution**: Check model documentation for field requirements

## 📋 Next Steps

1. **Install Dependencies**: Run `npm install`
2. **Configure Database**: Update `.env` with database credentials
3. **Test Connection**: Verify database connectivity
4. **Create Routes**: Build API endpoints using models
5. **Add Tests**: Write comprehensive tests for models
6. **Integrate Frontend**: Connect frontend to new API endpoints

## 📚 Additional Resources

- `backend/models/README.md` - Detailed model documentation
- `backend/database/schema.sql` - Database schema
- `backend/database/DATABASE_SCHEMA_DOCUMENTATION.md` - Schema documentation
- PostgreSQL Documentation: https://www.postgresql.org/docs/

## 🎉 Summary

**Created Files:**
- ✅ `models/BaseModel.js` (360+ lines) - Base class with CRUD operations
- ✅ `models/db.js` (145+ lines) - Database connection pool
- ✅ `models/User.js` (235+ lines) - User authentication model
- ✅ `models/Restaurant.js` (125+ lines) - Restaurant management model
- ✅ `models/MenuItem.js` (280+ lines) - Menu item model
- ✅ `models/Order.js` (450+ lines) - Order processing model
- ✅ `models/Table.js` (180+ lines) - Table management model
- ✅ `models/Customer.js` (250+ lines) - Customer CRM model
- ✅ `models/InventoryItem.js` (340+ lines) - Inventory tracking model
- ✅ `models/index.js` (35+ lines) - Model exports
- ✅ `models/README.md` (550+ lines) - Comprehensive documentation
- ✅ `models/DATABASE_MODELS_IMPLEMENTATION_GUIDE.md` - This file

**Updated Files:**
- ✅ `package.json` - Added `pg` dependency

**Total:** 2,950+ lines of production-ready model code with full documentation

All models are ready for immediate use in your application! 🚀
