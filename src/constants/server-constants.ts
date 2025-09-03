/**
 * 服务器管理常量定义
 * 
 * 包含所有服务器管理相关的常量值，避免硬编码
 * 
 * @author RCC v4.0
 */

export const DEFAULT_SERVER_CONFIG = {
  PORT: 5506,
  HOST: 'localhost',
  TIMEOUT: 30000,
  MAX_CONNECTIONS: 1000
} as const;

export const SERVER_STATUS = {
  INITIALIZED: 'initialized',
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error'
} as const;

export const HEALTH_CHECK_CONFIG = {
  INTERVAL_MS: 30000,
  TIMEOUT_MS: 5000,
  MAX_RETRIES: 3
} as const;

export const METRICS_CONFIG = {
  MEMORY_UNIT_MB: 1024 * 1024,
  MOVING_AVERAGE_WINDOW: 100,
  UPDATE_INTERVAL_MS: 1000
} as const;

export const CACHE_CONFIG = {
  ROUTING_TABLE_TTL_MS: 300000, // 5 minutes
  METRICS_TTL_MS: 60000, // 1 minute
  HEALTH_STATUS_TTL_MS: 10000 // 10 seconds
} as const;

export const SERVER_LIFECYCLE_DELAYS = {
  SHUTDOWN_GRACE_PERIOD_MS: 1000,
  RESTART_DELAY_MS: 1000,
  INITIALIZATION_TIMEOUT_MS: 30000
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REQUEST_TIMEOUT: 408,
  RATE_LIMIT: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

export const SERVER_DEFAULTS = {
  HTTP: {
    ERROR_STATUS_CODE: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    UNAUTHORIZED_STATUS_CODE: HTTP_STATUS_CODES.UNAUTHORIZED,
    FORBIDDEN_STATUS_CODE: HTTP_STATUS_CODES.FORBIDDEN,
    NOT_FOUND_STATUS_CODE: HTTP_STATUS_CODES.NOT_FOUND,
    TIMEOUT_STATUS_CODE: HTTP_STATUS_CODES.REQUEST_TIMEOUT,
    RATE_LIMIT_STATUS_CODE: HTTP_STATUS_CODES.RATE_LIMIT,
    BAD_GATEWAY_STATUS_CODE: HTTP_STATUS_CODES.BAD_GATEWAY,
    SERVICE_UNAVAILABLE_STATUS_CODE: HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
    BAD_REQUEST_STATUS_CODE: HTTP_STATUS_CODES.BAD_REQUEST,
    MAX_RETRIES: 4,
    DEFAULT_TIMEOUT: 30000
  },
  COORDINATION: {
    CENTER_PORT: 0, // 动态分配
    CENTER_ENABLED: true,
    LOG_DETAILED_ERRORS: true
  }
} as const;

export const ERROR_MESSAGES = {
  SERVER_NOT_INITIALIZED: 'Server is not initialized',
  SERVER_ALREADY_RUNNING: 'Server is already running',
  SERVER_NOT_RUNNING: 'Server is not running',
  ROUTER_NOT_INITIALIZED: 'Router is not initialized',
  ROUTING_TABLE_EMPTY: 'Routing table is not loaded or empty',
  INVALID_ROUTING_TABLE: 'Routing table validation failed',
  ROUTER_CREATION_FAILED: 'Failed to create PipelineRouter from routing table',
  SERVER_HEALTH_CHECK_FAILED: 'Server health check failed',
  INTEGRATION_FAILED: 'Server or router not available for integration'
} as const;

export const LOG_MESSAGES = {
  SERVER_INIT_START: '开始初始化Pipeline服务器',
  SERVER_INIT_SUCCESS: 'Pipeline服务器初始化成功',
  SERVER_INIT_FAILED: 'Pipeline服务器初始化失败',
  SERVER_START_SUCCESS: 'Pipeline服务器启动成功',
  SERVER_START_FAILED: 'Pipeline服务器启动失败',
  SERVER_STOP_SUCCESS: 'Pipeline服务器已停止',
  SERVER_STOP_FAILED: 'Pipeline服务器停止失败',
  SERVER_RESTART_SUCCESS: 'Pipeline服务器重启成功',
  SERVER_RESTART_FAILED: 'Pipeline服务器重启失败',
  ROUTING_TABLE_RELOAD_SUCCESS: '路由表重新加载成功',
  ROUTING_TABLE_RELOAD_FAILED: '路由表重新加载失败',
  RESOURCE_CLEANUP_START: '清理Pipeline服务器资源',
  RESOURCE_CLEANUP_SUCCESS: 'Pipeline服务器资源清理完成',
  RESOURCE_CLEANUP_ERROR: '资源清理过程中出现错误'
} as const;

export const STEP_DESCRIPTIONS = {
  GENERATE_ROUTING_TABLE: 'Step 1: 生成路由表',
  INITIALIZE_ROUTER: 'Step 2: 初始化Pipeline路由器',
  CREATE_SERVER_INSTANCE: 'Step 3: 创建服务器实例',
  CONFIGURE_INTEGRATION: 'Step 4: 配置服务器路由器集成'
} as const;

export const SERVER_METHODS = {
  START: 'start',
  STOP: 'stop',
  HEALTH_CHECK: 'healthCheck',
  SET_ROUTER: 'setRouter',
  ADD_MIDDLEWARE: 'addMiddleware',
  CLEANUP: 'cleanup',
  GET_STATS: 'getStats'
} as const;

export const MIDDLEWARE_TYPES = {
  REQUEST_PROCESSOR: 'request-processor',
  ERROR_HANDLER: 'error-handler',
  METRICS_COLLECTOR: 'metrics-collector',
  HEALTH_CHECKER: 'health-checker'
} as const;

export const RESPONSE_FIELDS = {
  SUCCESS: 'success',
  ERROR: 'error',
  MESSAGE: 'message',
  DATA: 'data',
  TIMESTAMP: 'timestamp'
} as const;