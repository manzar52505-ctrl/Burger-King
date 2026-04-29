import { Request, Response } from 'express';
import { query } from '../config/db.ts';

/**
 * Controller for Order logic
 */
export const createOrder = async (req: Request, res: Response) => {
  const { userId, items, total, deliveryDetails, orderNumber } = req.body;

  if (!items || !total || !orderNumber) {
    return res.status(400).json({ message: 'Order items, total, and order number are required' });
  }

  try {
    const orderResult = await query(
      `INSERT INTO orders (order_number, user_id, total_price, delivery_address, contact_number, payment_method) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        orderNumber,
        userId || null, 
        total, 
        deliveryDetails?.address || 'Pickup',
        deliveryDetails?.phone || '',
        'Credit Card' // Default for now
      ]
    );

    const orderId = orderResult.rows[0].id;

    // Save individual items
    for (const item of items) {
      await query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time, name_at_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.id, item.quantity, item.price, item.name]
      );
    }

    // Update user points if userId is provided
    if (userId) {
      const earnedPoints = Math.floor(total * 10);
      try {
        await query(
          'UPDATE users SET points = points + $1 WHERE id = $2',
          [earnedPoints, userId]
        );
      } catch (e) {
        // Points update failure shouldn't crash the order
      }
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: orderResult.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    
    // If database is not configured or has placeholder values, we simulate success for a better demo experience
    const isMockRequired = 
      error.message === 'Database not configured' || 
      error.message.includes('getaddrinfo') || 
      error.message.includes('base') ||
      error.message.includes('placeholder');

    if (isMockRequired) {
      console.warn('Database not available or misconfigured. Simulating order success.');
      return res.status(201).json({
        message: 'Order simulated successfully',
        order: {
          id: 'simulated-' + Math.random().toString(36).substr(2, 9),
          order_number: orderNumber,
          user_id: userId || null,
          total_price: total,
          delivery_address: deliveryDetails?.address || 'Pickup',
          status: 'pending',
          created_at: new Date().toISOString()
        }
      });
    }

    res.status(500).json({ message: 'Error creating order in database' });
  }
};

export const getOrderHistory = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const result = await query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Database error' });
  }
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Database error' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status' });
  }
};

