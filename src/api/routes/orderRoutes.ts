import { Router } from 'express';
import { createOrder, getOrderHistory, getAllOrders, updateOrderStatus } from '../controllers/orderController.ts';
import { authenticateToken } from '../middleware/authMiddleware.ts';

const router = Router();

/**
 * Order Routes
 */
router.post('/', createOrder); 
router.get('/history/:userId', authenticateToken, getOrderHistory);

// Admin routes
router.get('/admin/all', authenticateToken, getAllOrders);
router.patch('/admin/:id/status', authenticateToken, updateOrderStatus);

export default router;
