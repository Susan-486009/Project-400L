import mongoose from 'mongoose';

const platformConfigSchema = new mongoose.Schema(
  {
    systemName: {
      type: String,
      default: 'LASUSTECH Student Resolution Center',
      trim: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    anonymousSubmissions: {
      type: Boolean,
      default: true,
    },
    slaTargetHours: {
      type: Number,
      default: 48,
      min: 1,
    },
    sessionTimeoutMinutes: {
      type: Number,
      default: 30,
      min: 5,
    },
    maxUploadLimitMb: {
      type: Number,
      default: 10,
      min: 1,
    },
    twoFactorEnforced: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

platformConfigSchema.statics.getConfig = async function () {
  const existing = await this.findOne().sort({ created_at: 1 });
  if (existing) return existing;
  return this.create({});
};

export const PlatformConfig = mongoose.model('PlatformConfig', platformConfigSchema);
