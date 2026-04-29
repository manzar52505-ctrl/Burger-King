import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Controller for Authentication (Signup/Login)
 */
export const signup = async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Check if user exists
    const existingUser = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = crypto.randomUUID();

    // Save user
    const result = await query(
      `INSERT INTO users (id, email, password_hash, display_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, display_name, points, created_at`,
      [userId, email, passwordHash, displayName || 'Royal Guest']
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error during signup' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Remove password hash from response
    const { password_hash, ...userResponse } = user;

    res.json({
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login' });
  }
};

export const adminSSO = async (req: Request, res: Response) => {
  const { email, uid } = req.body;

  // Verify if user is an admin (simplified for this applet)
  if (email !== 'manzar52505@gmail.com') {
    // In a real app, check the 'admins' collection or table here
    try {
      const adminResult = await query('SELECT * FROM users WHERE email = $1 AND id = $2', [email, uid]);
      // If we don't have an 'admins' table yet, this is just a placeholder logic
    } catch (e) {}
  }

  try {
    // Check if user exists in our DB, create if not
    let result = await query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (result.rows.length === 0) {
      const userId = uid || crypto.randomUUID();
      result = await query(
        `INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3) RETURNING *`,
        [userId, email, 'Admin']
      );
    }
    user = result.rows[0];

    // Generate JWT
    const token = jwt.sign({ userId: user.id, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user
    });
  } catch (error) {
    console.error('Admin SSO error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
