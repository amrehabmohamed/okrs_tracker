/**
 * Error Codes & Types - RFC 7807/9457 Compliant
 * 
 * Industry standard for API error handling
 * References:
 * - RFC 7807: https://tools.ietf.org/html/rfc7807
 * - RFC 9457: https://www.rfc-editor.org/rfc/rfc9457.html
 */

/**
 * Error code enum - machine-readable error identifiers
 * Format: CATEGORY_SPECIFIC_ERROR
 */
export enum ErrorCode {
  // ========== AUTHENTICATION (1xxx) ==========
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_CREDENTIALS_INVALID = 'AUTH_CREDENTIALS_INVALID',
  AUTH_EMAIL_NOT_VERIFIED = 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_ACCOUNT_NOT_APPROVED = 'AUTH_ACCOUNT_NOT_APPROVED',
  AUTH_ACCOUNT_SUSPENDED = 'AUTH_ACCOUNT_SUSPENDED',
  AUTH_ACCOUNT_REJECTED = 'AUTH_ACCOUNT_REJECTED',
  
  // ========== AUTHORIZATION (2xxx) ==========
  AUTHZ_FORBIDDEN = 'AUTHZ_FORBIDDEN',
  AUTHZ_MANAGER_REQUIRED = 'AUTHZ_MANAGER_REQUIRED',
  AUTHZ_ADMIN_REQUIRED = 'AUTHZ_ADMIN_REQUIRED',
  AUTHZ_INSUFFICIENT_PERMISSIONS = 'AUTHZ_INSUFFICIENT_PERMISSIONS',
  
  // ========== VALIDATION (3xxx) ==========
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_INVALID_TYPE = 'VALIDATION_INVALID_TYPE',
  VALIDATION_OUT_OF_RANGE = 'VALIDATION_OUT_OF_RANGE',
  VALIDATION_CONSTRAINT_VIOLATED = 'VALIDATION_CONSTRAINT_VIOLATED',
  VALIDATION_WEIGHT_SUM_INVALID = 'VALIDATION_WEIGHT_SUM_INVALID',
  VALIDATION_PASSWORD_WEAK = 'VALIDATION_PASSWORD_WEAK',
  
  // ========== RESOURCE (4xxx) ==========
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_GONE = 'RESOURCE_GONE',
  
  // ========== BUSINESS LOGIC (5xxx) ==========
  BUSINESS_DEADLINE_MISSED = 'BUSINESS_DEADLINE_MISSED',
  BUSINESS_DEADLINE_PASSED = 'BUSINESS_DEADLINE_PASSED',
  BUSINESS_OPERATION_NOT_ALLOWED = 'BUSINESS_OPERATION_NOT_ALLOWED',
  BUSINESS_STATUS_INVALID = 'BUSINESS_STATUS_INVALID',
  BUSINESS_INSUFFICIENT_BALANCE = 'BUSINESS_INSUFFICIENT_BALANCE',
  
  // ========== DATABASE (6xxx) ==========
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_CONSTRAINT_VIOLATED = 'DATABASE_CONSTRAINT_VIOLATED',
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  
  // ========== RATE LIMITING (7xxx) ==========
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_TOO_MANY_REQUESTS = 'RATE_LIMIT_TOO_MANY_REQUESTS',
  
  // ========== SERVER (8xxx) ==========
  SERVER_INTERNAL_ERROR = 'SERVER_INTERNAL_ERROR',
  SERVER_SERVICE_UNAVAILABLE = 'SERVER_SERVICE_UNAVAILABLE',
  SERVER_TIMEOUT = 'SERVER_TIMEOUT',
  SERVER_NOT_IMPLEMENTED = 'SERVER_NOT_IMPLEMENTED',
  
  // ========== EXTERNAL SERVICES (9xxx) ==========
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  EXTERNAL_SERVICE_TIMEOUT = 'EXTERNAL_SERVICE_TIMEOUT',
  EXTERNAL_SERVICE_UNAVAILABLE = 'EXTERNAL_SERVICE_UNAVAILABLE',
}

/**
 * Error metadata for additional context
 */
export interface ErrorMetadata {
  field?: string;
  value?: unknown;
  constraint?: string;
  expected?: unknown;
  received?: unknown;
  suggestion?: string;
  [key: string]: unknown;
}

/**
 * Validation error detail (for field-level errors)
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

/**
 * RFC 7807 Problem Details object
 * @see https://tools.ietf.org/html/rfc7807
 */
export interface ProblemDetails {
  // Required fields
  type: string;           // URI identifying the problem type
  title: string;          // Human-readable summary
  status: number;         // HTTP status code
  
  // Optional fields
  detail?: string;        // Human-readable explanation
  instance?: string;      // URI identifying this specific occurrence
  
  // Extension fields (RFC 7807 allows custom fields)
  traceId?: string;       // For request tracing
  timestamp?: string;     // ISO 8601 timestamp
  errors?: ValidationErrorDetail[];  // Field-level validation errors
  metadata?: ErrorMetadata;  // Additional context
  path?: string;          // Request path
  method?: string;        // HTTP method
}

/**
 * Error catalog - maps error codes to problem details
 */
export const ERROR_CATALOG: Record<ErrorCode, Omit<ProblemDetails, 'detail' | 'instance' | 'traceId' | 'timestamp'>> = {
  // Authentication
  [ErrorCode.AUTH_TOKEN_MISSING]: {
    type: 'https://api.okrplatform.com/errors/auth/token-missing',
    title: 'Authentication Token Missing',
    status: 401
  },
  [ErrorCode.AUTH_TOKEN_INVALID]: {
    type: 'https://api.okrplatform.com/errors/auth/token-invalid',
    title: 'Invalid Authentication Token',
    status: 401
  },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: {
    type: 'https://api.okrplatform.com/errors/auth/token-expired',
    title: 'Authentication Token Expired',
    status: 401
  },
  [ErrorCode.AUTH_CREDENTIALS_INVALID]: {
    type: 'https://api.okrplatform.com/errors/auth/invalid-credentials',
    title: 'Invalid Credentials',
    status: 401
  },
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: {
    type: 'https://api.okrplatform.com/errors/auth/email-not-verified',
    title: 'Email Not Verified',
    status: 403
  },
  [ErrorCode.AUTH_ACCOUNT_NOT_APPROVED]: {
    type: 'https://api.okrplatform.com/errors/auth/account-not-approved',
    title: 'Account Pending Approval',
    status: 403
  },
  [ErrorCode.AUTH_ACCOUNT_SUSPENDED]: {
    type: 'https://api.okrplatform.com/errors/auth/account-suspended',
    title: 'Account Suspended',
    status: 403
  },
  [ErrorCode.AUTH_ACCOUNT_REJECTED]: {
    type: 'https://api.okrplatform.com/errors/auth/account-rejected',
    title: 'Account Rejected',
    status: 403
  },
  
  // Authorization
  [ErrorCode.AUTHZ_FORBIDDEN]: {
    type: 'https://api.okrplatform.com/errors/authz/forbidden',
    title: 'Access Forbidden',
    status: 403
  },
  [ErrorCode.AUTHZ_MANAGER_REQUIRED]: {
    type: 'https://api.okrplatform.com/errors/authz/manager-required',
    title: 'Manager Access Required',
    status: 403
  },
  [ErrorCode.AUTHZ_ADMIN_REQUIRED]: {
    type: 'https://api.okrplatform.com/errors/authz/admin-required',
    title: 'Admin Access Required',
    status: 403
  },
  [ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS]: {
    type: 'https://api.okrplatform.com/errors/authz/insufficient-permissions',
    title: 'Insufficient Permissions',
    status: 403
  },
  
  // Validation
  [ErrorCode.VALIDATION_FAILED]: {
    type: 'https://api.okrplatform.com/errors/validation/failed',
    title: 'Validation Failed',
    status: 400
  },
  [ErrorCode.VALIDATION_REQUIRED_FIELD]: {
    type: 'https://api.okrplatform.com/errors/validation/required-field',
    title: 'Required Field Missing',
    status: 400
  },
  [ErrorCode.VALIDATION_INVALID_FORMAT]: {
    type: 'https://api.okrplatform.com/errors/validation/invalid-format',
    title: 'Invalid Format',
    status: 400
  },
  [ErrorCode.VALIDATION_INVALID_TYPE]: {
    type: 'https://api.okrplatform.com/errors/validation/invalid-type',
    title: 'Invalid Data Type',
    status: 400
  },
  [ErrorCode.VALIDATION_OUT_OF_RANGE]: {
    type: 'https://api.okrplatform.com/errors/validation/out-of-range',
    title: 'Value Out of Range',
    status: 400
  },
  [ErrorCode.VALIDATION_CONSTRAINT_VIOLATED]: {
    type: 'https://api.okrplatform.com/errors/validation/constraint-violated',
    title: 'Constraint Violated',
    status: 400
  },
  [ErrorCode.VALIDATION_WEIGHT_SUM_INVALID]: {
    type: 'https://api.okrplatform.com/errors/validation/weight-sum-invalid',
    title: 'Weight Sum Invalid',
    status: 400
  },
  [ErrorCode.VALIDATION_PASSWORD_WEAK]: {
    type: 'https://api.okrplatform.com/errors/validation/password-weak',
    title: 'Password Too Weak',
    status: 400
  },
  
  // Resource
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    type: 'https://api.okrplatform.com/errors/resource/not-found',
    title: 'Resource Not Found',
    status: 404
  },
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: {
    type: 'https://api.okrplatform.com/errors/resource/already-exists',
    title: 'Resource Already Exists',
    status: 409
  },
  [ErrorCode.RESOURCE_CONFLICT]: {
    type: 'https://api.okrplatform.com/errors/resource/conflict',
    title: 'Resource Conflict',
    status: 409
  },
  [ErrorCode.RESOURCE_GONE]: {
    type: 'https://api.okrplatform.com/errors/resource/gone',
    title: 'Resource No Longer Available',
    status: 410
  },
  
  // Business Logic
  [ErrorCode.BUSINESS_DEADLINE_MISSED]: {
    type: 'https://api.okrplatform.com/errors/business/deadline-missed',
    title: 'Deadline Missed',
    status: 422
  },
  [ErrorCode.BUSINESS_DEADLINE_PASSED]: {
    type: 'https://api.okrplatform.com/errors/business/deadline-passed',
    title: 'Deadline Has Passed',
    status: 422
  },
  [ErrorCode.BUSINESS_OPERATION_NOT_ALLOWED]: {
    type: 'https://api.okrplatform.com/errors/business/operation-not-allowed',
    title: 'Operation Not Allowed',
    status: 422
  },
  [ErrorCode.BUSINESS_STATUS_INVALID]: {
    type: 'https://api.okrplatform.com/errors/business/invalid-status',
    title: 'Invalid Status',
    status: 422
  },
  [ErrorCode.BUSINESS_INSUFFICIENT_BALANCE]: {
    type: 'https://api.okrplatform.com/errors/business/insufficient-balance',
    title: 'Insufficient Balance',
    status: 422
  },
  
  // Database
  [ErrorCode.DATABASE_ERROR]: {
    type: 'https://api.okrplatform.com/errors/database/error',
    title: 'Database Error',
    status: 500
  },
  [ErrorCode.DATABASE_CONNECTION_FAILED]: {
    type: 'https://api.okrplatform.com/errors/database/connection-failed',
    title: 'Database Connection Failed',
    status: 503
  },
  [ErrorCode.DATABASE_CONSTRAINT_VIOLATED]: {
    type: 'https://api.okrplatform.com/errors/database/constraint-violated',
    title: 'Database Constraint Violated',
    status: 409
  },
  [ErrorCode.DATABASE_TIMEOUT]: {
    type: 'https://api.okrplatform.com/errors/database/timeout',
    title: 'Database Timeout',
    status: 504
  },
  
  // Rate Limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    type: 'https://api.okrplatform.com/errors/rate-limit/exceeded',
    title: 'Rate Limit Exceeded',
    status: 429
  },
  [ErrorCode.RATE_LIMIT_TOO_MANY_REQUESTS]: {
    type: 'https://api.okrplatform.com/errors/rate-limit/too-many-requests',
    title: 'Too Many Requests',
    status: 429
  },
  
  // Server
  [ErrorCode.SERVER_INTERNAL_ERROR]: {
    type: 'https://api.okrplatform.com/errors/server/internal-error',
    title: 'Internal Server Error',
    status: 500
  },
  [ErrorCode.SERVER_SERVICE_UNAVAILABLE]: {
    type: 'https://api.okrplatform.com/errors/server/service-unavailable',
    title: 'Service Unavailable',
    status: 503
  },
  [ErrorCode.SERVER_TIMEOUT]: {
    type: 'https://api.okrplatform.com/errors/server/timeout',
    title: 'Server Timeout',
    status: 504
  },
  [ErrorCode.SERVER_NOT_IMPLEMENTED]: {
    type: 'https://api.okrplatform.com/errors/server/not-implemented',
    title: 'Not Implemented',
    status: 501
  },
  
  // External Services
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: {
    type: 'https://api.okrplatform.com/errors/external/service-error',
    title: 'External Service Error',
    status: 502
  },
  [ErrorCode.EXTERNAL_SERVICE_TIMEOUT]: {
    type: 'https://api.okrplatform.com/errors/external/timeout',
    title: 'External Service Timeout',
    status: 504
  },
  [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: {
    type: 'https://api.okrplatform.com/errors/external/unavailable',
    title: 'External Service Unavailable',
    status: 503
  },
};
