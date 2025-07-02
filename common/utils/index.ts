import { z } from 'zod';
import { AppError, ValidationError } from '../types';

// Validation utilities
export const validateSchema = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new ValidationError(messages.join(', '));
    }
    throw error;
  }
};

// Error handling utilities
export const handleAsyncError = <T>(promise: Promise<T>): Promise<T> => {
  return promise.catch((error) => {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Unexpected error:', error);
    throw new AppError(500, 'Internal server error');
  });
};

// Environment validation
export const validateEnvironment = (config: Record<string, any>): void => {
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

// File utilities
export const generateFileName = (originalName: string, userId: string): string => {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop();
  return `${userId}_${timestamp}.${extension}`;
};

export const isValidFileType = (fileName: string, allowedTypes: string[]): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? allowedTypes.includes(extension) : false;
};

export const isValidFileSize = (fileSize: number, maxSizeInMB: number): boolean => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return fileSize <= maxSizeInBytes;
};

// Date utilities
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const parseDate = (dateString: string): Date => {
  return new Date(dateString);
};

// Pagination utilities
export const calculatePagination = (
  page: number,
  limit: number,
  total: number
) => {
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

// Response formatting
export const createSuccessResponse = <T>(data: T, message?: string) => ({
  success: true,
  data,
  message
});

export const createErrorResponse = (error: string, statusCode = 500) => ({
  success: false,
  error,
  statusCode
});

// Authentication utilities
export const sanitizeUser = (user: any) => {
  const { password_hash, ...sanitizedUser } = user;
  return sanitizedUser;
};

// Logging utilities
export const logError = (error: Error, context?: string) => {
  console.error(`[${context || 'ERROR'}]`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
};

export const logInfo = (message: string, data?: any) => {
  console.log(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}; 