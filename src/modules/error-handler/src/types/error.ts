/**
 * Error Types for Error Handler Module
 * Re-export from main types module and add specific error classes
 */

// Re-export from types module
export { 
  RCCError, 
  RCCErrorCode as ERROR_CODES, 
  RCCErrorCode,
  ErrorContext 
} from '../../../../types/index';

// Enhanced error classes for different error types
export class ValidationError extends Error {
  public readonly module: string;
  public readonly context: Record<string, any>;

  constructor(message: string, module: string = 'UNKNOWN', context: Record<string, any> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.module = module;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

export class TransformError extends Error {
  public readonly module: string;
  public readonly context: Record<string, any>;

  constructor(message: string, module: string = 'UNKNOWN', context: Record<string, any> = {}) {
    super(message);
    this.name = 'TransformError';
    this.module = module;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TransformError);
    }
  }
}

export class AuthError extends Error {
  public readonly module: string;
  public readonly context: Record<string, any>;

  constructor(message: string, module: string = 'UNKNOWN', context: Record<string, any> = {}) {
    super(message);
    this.name = 'AuthError';
    this.module = module;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }
}

// Error severity levels - use enum from interfaces/core instead of type alias
// export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Constants for backward compatibility
export const PIPELINE_INIT_FAILED = 'PIPELINE_INIT_FAILED';