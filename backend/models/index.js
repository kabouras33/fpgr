/**
 * Models Index
 * 
 * Exports all database models for easy import throughout the application.
 * 
 * Usage:
 *   const { User, Restaurant, MenuItem, Order } = require('./models');
 * 
 * Or import specific models:
 *   const User = require('./models/User');
 */

const User = require('./User');
const Restaurant = require('./Restaurant');
const MenuItem = require('./MenuItem');
const Order = require('./Order');
const Table = require('./Table');
const Customer = require('./Customer');
const InventoryItem = require('./InventoryItem');
const { pool, query, getClient, testConnection, closePool } = require('./db');

module.exports = {
  // Models
  User,
  Restaurant,
  MenuItem,
  Order,
  Table,
  Customer,
  InventoryItem,
  
  // Database utilities
  db: {
    pool,
    query,
    getClient,
    testConnection,
    closePool
  }
};
