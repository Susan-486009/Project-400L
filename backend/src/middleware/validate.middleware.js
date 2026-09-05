/**
 * auth.middleware.js — Input Validation
 *
 * Lightweight validation middleware — no extra libraries.
 * Attaches sanitised values to req.body and calls next(),
 * or responds 422 with structured field errors.
 */

import { sendError } from '../utils/response.js';

/* ─── helpers ──────────────────────────────────────────── */
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const rules = {
  required: (v, label) => (v == null || String(v).trim() === '' ? `${label} is required.` : null),
  email:    (v, label) => (!isEmail(v) ? `${label} must be a valid email address.` : null),
  minLen:   (n) => (v, label) => (String(v).length < n ? `${label} must be at least ${n} characters.` : null),
  maxLen:   (n) => (v, label) => (String(v).length > n ? `${label} must not exceed ${n} characters.` : null),
  matches:  (field) => (v, label, body) =>
    v !== body[field] ? `${label} does not match ${field}.` : null,
  uppercase: (v, label) => (!/[A-Z]/.test(v) ? `${label} must contain at least one uppercase letter.` : null),
  digit:     (v, label) => (!/[0-9]/.test(v) ? `${label} must contain at least one number.` : null),
  matricFormat: (v, label, body) => {
    // Relaxed to allow institutional formats (digits, slashes, letters, hyphens)
    if (!body.role || body.role === 'student') {
      if (!/^[A-Z0-9\/-]{3,20}$/i.test(v)) {
        return `${label} must be a valid institutional identifier (e.g., 2021/XXX/XXXX).`;
      }
    }
    return null;
  },
};

/**
 * Schema-driven validation factory.
 * schema format:
 *   { fieldName: { label, rules: [fn, fn, ...] } }
 */
const validate = (schema) => (req, res, next) => {
  const errors = {};

  for (const [field, def] of Object.entries(schema)) {
    const value = req.body[field];
    for (const rule of def.rules) {
      const msg = rule(value, def.label, req.body);
      if (msg) { errors[field] = msg; break; }   // first failing rule wins
    }
  }

  if (Object.keys(errors).length > 0) {
    return sendError(res, 'Validation failed. Please check your input.', 422, errors);
  }

  next();
};

/* ─── REGISTER schema ──────────────────────────────────── */
export const validateRegister = validate({
  name: {
    label: 'Full Name',
    rules: [
      rules.required,
      rules.minLen(3),
      rules.maxLen(150),
    ],
  },
  matric: {
    label: 'Matric/Staff Number',
    rules: [
      rules.required,
      rules.minLen(3),
      rules.maxLen(60),
      rules.matricFormat,
    ],
  },
  email: {
    label: 'Email',
    rules: [
      // Email is optional — only validate format if one is provided
      (v, label) => {
        if (!v || String(v).trim() === '') return null; // skip if empty
        return !isEmail(v) ? `${label} must be a valid email address.` : null;
      },
    ],
  },
  password: {
    label: 'Password',
    rules: [
      rules.required,
      rules.minLen(8),
      rules.maxLen(128),
      rules.uppercase,
      rules.digit,
    ],
  },
});

/* ─── LOGIN schema ─────────────────────────────────────── */
export const validateLogin = validate({
  identifier: {
    label: 'Email or Matric',
    rules: [
      rules.required,
      rules.minLen(3),
    ],
  },
  password: {
    label: 'Password',
    rules: [
      rules.required,
      rules.minLen(1),
    ],
  },
});

/* ─── CHANGE PASSWORD schema ───────────────────────────── */
export const validateChangePassword = validate({
  currentPassword: {
    label: 'Current Password',
    rules: [rules.required],
  },
  newPassword: {
    label: 'New Password',
    rules: [
      rules.required,
      rules.minLen(8),
      rules.uppercase,
      rules.digit,
    ],
  },
});

/* ─── FORGOT PASSWORD schema ───────────────────────────── */
export const validateForgotPassword = validate({
  email: {
    label: 'Email',
    rules: [rules.required, rules.email],
  },
});

/* ─── RESET PASSWORD schema ────────────────────────────── */
export const validateResetPassword = validate({
  token: {
    label: 'Reset Token',
    rules: [rules.required],
  },
  newPassword: {
    label: 'New Password',
    rules: [
      rules.required,
      rules.minLen(8),
      rules.uppercase,
      rules.digit,
    ],
  },
});
