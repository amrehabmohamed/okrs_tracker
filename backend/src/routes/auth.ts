import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Public routes (no authentication required)
 */

// POST /api/auth/signup - Register new user
router.post('/signup', authLimiter, authController.signup);

// POST /api/auth/login - Login with email/password
router.post('/login', authLimiter, authController.login);

// POST /api/auth/password-reset - Request password reset email
router.post('/password-reset', authLimiter, authController.requestPasswordReset);

// POST /api/auth/verify-email-resend - Resend verification email
router.post('/verify-email-resend', authLimiter, authController.resendVerificationEmail);

/**
 * Protected routes (authentication required)
 */

// GET /api/auth/me - Get current user info
router.get('/me', authenticate, authController.me);

// POST /api/auth/logout - Logout current user
router.post('/logout', authenticate, authController.logout);

// POST /api/auth/password-change - Change password
router.post('/password-change', authenticate, generalLimiter, authController.changePassword);

/**
 * Admin routes (require admin access)
 */

// GET /api/auth/pending-users - List users awaiting approval
router.get('/pending-users', authenticate, requireAdmin, authController.listPendingUsers);

// PUT /api/auth/users/:userId/approve - Approve user account
router.put('/users/:userId/approve', authenticate, requireAdmin, authController.approveUser);

// PUT /api/auth/users/:userId/reject - Reject user account
router.put('/users/:userId/reject', authenticate, requireAdmin, authController.rejectUser);

export default router;
