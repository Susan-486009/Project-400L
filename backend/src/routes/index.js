import { Router }       from 'express';
import authRoutes        from './auth.routes.js';
import complaintRoutes   from './complaint.routes.js';
import departmentRoutes  from './department.routes.js';
import notificationRoutes from './notification.routes.js';
import aiRoutes          from './ai.routes.js';
import auditRoutes       from './audit.routes.js';
import platformConfigRoutes from './platformConfig.routes.js';
import mongoose from 'mongoose';

const router = Router();

router.use('/auth',        authRoutes);
router.use('/complaints',  complaintRoutes);
router.use('/departments', departmentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai',          aiRoutes);
router.use('/audit',       auditRoutes);
router.use('/admin/platform-config', platformConfigRoutes);

// Version endpoint for tracking deployments
router.get('/version', (_req, res) => {
  res.json({
    version: '1.0.0',
    build: 'release-v1.0'
  });
});

// Health-check — includes live DB connection state
router.get('/health', (_req, res) =>
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    db:        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }),
);

// Liveness probe — checks if the process is up
router.get('/health/liveness', (_req, res) => {
  res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
});

// Readiness probe — checks if the database connection is fully active
router.get('/health/readiness', async (_req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  if (!isDbConnected) {
    return res.status(503).json({
      status: 'unready',
      reason: 'Database connection is not fully established',
      timestamp: new Date().toISOString(),
    });
  }
  res.status(200).json({ status: 'ready', db: 'connected', timestamp: new Date().toISOString() });
});

// Telemetry Prometheus Metrics Exporter
import { getSystemMetrics } from '../middleware/metrics.js';
router.get('/metrics', getSystemMetrics);

export default router;
