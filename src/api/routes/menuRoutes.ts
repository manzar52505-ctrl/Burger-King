import { Router } from 'express';
import { getMenu, getDeals, getMenuItem, getCategories, createMenuItem, updateMenuItem, deleteMenuItem } from '../controllers/menuController.ts';
import { authenticateToken } from '../middleware/authMiddleware.ts';

const router = Router();

/**
 * Menu Routes
 */
router.get('/', getMenu);
router.get('/categories', getCategories);
router.get('/deals', getDeals);
router.get('/:id', getMenuItem);

// Admin only routes (simplified check for now)
router.post('/', authenticateToken, createMenuItem);
router.put('/:id', authenticateToken, updateMenuItem);
router.delete('/:id', authenticateToken, deleteMenuItem);

export default router;
