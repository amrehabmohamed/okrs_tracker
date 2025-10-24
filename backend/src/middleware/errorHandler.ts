import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  ErrorCode,
  ProblemDetails,
  ERROR_CATALOG,
  ValidationErrorDetail,
  ErrorMetadata
} from '../types/errors';

/**
 * RFC 7807/9457 Compliant Application Error
 * @see https://tools.ietf.org/html/rfc7807
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly traceId: string;
  public readonly metadata?: ErrorMetadata;
  public readonly errors?: ValidationErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    metadata?: ErrorMetadata,
    errors?: ValidationErrorDetail[]
  ) {
    super(message);
    this.code = code;
    this.statusCode = ERROR_CATALOG[code].status;
    this.traceId = uuidv4();
    this.metadata = metadata;
    this.errors = errors;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to RFC 7807 Problem Details format
   */
  toProblemDetails(req?: Request): ProblemDetails {
    const catalog = ERROR_CATALOG[this.code];
    
    return {
      type: catalog.type,
      title: catalog.title,
      status: catalog.status,
      detail: this.message,
      instance: req ? `${req.method} ${req.path}` : undefined,
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
      errors: this.errors,
      metadata: this.metadata,
      path: req?.path,
      method: req?.method
    };
  }
}

/**
 * Global error handler middleware - RFC 7807 compliant
 * Sets Content-Type: application/problem+json
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Handle AppError (operational)
  if (err instanceof AppError) {
    const problemDetails = err.toProblemDetails(req);
    
    // Security: Remove sensitive metadata in production
    if (!isDevelopment && problemDetails.metadata) {
      delete problemDetails.metadata;
    }
    
    // Log error
    console.error('AppError:', {
      code: err.code,
      traceId: err.traceId,
      message: err.message,
      path: req.path,
      method: req.method,
      user: (req as any).user?.id,
      timestamp: problemDetails.timestamp,
      ...(isDevelopment && { stack: err.stack })
    });
    
    // Return RFC 7807 response
    return res
      .status(err.statusCode)
      .type('application/problem+json')
      .json({
        ...problemDetails,
        ...(isDevelopment && { stack: err.stack })
      });
  }
  
  // Handle unknown errors (non-operational)
  const traceId = uuidv4();
  const timestamp = new Date().toISOString();
  
  // Log unexpected error
  console.error('UnexpectedError:', {
    traceId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: (req as any).user?.id,
    timestamp
  });
  
  // Return generic error (hide details in production)
  const problemDetails: ProblemDetails = {
    type: ERROR_CATALOG[ErrorCode.SERVER_INTERNAL_ERROR].type,
    title: ERROR_CATALOG[ErrorCode.SERVER_INTERNAL_ERROR].title,
    status: 500,
    detail: isDevelopment ? err.message : 'An unexpected error occurred',
    instance: `${req.method} ${req.path}`,
    traceId,
    timestamp,
    path: req.path,
    method: req.method
  };
  
  res
    .status(500)
    .type('application/problem+json')
    .json({
      ...problemDetails,
      ...(isDevelopment && { stack: err.stack })
    });
};

/**
 * Async handler wrapper - catches promise rejections
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Helper to create standardized success responses
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  metadata?: Record<string, unknown>;
}

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  metadata?: Record<string, unknown>
): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
    ...(metadata && { metadata })
  };
}

/**
 * Convenience error classes for common HTTP errors
 */
export class ValidationError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata, errors?: ValidationErrorDetail[]) {
    super(ErrorCode.VALIDATION_FAILED, message, metadata, errors);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(ErrorCode.AUTH_CREDENTIALS_INVALID, message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(ErrorCode.RESOURCE_NOT_FOUND, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ErrorCode.RESOURCE_CONFLICT, message);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message);
  }
}
