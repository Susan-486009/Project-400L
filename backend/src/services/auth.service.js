import { User } from '../models/User.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
} from '../utils/auth.js';
import { AppError } from '../utils/response.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { config } from '../config/config.js';
import { sendResetEmail } from './email.service.js';

export const authService = {

  /* ══════════════════════════════════════════════════════
     REGISTER
  ══════════════════════════════════════════════════════ */
  async register({ name, matric, email, password, role = 'student' }) {
    // Normalise inputs
    const normEmail  = email ? email.trim().toLowerCase() : undefined;
    const normMatric = matric.trim().toUpperCase();
    const normName   = name.trim();
    const safeRole   = ['student', 'staff'].includes(role) ? role : 'student';

    // Duplicate email check — only if an email was provided
    if (normEmail) {
      const byEmail = await User.findOne({ email: normEmail }).select('_id').lean();
      if (byEmail) throw new AppError('This email address is already registered.', 409);
    }

    const byMatric = await User.findOne({ matric: normMatric }).select('_id').lean();
    if (byMatric) throw new AppError('This Matric/Staff number is already registered.', 409);

    const hashedPassword = await hashPassword(password);

    const newUser = await User.create({
      name: normName,
      matric: normMatric,
      ...(normEmail && { email: normEmail }),
      password: hashedPassword,
      role: safeRole,
    });

    // Issue tokens
    const tokenPayload = { id: newUser._id.toString(), role: newUser.role, name: newUser.name };
    const accessToken  = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(newUser._id.toString());

    // Strip password and format ID
    const user = newUser.toObject();
    delete user.password;
    user.id = user._id.toString();
    delete user._id;

    return { accessToken, refreshToken, user };
  },

  /* ══════════════════════════════════════════════════════
     LOGIN
  ══════════════════════════════════════════════════════ */
  async login({ identifier, password }) {
    try {
      const norm = identifier.trim().toLowerCase();
      const normMatric = identifier.trim().toUpperCase();

      // Look up by email first, then by matric (case-insensitive)
      const user = await User.findOne({
        $or: [
          { email: norm },
          { matric: normMatric }
        ]
      }).lean();

      // Use a constant-time path for both "not found" and "wrong password"
      const dummy = '$2b$12$L6T3vW6qRkY9vP5uI2a7O.xW1yZ8aK6m5Qv9L3tG2H4j7K8m9N0Pq'; 
      await verifyPassword(password, user ? user.password : dummy);

      if (!user) throw new AppError('Invalid credentials.', 401);

      const passwordMatch = await verifyPassword(password, user.password);
      if (!passwordMatch) throw new AppError('Invalid credentials.', 401);

      // Issue tokens
      const tokenPayload = { id: user._id.toString(), role: user.role, name: user.name };
      const accessToken  = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken(user._id.toString());

      // Strip sensitive fields
      const { password: _pw, ...safeUser } = user;
      safeUser.id = safeUser._id.toString();
      delete safeUser._id;

      return { accessToken, refreshToken, user: safeUser };
    } catch (error) {
      console.error('. Login Service Error:', error);
      throw error;
    }
  },

  /* ══════════════════════════════════════════════════════
     GET PROFILE
  ══════════════════════════════════════════════════════ */
  async getById(id) {
    const user = await User.findById(id).select('-password').lean();
    if (!user) throw new AppError('User not found.', 404);
    
    user.id = user._id.toString();
    delete user._id;
    return user;
  },

  /* ══════════════════════════════════════════════════════
     UPDATE PROFILE
  ══════════════════════════════════════════════════════ */
  async updateProfile(id, { name, email, settings }) {
    const updates = {};

    if (name) {
      updates.name = name.trim();
    }
    if (email) {
      const norm = email.trim().toLowerCase();
      // Check email not taken by someone else
      const conflict = await User.findOne({ email: norm, _id: { $ne: id } }).select('_id').lean();
      if (conflict) throw new AppError('Email address is already in use.', 409);
      updates.email = norm;
    }

    if (settings) {
      if (settings.email_notifications !== undefined) {
        updates['settings.email_notifications'] = settings.email_notifications;
      }
      if (settings.in_app_notifications !== undefined) {
        updates['settings.in_app_notifications'] = settings.in_app_notifications;
      }
      if (settings.theme) {
        updates['settings.theme'] = settings.theme;
      }
    }

    if (Object.keys(updates).length === 0) throw new AppError('No fields to update.', 400);

    const updatedUser = await User.findByIdAndUpdate(id, { $set: updates }, { new: true })
                                  .select('-password')
                                  .lean();
    if (!updatedUser) throw new AppError('User not found.', 404);
    
    updatedUser.id = updatedUser._id.toString();
    delete updatedUser._id;
    return updatedUser;
  },

  /* ══════════════════════════════════════════════════════
     CHANGE PASSWORD
  ══════════════════════════════════════════════════════ */
  async changePassword(id, { currentPassword, newPassword }) {
    const user = await User.findById(id).select('password').lean();
    if (!user) throw new AppError('User not found.', 404);

    const match = await verifyPassword(currentPassword, user.password);
    if (!match) throw new AppError('Current password is incorrect.', 401);

    if (currentPassword === newPassword) {
      throw new AppError('New password must be different from current password.', 400);
    }

    const hashed = await hashPassword(newPassword);
    await User.findByIdAndUpdate(id, { password: hashed });

    return { message: 'Password updated successfully.' };
  },

  /* ══════════════════════════════════════════════════════
     FORGOT PASSWORD
     Generates a short-lived reset token and emails a reset
     link. Returns a generic success message regardless of
     whether the email exists (prevents account enumeration).
  ══════════════════════════════════════════════════════ */
  async forgotPassword({ email }) {
    const norm = (email || '').trim().toLowerCase();
    if (!norm) throw new AppError('Email is required.', 400);

    const user = await User.findOne({ email: norm }).select('name email').lean();

    // Always resolve successfully — never reveal whether the account exists.
    if (user && user.email) {
      const rawToken = PasswordResetToken.generateRawToken();
      await PasswordResetToken.create({
        user_id: user._id,
        token_hash: PasswordResetToken.hashToken(rawToken),
        expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      });

      const resetUrl = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await sendResetEmail({ to: user.email, name: user.name || 'there', resetUrl });
    }

    return {
      message: 'If an account matches that email, a password reset link has been sent.',
    };
  },

  /* ══════════════════════════════════════════════════════
     RESET PASSWORD
     Validates the plain-text token, ensures it is unused and
     unexpired, then sets the new password and invalidates the
     token (and revokes any outstanding sessions for safety).
  ══════════════════════════════════════════════════════ */
  async resetPassword({ token, newPassword }) {
    if (!token) throw new AppError('Reset token is required.', 400);
    if (!newPassword || String(newPassword).length < 8) {
      throw new AppError('New password must be at least 8 characters.', 400);
    }

    const tokenHash = PasswordResetToken.hashToken(token);
    const resetRecord = await PasswordResetToken.findOne({ token_hash: tokenHash });

    if (!resetRecord || resetRecord.used_at) {
      throw new AppError('Invalid or already-used reset token.', 400);
    }
    if (resetRecord.expires_at < new Date()) {
      throw new AppError('This reset link has expired. Please request a new one.', 400);
    }

    const hashed = await hashPassword(newPassword);
    await User.findByIdAndUpdate(resetRecord.user_id, { password: hashed });

    // Invalidate the token so it cannot be reused.
    resetRecord.used_at = new Date();
    await resetRecord.save();

    // Revoke all sessions for this user as an extra safety measure.
    try {
      const { TokenSession } = await import('../models/TokenSession.js');
      await TokenSession.updateMany({ user_id: resetRecord.user_id }, { is_revoked: true });
    } catch (err) {
      console.error('Failed to revoke sessions after password reset:', err.message);
    }

    return { message: 'Your password has been reset successfully. Please sign in.' };
  },

  /* ══════════════════════════════════════════════════════
     GET ALL USERS (ADMIN)
  ══════════════════════════════════════════════════════ */
  async getAllUsers({ role, search, page = 1, limit = 50, requesterRole }) {
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { matric: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const formattedUsers = users.map(u => {
      let isCloaked = false;
      let name = u.name;
      let email = u.email;
      let matric = u.matric;

      // Superadmins cannot see student identities (whistleblower protection)
      if (requesterRole === 'superadmin' && u.role === 'student') {
        isCloaked = true;
        const shortHash = u._id.toString().substring(18, 24).toUpperCase();
        name = `Anonymous Student (STU-${shortHash})`;
        email = `stu-${shortHash.toLowerCase()}@lasustech.edu.ng`;
        matric = `ANON-${shortHash}`;
      }

      return {
        ...u,
        name,
        email,
        matric,
        isCloaked,
        id: u._id.toString(),
        _id: undefined,
      };
    });

    return {
      users: formattedUsers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    };
  },

  /* ══════════════════════════════════════════════════════
     CREATE USER (SUPERADMIN)
  ══════════════════════════════════════════════════════ */
  async createUser({ name, matric, email, password, role, department_id }) {
    const normEmail = email ? email.trim().toLowerCase() : undefined;
    const normMatric = matric.trim().toUpperCase();
    const normName = name.trim();
    const safeRole = ['student', 'staff', 'admin', 'superadmin'].includes(role) ? role : 'student';

    if (normEmail) {
      const byEmail = await User.findOne({ email: normEmail }).select('_id').lean();
      if (byEmail) throw new AppError('Email address is already in use.', 409);
    }
    const byMatric = await User.findOne({ matric: normMatric }).select('_id').lean();
    if (byMatric) throw new AppError('Matric/Staff number is already registered.', 409);

    const hashedPassword = await hashPassword(password);
    
    const newUser = await User.create({
      name: normName,
      matric: normMatric,
      ...(normEmail && { email: normEmail }),
      password: hashedPassword,
      role: safeRole,
      ...(department_id && { department_id }),
    });

    const user = newUser.toObject();
    delete user.password;
    user.id = user._id.toString();
    delete user._id;

    return user;
  },

  /* ══════════════════════════════════════════════════════
     UPDATE USER (SUPERADMIN)
  ══════════════════════════════════════════════════════ */
  async updateUser(userId, { name, department_id, role } = {}) {
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (department_id !== undefined) update.department_id = department_id || null;
    if (role !== undefined && ['student', 'staff', 'admin', 'superadmin'].includes(role)) {
      update.role = role;
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true, runValidators: true }
    ).select('-password').populate('department_id', 'name').lean();

    if (!updated) throw new AppError('User not found.', 404);

    return {
      id: updated._id.toString(),
      name: updated.name,
      email: updated.email,
      matric: updated.matric,
      role: updated.role,
      department: updated.department_id ? { id: updated.department_id._id.toString(), name: updated.department_id.name } : null,
    };
  },
};
