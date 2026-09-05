import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess }  from '../utils/response.js';
import { authService }  from '../services/auth.service.js';
import { sessionService } from '../services/session.service.js';
import { resetAttempts, recordFailedAttempt } from '../middleware/rateLimitCooldown.js';
import { secureCookieOptions, shortSecureCookieOptions } from '../utils/cookie.js';
import { getRefreshToken } from '../middleware/auth.middleware.js';

/* ── POST /api/v1/auth/register ───────────────────────── */
export const register = asyncHandler(async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const ua = req.get('user-agent') || 'unknown';

  const { accessToken, refreshToken: _, user } = await authService.register(req.body);

  // Persistent session registration in MongoDB
  const session = await sessionService.createSession(user.id, ip, ua);

  // Set secure HTTP-only cookies
  res.cookie('as_access_token', accessToken, shortSecureCookieOptions);
  res.cookie('as_refresh_token', session.refreshToken, secureCookieOptions);

  sendSuccess(
    res,
    {
      accessToken,
      refreshToken: session.refreshToken,
      user,
    },
    'Account created successfully.',
    201
  );
});

/* ── POST /api/v1/auth/login ──────────────────────────── */
export const login = asyncHandler(async (req, res) => {
  const { identifier } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const ua = req.get('user-agent') || 'unknown';

  try {
    const { accessToken, refreshToken: _, user } = await authService.login(req.body);

    // Save session in TokenSession collection in MongoDB
    const session = await sessionService.createSession(user.id, ip, ua);

    // Reset failed lockouts
    await resetAttempts(ip, identifier);

    // Set secure HTTP-only cookies
    res.cookie('as_access_token', accessToken, shortSecureCookieOptions);
    res.cookie('as_refresh_token', session.refreshToken, secureCookieOptions);

    sendSuccess(
      res,
      {
        accessToken,
        refreshToken: session.refreshToken,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        user,
      },
      'Login successful.',
    );
  } catch (err) {
    // Record login security metrics
    await recordFailedAttempt(ip, identifier, ua);
    throw err;
  }
});

/* ── POST /api/v1/auth/logout ─────────────────────────── */
export const logout = asyncHandler(async (req, res) => {
  const refreshToken = getRefreshToken(req);
  if (refreshToken) {
    await sessionService.revokeSession(refreshToken);
  }

  // Clear HTTP-only cookies
  res.clearCookie('as_access_token', { path: '/' });
  res.clearCookie('as_refresh_token', { path: '/' });

  sendSuccess(res, null, 'Logged out successfully.');
});

/* ── GET /api/v1/auth/me ──────────────────────────────── */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getById(req.user.id);
  sendSuccess(res, user);
});

/* ── PATCH /api/v1/auth/me ────────────────────────────── */
export const updateMe = asyncHandler(async (req, res) => {
  const updated = await authService.updateProfile(req.user.id, req.body);
  sendSuccess(res, updated, 'Profile updated successfully.');
});

/* ── POST /api/v1/auth/change-password ───────────────── */
export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  sendSuccess(res, result);
});

/* ── POST /api/v1/auth/forgot-password ───────────────── */
export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  sendSuccess(res, result);
});

/* ── POST /api/v1/auth/reset-password ────────────────── */
export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  sendSuccess(res, result);
});

/* ── GET /api/v1/auth/admin/users ───────────────────── */
export const getUsers = asyncHandler(async (req, res) => {
  const result = await authService.getAllUsers({ ...req.query, requesterRole: req.user.role });
  sendSuccess(res, result);
});

/* ── POST /api/v1/auth/admin/users ──────────────────── */
export const createUser = asyncHandler(async (req, res) => {
  const user = await authService.createUser(req.body);
  sendSuccess(res, user, 'User created successfully.', 201);
});

/* ── PATCH /api/v1/auth/admin/users/:id ─────────────── */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await authService.updateUser(req.params.id, req.body);
  sendSuccess(res, user, 'User updated successfully.');
});
