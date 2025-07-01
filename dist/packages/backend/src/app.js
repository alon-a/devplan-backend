"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeServices = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = __importStar(require("./config"));
const errorHandler_1 = require("./middleware/errorHandler");
const storage_1 = require("./services/storage");
const supabase_1 = require("./database/supabase");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const dialogues_1 = __importDefault(require("./routes/dialogues"));
const videos_1 = __importDefault(require("./routes/videos"));
const templates_1 = __importDefault(require("./routes/templates"));
const app = (0, express_1.default)();
exports.app = app;
// Security middleware
app.use((0, helmet_1.default)({
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
app.use((0, cors_1.default)({
    origin: config_1.default.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.rateLimitConfig.windowMs,
    max: config_1.rateLimitConfig.maxRequests,
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
// Compression middleware
app.use((0, compression_1.default)());
// Logging middleware
if (config_1.default.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('combined'));
}
// Body parsing middleware
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'DevPlan Video Therapy API is running',
        timestamp: new Date().toISOString(),
        environment: config_1.default.NODE_ENV
    });
});
// API routes
app.use('/api/auth', auth_1.default);
app.use('/api/dialogues', dialogues_1.default);
app.use('/api/videos', videos_1.default);
app.use('/api/templates', templates_1.default);
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
app.use(errorHandler_1.notFoundHandler);
// Error handling middleware (must be last)
app.use(errorHandler_1.errorHandler);
// Initialize services on startup
const initializeServices = async () => {
    try {
        console.log('🚀 Initializing DevPlan Video Therapy API...');
        // Test database connection
        const dbConnected = await (0, supabase_1.testConnection)();
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }
        console.log('✅ Database connection established');
        // Initialize storage buckets
        await storage_1.storageService.initializeBuckets();
        console.log('✅ Storage buckets initialized');
        console.log('🎉 All services initialized successfully');
    }
    catch (error) {
        console.error('❌ Service initialization failed:', error);
        process.exit(1);
    }
};
exports.initializeServices = initializeServices;
//# sourceMappingURL=app.js.map