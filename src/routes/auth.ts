import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../database/supabase';
import { 
  authenticateToken, 
  generateToken, 
  hashPassword, 
  comparePassword,
  validatePassword,
  validateEmail 
} from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createSuccessResponse, createErrorResponse } from '../common';

const router: Router = Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 100 })
], asyncHandler(async (req: Request, res: Response) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createErrorResponse(errors.array()[0].msg));
  }

  const { email, password, firstName, lastName } = req.body;

  // Validate email format
  if (!validateEmail(email)) {
    return res.status(400).json(createErrorResponse('Invalid email format'));
  }

  // Validate password strength
  if (!validatePassword(password)) {
    return res.status(400).json(createErrorResponse(
      'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'
    ));
  }

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    return res.status(409).json(createErrorResponse('User already exists'));
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const { data: user, error } = await supabase
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
  const token = generateToken(user.id);

  // Return user data (without password) and token
  const { password_hash, ...userData } = user;
  
  res.status(201).json(createSuccessResponse({
    user: userData,
    token
  }, 'User registered successfully'));
}));

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], asyncHandler(async (req: Request, res: Response) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createErrorResponse(errors.array()[0].msg));
  }

  const { email, password } = req.body;

  // Find user by email
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    return res.status(401).json(createErrorResponse('Invalid credentials'));
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json(createErrorResponse('Invalid credentials'));
  }

  // Generate token
  const token = generateToken(user.id);

  // Return user data (without password) and token
  const { password_hash, ...userData } = user;
  
  res.json(createSuccessResponse({
    user: userData,
    token
  }, 'Login successful'));
}));

// Get current user profile
router.get('/profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return res.status(404).json(createErrorResponse('User not found'));
  }

  // Return user data (without password)
  const { password_hash, ...userData } = user;
  
  res.json(createSuccessResponse({ user: userData }));
}));

// Update user profile
router.put('/profile', authenticateToken, [
  body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
  body('avatarUrl').optional().isURL()
], asyncHandler(async (req: Request, res: Response) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createErrorResponse(errors.array()[0].msg));
  }

  const userId = req.user!.id;
  const { firstName, lastName, avatarUrl } = req.body;

  // Update user
  const { data: user, error } = await supabase
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
  
  res.json(createSuccessResponse({ user: userData }, 'Profile updated successfully'));
}));

// Change password
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], asyncHandler(async (req: Request, res: Response) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createErrorResponse(errors.array()[0].msg));
  }

  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body;

  // Validate new password strength
  if (!validatePassword(newPassword)) {
    return res.status(400).json(createErrorResponse(
      'New password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'
    ));
  }

  // Get current user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return res.status(404).json(createErrorResponse('User not found'));
  }

  // Verify current password
  const isValidCurrentPassword = await comparePassword(currentPassword, user.password_hash);
  if (!isValidCurrentPassword) {
    return res.status(400).json(createErrorResponse('Current password is incorrect'));
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);

  // Update password
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash: newPasswordHash })
    .eq('id', userId);

  if (updateError) {
    throw updateError;
  }

  res.json(createSuccessResponse(null, 'Password changed successfully'));
}));

// Logout user (client-side token removal)
router.post('/logout', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  // In a more sophisticated setup, you might want to blacklist the token
  // For now, we'll just return a success response
  res.json(createSuccessResponse(null, 'Logged out successfully'));
}));

export default router; 
