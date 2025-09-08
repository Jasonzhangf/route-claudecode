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
    ACCESS_DENIED: 'Access denied',
    MODULE_NOT_AVAILABLE: 'Auth module not available',
    REFRESH_OPERATION_FAILED: 'Refresh operation failed',
    API_VALIDATION_FAILED_AFTER_REFRESH: 'API validation failed after refresh',
    AUTH_REFRESH_FAILED: 'Auth refresh failed, initiating recreate workflow',
    API_VALIDATION_FAILED: 'Auth file API validation failed',
    FILE_EXPIRY_CHECK_FAILED: 'Auth file expiry check failed',
    ASYNC_REFRESH_FAILED: 'Async auth refresh failed',
    REFRESH_INITIATION_FAILED: 'Auth file refresh initiation failed',
    QWEN_REFRESH_FAILED: 'Qwen auth refresh failed',
    ASYNC_WORKFLOW_FAILED: 'Async auth refresh workflow failed',
    FILE_RECREATION_FAILED: 'Auth file recreation failed',
    FILE_REBUILD_FAILED: 'Auth file rebuild failed',
    VALIDITY_TEST_FAILED: 'Auth file validity test failed',
    QWEN_VALIDATION_FAILED: 'Qwen auth file validation failed',
    DEVICE_FLOW_AUTH_FAILED: 'Device Flow authentication failed',
    FILE_NOT_FOUND: 'Auth file not found, considered expired',
    FILE_PARSE_FAILED: 'Failed to parse auth file content',
    NO_EXPIRES_FIELD: 'No expires_at field found, using file age',
    REFRESH_SUCCESSFUL: 'Auth refresh successful',
    MISSING_AUTH_FILE: 'Missing auth file'
  },
  INTERNAL: {
    UNEXPECTED_ERROR: 'An unexpected error occurred',
    SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
    INTERNAL_SERVER_ERROR: 'Internal server error'
  }
} as const;

export type ErrorMessages = typeof ERROR_MESSAGES;