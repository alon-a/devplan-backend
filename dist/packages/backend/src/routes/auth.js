"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const supabase_1 = require("../database/supabase");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const common_1 = require("@devplan/common");
const router = (0, express_1.Router)();
// Register new user
router.post('/register', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 8 }),
    (0, express_validator_1.body)('firstName').optional().trim().isLength({ min: 1, max: 100 }),
    (0, express_validator_1.body)('lastName').optional().trim().isLength({ min: 1, max: 100 })
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
    }
    const { email, password, firstName, lastName } = req.body;
    // Validate email format
    if (!(0, auth_1.validateEmail)(email)) {
        return res.status(400).json((0, common_1.createErrorResponse)('Invalid email format'));
    }
    // Validate password strength
    if (!(0, auth_1.validatePassword)(password)) {
        return res.status(400).json((0, common_1.createErrorResponse)('Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'));
    }
    // Check if user already exists
    const { data: existingUser } = await supabase_1.supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
    if (existingUser) {
        return res.status(409).json((0, common_1.createErrorResponse)('User already exists'));
    }
    // Hash password
    const passwordHash = await (0, auth_1.hashPassword)(password);
    // Create user
    const { data: user, error } = await supabase_1.supabase
        .from('users')
        .insert({
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName
    })
        .select()
        .single();
    if (error) {
        throw error;
    }
    // Generate token
    const token = (0, auth_1.generateToken)(user.id);
    // Return user data (without password) and token
    const { password_hash, ...userData } = user;
    res.status(201).json((0, common_1.createSuccessResponse)({
        user: userData,
        token
    }, 'User registered successfully'));
}));
// Login user
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty()
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
    }
    const { email, password } = req.body;
    // Find user by email
    const { data: user, error } = await supabase_1.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
    if (error || !user) {
        return res.status(401).json((0, common_1.createErrorResponse)('Invalid credentials'));
    }
    // Verify password
    const isValidPassword = await (0, auth_1.comparePassword)(password, user.password_hash);
    if (!isValidPassword) {
        return res.status(401).json((0, common_1.createErrorResponse)('Invalid credentials'));
    }
    // Generate token
    const token = (0, auth_1.generateToken)(user.id);
    // Return user data (without password) and token
    const { password_hash, ...userData } = user;
    res.json((0, common_1.createSuccessResponse)({
        user: userData,
        token
    }, 'Login successful'));
}));
// Get current user profile
router.get('/profile', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { data: user, error } = await supabase_1.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    if (error || !user) {
        return res.status(404).json((0, common_1.createErrorResponse)('User not found'));
    }
    // Return user data (without password)
    const { password_hash, ...userData } = user;
    res.json((0, common_1.createSuccessResponse)({ user: userData }));
}));
// Update user profile
router.put('/profile', auth_1.authenticateToken, [
    (0, express_validator_1.body)('firstName').optional().trim().isLength({ min: 1, max: 100 }),
    (0, express_validator_1.body)('lastName').optional().trim().isLength({ min: 1, max: 100 }),
    (0, express_validator_1.body)('avatarUrl').optional().isURL()
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
    }
    const userId = req.user.id;
    const { firstName, lastName, avatarUrl } = req.body;
    // Update user
    const { data: user, error } = await supabase_1.supabase
        .from('users')
        .update({
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl
    })
        .eq('id', userId)
        .select()
        .single();
    if (error) {
        throw error;
    }
    // Return updated user data (without password)
    const { password_hash, ...userData } = user;
    res.json((0, common_1.createSuccessResponse)({ user: userData }, 'Profile updated successfully'));
}));
// Change password
router.put('/change-password', auth_1.authenticateToken, [
    (0, express_validator_1.body)('currentPassword').notEmpty(),
    (0, express_validator_1.body)('newPassword').isLength({ min: 8 })
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
    }
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    // Validate new password strength
    if (!(0, auth_1.validatePassword)(newPassword)) {
        return res.status(400).json((0, common_1.createErrorResponse)('New password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'));
    }
    // Get current user
    const { data: user, error: userError } = await supabase_1.supabase
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single();
    if (userError || !user) {
        return res.status(404).json((0, common_1.createErrorResponse)('User not found'));
    }
    // Verify current password
    const isValidCurrentPassword = await (0, auth_1.comparePassword)(currentPassword, user.password_hash);
    if (!isValidCurrentPassword) {
        return res.status(400).json((0, common_1.createErrorResponse)('Current password is incorrect'));
    }
    // Hash new password
    const newPasswordHash = await (0, auth_1.hashPassword)(newPassword);
    // Update password
    const { error: updateError } = await supabase_1.supabase
        .from('users')
        .update({ password_hash: newPasswordHash })
        .eq('id', userId);
    if (updateError) {
        throw updateError;
    }
    res.json((0, common_1.createSuccessResponse)(null, 'Password changed successfully'));
}));
// Logout user (client-side token removal)
router.post('/logout', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just return a success response
    res.json((0, common_1.createSuccessResponse)(null, 'Logged out successfully'));
}));
exports.default = router;
//# sourceMappingURL=auth.js.map