import { Router }    from 'express';
import * as auth      from '../controllers/auth.controller.js';
import { authenticate, refreshAuth, authorize } from '../middleware/auth.middleware.js';
import { bruteForceLimiter } from '../middleware/rateLimitCooldown.js';
import {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
} from '../middleware/validate.middleware.js';

const router = Router();

/* ─── Public ───────────────────────────────────────────── */

/**
 * POST /api/v1/auth/register
 * Body: { name, matric, email, password, role? }
 * Returns: { id, name, matric, email, role }
 */
router.post('/register', validateRegister, auth.register);

/**
 * POST /api/v1/auth/login
 * Body: { identifier, password }  (identifier = email OR matric)
 * Returns: { accessToken, refreshToken, tokenType, expiresIn, user }
 */
router.post('/login', validateLogin, bruteForceLimiter, auth.login);

/**
 * POST /api/v1/auth/logout
 * Clears secure cookies and invalidates the session in MongoDB.
 */
router.post('/logout', auth.logout);

/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken }
 * Returns: { accessToken }
 */
router.post('/refresh', refreshAuth);

/**
 * POST /api/v1/auth/forgot-password
 * Body: { email }
 * Returns: generic confirmation (never reveals if the account exists).
 */
router.post('/forgot-password', validateForgotPassword, auth.forgotPassword);

/**
 * POST /api/v1/auth/reset-password
 * Body: { token, newPassword }
 * Returns: success confirmation.
 */
router.post('/reset-password', validateResetPassword, auth.resetPassword);

/* ─── Protected (requires valid access token) ──────────── */

/**
 * GET /api/v1/auth/me
 * Returns: current user profile
 */
router.get('/me', authenticate, auth.getMe);

/**
 * PATCH /api/v1/auth/me
 * Body: { name?, email? }
 * Returns: updated user profile
 */
router.patch('/me', authenticate, auth.updateMe);

router.post('/change-password', authenticate, validateChangePassword, auth.changePassword);

/* ─── Admin (requires admin role) ────────────────────── */

/**
 * GET /api/v1/auth/admin/users
 * Query: { role?, search?, page?, limit? }
 * Returns: { users, pagination }
 */
router.get('/admin/users', authenticate, authorize('admin', 'superadmin'), auth.getUsers);

/**
 * GET /api/v1/auth/admin/staff
 * Returns all staff users with their department info
 */
router.get('/admin/staff', authenticate, authorize('admin', 'superadmin'), auth.getUsers);

/**
 * POST /api/v1/auth/admin/users
 * Body: { name, matric, email, password, role, department_id? }
 * Returns: { user }
 */
router.post('/admin/users', authenticate, authorize('superadmin'), auth.createUser);

/**
 * PATCH /api/v1/auth/admin/users/:id
 * Body: { name?, department_id?, role? }
 * Returns: { user }
 */
router.patch('/admin/users/:id', authenticate, authorize('superadmin', 'admin'), auth.updateUser);

export default router;
