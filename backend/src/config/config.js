import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env:  process.env.NODE_ENV   || 'development',
  port: Number(process.env.PORT) || 5000,

  db: {
    uri: process.env.DATABASE_URI || 'mongodb://localhost:27017/lasustech_complaints',
  },

  jwt: {
    secret:    process.env.JWT_SECRET     || 'change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  upload: {
    maxSizeMB:  Number(process.env.MAX_FILE_SIZE_MB) || 5,
    uploadsPath: process.env.UPLOADS_PATH || 'src/uploads',
  },

  complaintRateLimit: {
    maxPerHour:    Number(process.env.MAX_COMPLAINTS_PER_HOUR) || 3,
    windowMinutes: 60,
  },

  ai: {
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel:  process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || '"LASUSTECH Student Complaint Center" <onboarding@resend.dev>',
    enabled: Boolean(process.env.RESEND_API_KEY),
    // When set (testing), every outgoing email is redirected to this owner address
    // so the Resend free tier can actually deliver it. Intended recipient is noted in body.
    redirectTo: process.env.EMAIL_REDIRECT_TO || '',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

// Validate crucial environment variables at startup
const requiredKeys = ['DATABASE_URI', 'JWT_SECRET', 'GROQ_API_KEY'];
if (config.env === 'production') {
  for (const key of requiredKeys) {
    if (!process.env[key]) {
      throw new Error(`CRITICAL STARTUP FAILURE: Environment variable ${key} must be specified in production!`);
    }
  }
  if (config.jwt.secret === 'change_me') {
    throw new Error("CRITICAL STARTUP FAILURE: JWT_SECRET must not be 'change_me' in production!");
  }
} else {
  // Warn in development
  for (const key of requiredKeys) {
    if (!process.env[key]) {
      console.warn(`\n⚠️  CONFIG WARNING: Environment variable ${key} is missing in development mode.\n`);
    }
  }
}
