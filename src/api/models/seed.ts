import { query } from '../config/db.ts';
import { MENU_ITEMS } from '../../constants.ts';

/**
 * Seed the database with initial menu items
 */
export const seedDb = async () => {
  try {
    // Check if table is empty
    const checkResult = await query('SELECT COUNT(*) FROM menu_items');
    const count = parseInt(checkResult.rows[0].count);

    if (count === 0) {
      console.log('Seeding database with menu items...');
      
      for (const item of MENU_ITEMS) {
        await query(
          `INSERT INTO menu_items (id, name, description, price, category, image_url, calories, is_popular, is_new)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            item.id,
            item.name,
            item.description,
            item.price,
            item.category,
            item.image,
            item.calories,
            item.popular || false,
            item.new || false
          ]
        );
      }
      console.log('Seeding completed successfully');
    } else {
      console.log('Database already has menu items, skipping seed');
    }
  } catch (error) {
    console.error('Failed to seed database:', error);
  }
};
