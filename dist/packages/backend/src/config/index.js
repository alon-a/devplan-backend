"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitConfig = exports.fileConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const common_1 = require("@devplan/common");
// Load environment variables
dotenv_1.default.config();
const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
    GOOGLE_AI_STUDIO_API_KEY: process.env.GOOGLE_AI_STUDIO_API_KEY || '',
    DID_API_KEY: process.env.DID_API_KEY || '',
    DEEPBRAIN_AI_API_KEY: process.env.DEEPBRAIN_AI_API_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
// Additional configuration
exports.fileConfig = {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10),
    allowedAudioTypes: (process.env.ALLOWED_AUDIO_TYPES || 'mp3,wav,m4a,ogg,aac').split(','),
    allowedVideoTypes: (process.env.ALLOWED_VIDEO_TYPES || 'mp4,avi,mov,webm,mkv').split(','),
    allowedImageTypes: (process.env.ALLOWED_IMAGE_TYPES || 'jpg,jpeg,png,gif,webp').split(','),
    allowedTextTypes: (process.env.ALLOWED_TEXT_TYPES || 'txt,md').split(','),
};
exports.rateLimitConfig = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
};
// Validate environment on startup
try {
    (0, common_1.validateEnvironment)(config);
    console.log('✅ Environment configuration validated successfully');
}
catch (error) {
    console.error('❌ Environment validation failed:', error);
    process.exit(1);
}
exports.default = config;
//# sourceMappingURL=index.js.map