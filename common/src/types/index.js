"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = exports.GenerateVideoSchema = exports.RecordDialogueSchema = exports.UploadDialogueSchema = void 0;
const zod_1 = require("zod");
// API Request/Response Types
exports.UploadDialogueSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    content: zod_1.z.string().min(1),
    audio_file: zod_1.z.any().optional(), // File upload
    template_id: zod_1.z.string().optional(),
});
exports.RecordDialogueSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    audio_data: zod_1.z.string(), // Base64 encoded audio
    template_id: zod_1.z.string().optional(),
});
exports.GenerateVideoSchema = zod_1.z.object({
    template_id: zod_1.z.string(),
    custom_settings: zod_1.z.record(zod_1.z.any()).optional(),
});
// Error Types
class AppError extends Error {
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super(400, message);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(401, message);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(403, message);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(404, `${resource} not found`);
    }
}
exports.NotFoundError = NotFoundError;
//# sourceMappingURL=index.js.map