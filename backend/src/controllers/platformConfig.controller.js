import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { PlatformConfig } from '../models/PlatformConfig.js';

export const getPlatformConfig = asyncHandler(async (req, res) => {
  const config = await PlatformConfig.getConfig();
  sendSuccess(res, config);
});

export const updatePlatformConfig = asyncHandler(async (req, res) => {
  const allowed = [
    'systemName',
    'maintenanceMode',
    'anonymousSubmissions',
    'slaTargetHours',
    'sessionTimeoutMinutes',
    'maxUploadLimitMb',
    'twoFactorEnforced',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const config = await PlatformConfig.getConfig();
  Object.assign(config, updates);
  await config.save();
  sendSuccess(res, config, 'Platform configuration updated successfully.');
});
