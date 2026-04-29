import { query } from '../config/db.ts';

/**
 * Initial database setup SQL
 */
export const initDb = async () => {
  try {
    // Create Users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(128) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT,
        display_name VARCHAR(255),
        is_admin BOOLEAN DEFAULT false,
        points INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure password_hash exists if table was created earlier without it
    try {
      await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT');
    } catch (e) {
      // Ignore if column already exists or other error
    }

    // Create Menu Items table
    await query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(50),
        image_url TEXT,
        calories INTEGER,
        is_popular BOOLEAN DEFAULT false,
        is_new BOOLEAN DEFAULT false
      );
    `);

    // Create Orders table
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(50) UNIQUE NOT NULL,
        user_id VARCHAR(128) REFERENCES users(id),
        total_price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        delivery_address TEXT,
        contact_number VARCHAR(50),
        payment_method VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Order Items table
    await query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id VARCHAR(64) REFERENCES menu_items(id),
        quantity INTEGER NOT NULL,
        price_at_time DECIMAL(10, 2) NOT NULL,
        name_at_time VARCHAR(255)
      );
    `);

    // Create indices for performance
    await query(`CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);

    console.log('PostgreSQL schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize PostgreSQL schema:', error);
  }
};
