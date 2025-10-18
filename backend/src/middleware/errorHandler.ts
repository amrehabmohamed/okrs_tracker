import { Request, Response, NextFunction } from 'express';

export interface ErrorResponse {
  status: number;
  message: string;
  details?: any;
}

export class AppError extends Error {
  status: number;
  isOperational: boolean;
  details?: any;

  constructor(message: string, status: number = 500, isOperational: boolean = true) {
    super(message);
    this.status = status;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Default to 500 server error
  let status = 500;
  let message = 'Internal server error';

  if (err instanceof AppError) {
    status = err.status;
    message = err.message;
    
    // Include details for validation errors
    if (err instanceof ValidationError && err.details) {
      return res.status(status).json({
        status,
        message,
        details: err.details,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    }
  }

  res.status(status).json({
    status,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
