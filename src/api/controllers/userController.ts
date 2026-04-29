import { Request, Response } from 'express';
import { query } from '../config/db.ts';

/**
 * Controller for User logic
 */
export const syncUser = async (req: Request, res: Response) => {
  const { userId, email, displayName } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ message: 'User ID and email are required' });
  }

  try {
    // Upsert pattern
    const result = await query(
      `INSERT INTO users (id, email, display_name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (id) DO UPDATE 
       SET display_name = EXCLUDED.display_name, email = EXCLUDED.email
       RETURNING *`,
      [userId, email, displayName]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ message: 'Error syncing user with database' });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows[0]) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Database error' });
  }
};
