import mongoose from 'mongoose';
import crypto from 'crypto';

const passwordResetTokenSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // We store a SHA-256 hash of the raw token (never the raw token),
    // so a DB leak does not expose usable reset links.
    token_hash: {
      type: String,
      required: true,
      unique: true,
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index — auto-deletes expired tokens
    },
    used_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

passwordResetTokenSchema.statics.hashToken = (rawToken) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

passwordResetTokenSchema.statics.generateRawToken = () =>
  crypto.randomBytes(32).toString('hex');

export const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
