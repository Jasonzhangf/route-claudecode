/**
 * 错误消息常量
 * 
 * 集中管理所有错误消息，避免硬编码
 */

export const ERROR_MESSAGES = {
  COORDINATOR: {
    PROCESSING_FAILED: 'Failed to process error through unified flow',
    INITIALIZATION_FAILED: 'Failed to initialize error coordinator',
    CLEANUP_FAILED: 'Failed to cleanup expired logs',
    REPORT_GENERATION_FAILED: 'Failed to generate error summary report'
  },
  VALIDATION: {
    INVALID_INPUT: 'Invalid input provided',
    MISSING_REQUIRED_FIELD: 'Required field is missing',
    INVALID_FORMAT: 'Invalid data format'
  },
  NETWORK: {
    CONNECTION_FAILED: 'Failed to establish connection',
    TIMEOUT: 'Request timed out',
    DNS_ERROR: 'DNS resolution failed'
  },
  AUTH: {
    AUTHENTICATION_FAILED: 'Authentication failed',
    INVALID_CREDENTIALS: 'Invalid credentials provided',
    ACCESS_DENIED: 'Access denied'
  },
  INTERNAL: {
    UNEXPECTED_ERROR: 'An unexpected error occurred',
    SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
    INTERNAL_SERVER_ERROR: 'Internal server error'
  }
} as const;

export type ErrorMessages = typeof ERROR_MESSAGES;