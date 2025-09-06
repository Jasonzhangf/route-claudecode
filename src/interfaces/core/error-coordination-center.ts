/**
 * Error Coordination Center Interface
 * Re-exports error types and coordination interfaces for global access
 */

// Re-export from modules for backward compatibility
export * from '../../modules/interfaces/core/error-coordination-center';
export * from '../../modules/types/src';

// Additional legacy compatibility exports
export type { ErrorContext } from '../../modules/types/src';