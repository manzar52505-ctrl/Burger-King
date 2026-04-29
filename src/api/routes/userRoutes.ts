import { Router } from 'express';
import { syncUser, getUserProfile } from '../controllers/userController.ts';

const router = Router();

/**
 * User Routes
 */
router.post('/sync', syncUser);
router.get('/:id', getUserProfile);

export default router;
