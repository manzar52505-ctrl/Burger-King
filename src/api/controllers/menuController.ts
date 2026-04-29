import { Request, Response } from 'express';
import { MENU_ITEMS, DEALS } from '../../constants.ts';
import { query } from '../config/db.ts';

// In-memory persistence fallback for environments without a functioning database
let LIVE_MENU = [...MENU_ITEMS];
let HAS_LOADED_FROM_DB = false;

/**
 * Sync from DB on first use or periodically
 */
const syncFromDb = async () => {
  try {
    const result = await query('SELECT * FROM menu_items');
    if (result && result.rows && result.rows.length > 0) {
      LIVE_MENU = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        price: parseFloat(row.price),
        category: row.category,
        image: row.image_url,
        calories: row.calories,
        popular: row.is_popular,
        new: row.is_new
      }));
      HAS_LOADED_FROM_DB = true;
      return true;
    }
  } catch (error) {
    // DB not available, will use in-memory state
    console.log('Database not available for sync, using in-memory menu');
  }
  return false;
};

/**
 * Controller for Menu and Deals
 */
export const getMenu = async (req: Request, res: Response) => {
  if (!HAS_LOADED_FROM_DB) {
    await syncFromDb();
  }
  // Allow browser caching for 5 minutes, but revalidate every time for consistency
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json(LIVE_MENU);
};

export const getCategories = async (req: Request, res: Response) => {
  if (!HAS_LOADED_FROM_DB) {
    await syncFromDb();
  }
  const categories = Array.from(new Set(LIVE_MENU.map(item => item.category)));
  const finalCategories = categories.length > 0 ? categories : ['burgers', 'pizzas', 'sides', 'drinks', 'desserts', 'deals'];
  // Categories change rarely, cache for 1 hour
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(finalCategories);
};

export const getDeals = (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(DEALS);
};

export const getMenuItem = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Try to find in cache first for extreme speed
  const cachedItem = LIVE_MENU.find(i => i.id === id);
  if (cachedItem) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(cachedItem);
  }

  // Fallback to DB if not in cache (shouldn't happen if sync worked)
  try {
    const result = await query('SELECT * FROM menu_items WHERE id = $1', [id]);
    if (result.rows[0]) {
      const row = result.rows[0];
      const item = {
        id: row.id,
        name: row.name,
        description: row.description,
        price: parseFloat(row.price),
        category: row.category,
        image: row.image_url,
        calories: row.calories,
        popular: row.is_popular,
        new: row.is_new
      };
      // Update cache
      LIVE_MENU.push(item);
      return res.json(item);
    }
  } catch (error) {
    // Silently fall back
  }

  const item = MENU_ITEMS.find(i => i.id === id);
  if (item) {
    res.json(item);
  } else {
    res.status(404).json({ message: 'Menu item not found' });
  }
};

export const createMenuItem = async (req: Request, res: Response) => {
  const { id, name, description, price, category, image, calories, popular, new: isNew } = req.body;
  
  if (!name || isNaN(parseFloat(price)) || !category) {
    return res.status(400).json({ message: 'Name, valid price, and category are required' });
  }

  const caloriesNum = calories ? parseInt(calories.toString().replace(/\D/g, '')) : 0;
  const finalCalories = isNaN(caloriesNum) ? 0 : caloriesNum;
  const numericPrice = parseFloat(price?.toString() || '0') || 0;
  const finalId = id && id !== '' ? id : `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const newItem = {
    id: finalId,
    name,
    description,
    price: numericPrice,
    category,
    image,
    calories: finalCalories,
    popular: !!popular,
    new: !!isNew
  };

  try {
    await query(
      `INSERT INTO menu_items (id, name, description, price, category, image_url, calories, is_popular, is_new)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [finalId, name, description, numericPrice, category, image, finalCalories, !!popular, !!isNew]
    );

    // Update in-memory state
    LIVE_MENU.push(newItem);
    res.status(201).json(newItem);
  } catch (error: any) {
    console.error('Create menu item error:', error);
    if (error.message === 'Database not configured') {
      // Fallback for demo environments
      LIVE_MENU.push(newItem);
      return res.status(201).json(newItem);
    }
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Conflict: Product ID or name already exists' });
    }
    res.status(500).json({ message: error.message || 'Internal database error during save' });
  }
};

export const updateMenuItem = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, price, category, image, calories, popular, new: isNew } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Product ID is missing in the request path' });
  }

  const caloriesNum = calories ? parseInt(calories.toString().replace(/\D/g, '')) : 0;
  const finalCalories = isNaN(caloriesNum) ? 0 : caloriesNum;
  const numericPrice = parseFloat(price?.toString() || '0') || 0;

  const updatedItem = {
    id,
    name,
    description,
    price: numericPrice,
    category,
    image,
    calories: finalCalories,
    popular: !!popular,
    new: !!isNew
  };

  try {
    const result = await query(
      `UPDATE menu_items SET name = $1, description = $2, price = $3, category = $4, 
       image_url = $5, calories = $6, is_popular = $7, is_new = $8
       WHERE id = $9 RETURNING *`,
      [name, description, numericPrice, category, image, finalCalories, !!popular, !!isNew, id]
    );

    // Update in-memory state
    const index = LIVE_MENU.findIndex(item => item.id === id);
    if (index !== -1) {
      LIVE_MENU[index] = updatedItem;
    } else {
      LIVE_MENU.push(updatedItem);
    }

    res.json(updatedItem);
  } catch (error: any) {
    console.error('Update menu item error:', error);
    if (error.message === 'Database not configured') {
      // Fallback for demo environments
      const index = LIVE_MENU.findIndex(item => item.id === id);
      if (index !== -1) {
        LIVE_MENU[index] = updatedItem;
        return res.json(updatedItem);
      }
      return res.status(404).json({ message: 'Item not found in memory' });
    }
    res.status(500).json({ message: error.message || 'Internal database error during update' });
  }
};

export const deleteMenuItem = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM menu_items WHERE id = $1', [id]);
    
    // Update in-memory state
    LIVE_MENU = LIVE_MENU.filter(item => item.id !== id);
    
    res.json({ message: 'Item deleted successfully' });
  } catch (error: any) {
    console.error('Delete menu item error:', error);
    if (error.message === 'Database not configured') {
      // Fallback for demo environments
      LIVE_MENU = LIVE_MENU.filter(item => item.id !== id);
      return res.json({ message: 'Item deleted successfully' });
    }
    res.status(500).json({ message: 'Error deleting menu item' });
  }
};

