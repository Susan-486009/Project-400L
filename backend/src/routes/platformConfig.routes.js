import { Router } from 'express';
import * as platformConfig from '../controllers/platformConfig.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

// Platform config readable by admin/superadmin
router.get('/', authorize('admin', 'superadmin'), platformConfig.getPlatformConfig);

// Only superadmin may modify institutional policies
router.put('/', authorize('superadmin'), platformConfig.updatePlatformConfig);

export default router;
