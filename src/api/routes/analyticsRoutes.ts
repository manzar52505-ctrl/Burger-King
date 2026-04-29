import express from 'express';
import { getAnalytics } from '../controllers/analyticsController.ts';
import { verifyToken, isAdmin } from '../middleware/authMiddleware.ts';

const router = express.Router();

router.get('/', verifyToken, isAdmin, getAnalytics);

export default router;
