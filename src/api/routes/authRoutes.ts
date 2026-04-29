import { Router } from 'express';
import { signup, login, adminSSO } from '../controllers/authController.ts';

const router = Router();

/**
 * Authentication Routes
 */
router.post('/signup', signup);
router.post('/login', login);
router.post('/admin-sso', adminSSO);

export default router;
