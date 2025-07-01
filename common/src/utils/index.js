"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logInfo = exports.logError = exports.sanitizeUser = exports.createErrorResponse = exports.createSuccessResponse = exports.calculatePagination = exports.parseDate = exports.formatDate = exports.isValidFileSize = exports.isValidFileType = exports.generateFileName = exports.validateEnvironment = exports.handleAsyncError = exports.validateSchema = void 0;
const zod_1 = require("zod");
const types_1 = require("../types");
// Validation utilities
const validateSchema = (schema, data) => {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
            throw new types_1.ValidationError(messages.join(', '));
        }
        throw error;
    }
};
exports.validateSchema = validateSchema;
// Error handling utilities
const handleAsyncError = (promise) => {
    return promise.catch((error) => {
        if (error instanceof types_1.AppError) {
            throw error;
        }
        console.error('Unexpected error:', error);
        throw new types_1.AppError(500, 'Internal server error');
    });
};
exports.handleAsyncError = handleAsyncError;
// Environment validation
const validateEnvironment = (config) => {
    const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_KEY',
        'ELEVENLABS_API_KEY',
        'GOOGLE_AI_STUDIO_API_KEY',
        'DID_API_KEY',
        'DEEPBRAIN_AI_API_KEY',
        'JWT_SECRET'
    ];
    const missing = requiredVars.filter(varName => !config[varName]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};
exports.validateEnvironment = validateEnvironment;
// File utilities
const generateFileName = (originalName, userId) => {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop();
    return `${userId}_${timestamp}.${extension}`;
};
exports.generateFileName = generateFileName;
const isValidFileType = (fileName, allowedTypes) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
};
exports.isValidFileType = isValidFileType;
const isValidFileSize = (fileSize, maxSizeInMB) => {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return fileSize <= maxSizeInBytes;
};
exports.isValidFileSize = isValidFileSize;
// Date utilities
const formatDate = (date) => {
    return date.toISOString();
};
exports.formatDate = formatDate;
const parseDate = (dateString) => {
    return new Date(dateString);
};
exports.parseDate = parseDate;
// Pagination utilities
const calculatePagination = (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    return {
        page,
        limit,
        total,
        totalPages,
        offset,
        hasNext: page < totalPages,
        hasPrev: page > 1
    };
};
exports.calculatePagination = calculatePagination;
// Response formatting
const createSuccessResponse = (data, message) => ({
    success: true,
    data,
    message
});
exports.createSuccessResponse = createSuccessResponse;
const createErrorResponse = (error, statusCode = 500) => ({
    success: false,
    error,
    statusCode
});
exports.createErrorResponse = createErrorResponse;
// Authentication utilities
const sanitizeUser = (user) => {
    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
};
exports.sanitizeUser = sanitizeUser;
// Logging utilities
const logError = (error, context) => {
    console.error(`[${context || 'ERROR'}]`, {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
};
exports.logError = logError;
const logInfo = (message, data) => {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};
exports.logInfo = logInfo;
//# sourceMappingURL=index.js.map