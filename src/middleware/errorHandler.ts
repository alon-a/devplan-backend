import { Request, Response, NextFunction } from 'express';
import { AppError, logError } from '../common/src';

// Error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal server error';

  // Handle known application errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  }
  // Handle validation errors
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
  }
  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }
  // Handle database errors
  else if (error.message?.includes('duplicate key')) {
    statusCode = 409;
    message = 'Resource already exists';
  }
  else if (error.message?.includes('foreign key')) {
    statusCode = 400;
    message = 'Invalid reference';
  }
  // Handle file upload errors
  else if (error.message?.includes('File too large')) {
    statusCode = 413;
    message = error.message;
  }
  else if (error.message?.includes('Invalid file type')) {
    statusCode = 400;
    message = error.message;
  }

  // Log error for debugging
  logError(error, `${req.method} ${req.path}`);

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error.message
    })
  });
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}; 
