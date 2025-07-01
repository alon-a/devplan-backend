"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEmail = exports.validatePassword = exports.comparePassword = exports.hashPassword = exports.generateToken = exports.requireOwnership = exports.requireRole = exports.optionalAuth = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabase_1 = require("../database/supabase");
const config_1 = __importDefault(require("../config"));
const common_1 = require("@devplan/common");
// JWT token verification middleware
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            throw new common_1.AuthenticationError('Access token required');
        }
        // Verify JWT token
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.JWT_SECRET);
        // Get user from database
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('id', decoded.userId)
            .single();
        if (error || !user) {
            throw new common_1.AuthenticationError('Invalid token');
        }
        // Add user to request object
        req.user = (0, common_1.sanitizeUser)(user);
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new common_1.AuthenticationError('Invalid token'));
        }
        else {
            next(error);
        }
    }
};
exports.authenticateToken = authenticateToken;
// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return next(); // Continue without user
        }
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.JWT_SECRET);
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('id', decoded.userId)
            .single();
        if (!error && user) {
            req.user = (0, common_1.sanitizeUser)(user);
        }
        next();
    }
    catch (error) {
        // Continue without user if token is invalid
        next();
    }
};
exports.optionalAuth = optionalAuth;
// Role-based authorization middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new common_1.AuthenticationError('Authentication required'));
        }
        // For now, we'll use a simple role system
        // In the future, you might want to add a roles table
        const userRole = req.user.role || 'user';
        if (!roles.includes(userRole)) {
            return next(new common_1.AuthorizationError('Insufficient permissions'));
        }
        next();
    };
};
exports.requireRole = requireRole;
// Resource ownership middleware
const requireOwnership = (resourceTable) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(new common_1.AuthenticationError('Authentication required'));
            }
            const resourceId = req.params.id;
            if (!resourceId) {
                return next(new Error('Resource ID required'));
            }
            // Check if user owns the resource
            const { data: resource, error } = await supabase_1.supabase
                .from(resourceTable)
                .select('user_id')
                .eq('id', resourceId)
                .single();
            if (error || !resource) {
                return next(new Error('Resource not found'));
            }
            if (resource.user_id !== req.user.id) {
                return next(new common_1.AuthorizationError('Access denied'));
            }
            next();
        }
        catch (error) {
            (0, common_1.logError)(error, 'Ownership check failed');
            next(error);
        }
    };
};
exports.requireOwnership = requireOwnership;
// Generate JWT token
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, config_1.default.JWT_SECRET, { expiresIn: '24h' });
};
exports.generateToken = generateToken;
// Hash password
const hashPassword = async (password) => {
    const saltRounds = 12;
    return bcryptjs_1.default.hash(password, saltRounds);
};
exports.hashPassword = hashPassword;
// Compare password
const comparePassword = async (password, hash) => {
    return bcryptjs_1.default.compare(password, hash);
};
exports.comparePassword = comparePassword;
// Validate password strength
const validatePassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};
exports.validatePassword = validatePassword;
// Validate email format
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.validateEmail = validateEmail;
//# sourceMappingURL=auth.js.map