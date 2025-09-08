/**
 * Error Types - Global Re-export
 * Re-exports error types from modules for backward compatibility
 */

// Re-export main error types from modules/types/src for global access
export { 
  RCCError, 
  RCCErrorCode, 
  ErrorContext 
} from '../modules/types/src/index';

// Re-export specific error handler classes only (avoid duplicates)
export { 
  ValidationError, 
  TransformError, 
  AuthError,
  PIPELINE_INIT_FAILED
} from '../modules/error-handler/src/types/error';