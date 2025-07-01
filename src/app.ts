import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config, { rateLimitConfig } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { storageService } from './services/storage';
import { testConnection } from './database/supabase';

// Import routes
import authRoutes from './routes/auth';
import dialogueRoutes from './routes/dialogues';
import videoRoutes from './routes/videos';
import templateRoutes from './routes/templates';

const app: Application = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.supabase.co"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.maxRequests,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Compression middleware
app.use(compression() as any);

// Logging middleware
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'DevPlan Video Therapy API is running',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/dialogues', dialogueRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/templates', templateRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'DevPlan Video Therapy API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/profile': 'Get user profile',
        'PUT /api/auth/profile': 'Update user profile',
        'PUT /api/auth/change-password': 'Change password',
        'POST /api/auth/logout': 'Logout user'
      },
      dialogues: {
        'POST /api/dialogues/upload': 'Upload dialogue with audio file',
        'POST /api/dialogues/record': 'Record new dialogue',
        'GET /api/dialogues': 'Get all dialogues for user',
        'GET /api/dialogues/:id': 'Get specific dialogue',
        'GET /api/dialogues/:id/analysis': 'Get dialogue analysis',
        'POST /api/dialogues/:id/generate': 'Generate video from dialogue',
        'PUT /api/dialogues/:id': 'Update dialogue',
        'DELETE /api/dialogues/:id': 'Delete dialogue'
      },
      videos: {
        'GET /api/videos': 'Get all videos for user',
        'GET /api/videos/:id': 'Get video details',
        'GET /api/videos/:id/download': 'Get video download URL',
        'DELETE /api/videos/:id': 'Delete video',
        'GET /api/videos/stats/summary': 'Get video statistics'
      },
      templates: {
        'GET /api/templates': 'Get all templates',
        'GET /api/templates/:id': 'Get specific template',
        'GET /api/templates/categories/list': 'Get template categories',
        'GET /api/templates/category/:category': 'Get templates by category'
      }
    }
  });
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize services on startup
const initializeServices = async () => {
  try {
    console.log('🚀 Initializing DevPlan Video Therapy API...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection established');

    // Initialize storage buckets
    await storageService.initializeBuckets();
    console.log('✅ Storage buckets initialized');

    console.log('🎉 All services initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    process.exit(1);
  }
};

// Export app and initialization function
export { app, initializeServices }; 
