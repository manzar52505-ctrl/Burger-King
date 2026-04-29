import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Middleware to protect routes using JWT
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    
    // Attach user information to the request
    (req as any).userId = decoded.userId;
    next();
  });
};

// Alias for convenience
export const verifyToken = authenticateToken;

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).userId;
  
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const { query } = await import('../config/db.ts');
    const result = await query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    
    // For demo purposes, we can also whitelist specific emails if DB is not set up
    // Or if the first user registered should be admin
    if (result.rows.length > 0 && result.rows[0].is_admin) {
      next();
    } else {
      // Fallback: Check if it's the specific admin email from requirements
      const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0 && userResult.rows[0].email === 'manzar52505@gmail.com') {
        next();
      } else {
        res.status(403).json({ message: 'Admin access required' });
      }
    }
  } catch (error) {
    // If DB fails, search for other indicators or fail safe
    res.status(500).json({ message: 'Error verifying admin status' });
  }
};
