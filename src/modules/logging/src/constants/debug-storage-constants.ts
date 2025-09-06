/**
 * Debug Storage Constants
 * 
 * 集中管理Debug存储相关的常量，避免硬编码
 */

// Directory names
export const DEBUG_STORAGE_DIRS = {
  STARTUP: 'startup',
  PIPELINES: 'pipelines',
  REQUESTS: 'requests',
  RESPONSES: 'responses',
  DEBUG_LOGS: 'debug-logs'
} as const;

// File prefixes
export const DEBUG_FILE_PREFIXES = {
  STARTUP: 'startup',
  REQUEST: 'req',
  RESPONSE: 'res'
} as const;

// File extensions
export const DEBUG_FILE_EXTENSIONS = {
  JSON: '.json'
} as const;

// Metadata types
export const DEBUG_METADATA_TYPES = {
  STARTUP_OUTPUT: 'startup-module-output',
  PIPELINE_REQUEST: 'pipeline-request',
  PIPELINE_RESPONSE: 'pipeline-response'
} as const;

// Event names
export const DEBUG_EVENT_NAMES = {
  STARTUP_SAVED: 'startup-module-output-saved',
  REQUEST_SAVED: 'pipeline-request-saved',
  RESPONSE_SAVED: 'pipeline-response-saved'
} as const;

// Operations
export const DEBUG_OPERATIONS = {
  SAVE_STARTUP: 'saveStartupModuleOutput',
  SAVE_REQUEST: 'savePipelineRequest',
  SAVE_RESPONSE: 'savePipelineResponse'
} as const;

// Error messages
export const DEBUG_ERROR_MESSAGES = {
  SIZE_EXCEEDED: 'size exceeds limit',
  SAVE_FAILED: 'Failed to save',
  STARTUP: 'startup module output',
  REQUEST: 'pipeline request',
  RESPONSE: 'pipeline response'
} as const;

// Timezone
export const DEBUG_TIMEZONE = 'Asia/Shanghai' as const;

// Version
export const DEBUG_VERSION = '1.0' as const;