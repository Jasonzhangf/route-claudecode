/**
 * API响应类型定义
 * 
 * 定义Internal API系统的标准响应格式和错误类型
 * 支持泛型以确保类型安全
 * 
 * @author RCC v4.0 API Refactoring
 */

/**
 * 标准API错误信息
 */
export interface APIError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 错误详细信息 */
  details?: any;
  /** 错误堆栈（仅调试模式） */
  stack?: string;
}

/**
 * API响应元数据
 */
export interface APIMetadata {
  /** 请求ID */
  requestId: string;
  /** 请求时间戳 */
  timestamp: number;
  /** 处理时间（毫秒） */
  processingTime: number;
  /** API版本 */
  apiVersion: string;
  /** 服务器信息 */
  server?: {
    node: string;
    instance: string;
  };
}

/**
 * 标准API响应格式
 * 
 * @template T 响应数据类型
 */
export interface APIResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  /** 响应数据（成功时存在） */
  data?: T;
  /** 错误信息（失败时存在） */
  error?: APIError;
  /** 响应元数据 */
  metadata: APIMetadata;
}

/**
 * 分页响应数据
 * 
 * @template T 数据项类型
 */
export interface PaginatedData<T> {
  /** 数据项列表 */
  items: T[];
  /** 总数量 */
  total: number;
  /** 页码（从1开始） */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * 流式响应数据
 * 
 * @template T 流数据类型
 */
export interface StreamResponse<T> {
  /** 流ID */
  streamId: string;
  /** 流数据块 */
  chunks: T[];
  /** 流是否完成 */
  completed: boolean;
  /** 下一个流令牌 */
  nextToken?: string;
}

/**
 * 批量操作响应
 * 
 * @template T 操作结果类型
 */
export interface BatchResponse<T> {
  /** 操作结果列表 */
  results: Array<{
    id: string;
    success: boolean;
    data?: T;
    error?: APIError;
  }>;
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failureCount: number;
  /** 总数量 */
  totalCount: number;
}

/**
 * API状态响应
 */
export interface APIStatusResponse {
  /** 服务状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 服务版本 */
  version: string;
  /** 启动时间 */
  uptime: string;
  /** 健康检查结果 */
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    responseTime: number;
    details?: any;
  }>;
}

/**
 * API错误代码枚举
 */
export enum APIErrorCode {
  // 客户端错误 (4xx)
  BAD_REQUEST = 'bad_request',
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  NOT_FOUND = 'not_found',
  METHOD_NOT_ALLOWED = 'method_not_allowed',
  CONFLICT = 'conflict',
  VALIDATION_ERROR = 'validation_error',
  RATE_LIMITED = 'rate_limited',
  
  // 服务器错误 (5xx)
  INTERNAL_ERROR = 'internal_server_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  GATEWAY_TIMEOUT = 'gateway_timeout',
  INSUFFICIENT_RESOURCES = 'insufficient_resources',
  
  // 业务错误
  PIPELINE_NOT_FOUND = 'pipeline_not_found',
  PROVIDER_NOT_AVAILABLE = 'provider_not_available',
  CONFIGURATION_ERROR = 'configuration_error',
  TRANSFORMATION_ERROR = 'transformation_error',
  ROUTING_ERROR = 'routing_error'
}

/**
 * HTTP状态码映射
 */
export const ERROR_CODE_TO_HTTP_STATUS: Record<APIErrorCode, number> = {
  [APIErrorCode.BAD_REQUEST]: 400,
  [APIErrorCode.UNAUTHORIZED]: 401,
  [APIErrorCode.FORBIDDEN]: 403,
  [APIErrorCode.NOT_FOUND]: 404,
  [APIErrorCode.METHOD_NOT_ALLOWED]: 405,
  [APIErrorCode.CONFLICT]: 409,
  [APIErrorCode.VALIDATION_ERROR]: 422,
  [APIErrorCode.RATE_LIMITED]: 429,
  
  [APIErrorCode.INTERNAL_ERROR]: 500,
  [APIErrorCode.SERVICE_UNAVAILABLE]: 503,
  [APIErrorCode.GATEWAY_TIMEOUT]: 504,
  [APIErrorCode.INSUFFICIENT_RESOURCES]: 507,
  
  [APIErrorCode.PIPELINE_NOT_FOUND]: 404,
  [APIErrorCode.PROVIDER_NOT_AVAILABLE]: 503,
  [APIErrorCode.CONFIGURATION_ERROR]: 422,
  [APIErrorCode.TRANSFORMATION_ERROR]: 500,
  [APIErrorCode.ROUTING_ERROR]: 500
};

/**
 * 创建成功响应
 * 
 * @template T 数据类型
 * @param data 响应数据
 * @param metadata 元数据
 * @returns API响应
 */
export function createSuccessResponse<T>(
  data: T,
  metadata: Partial<APIMetadata> = {}
): APIResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      requestId: metadata.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: metadata.timestamp || Date.now(),
      processingTime: metadata.processingTime || 0,
      apiVersion: metadata.apiVersion || '1.0.0',
      ...metadata
    }
  };
}

/**
 * 创建错误响应
 * 
 * @param error 错误信息
 * @param metadata 元数据
 * @returns API响应
 */
export function createErrorResponse(
  error: APIError | string,
  metadata: Partial<APIMetadata> = {}
): APIResponse<never> {
  const errorObj: APIError = typeof error === 'string' 
    ? { code: APIErrorCode.INTERNAL_ERROR, message: error }
    : error;
    
  return {
    success: false,
    error: errorObj,
    metadata: {
      requestId: metadata.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: metadata.timestamp || Date.now(),
      processingTime: metadata.processingTime || 0,
      apiVersion: metadata.apiVersion || '1.0.0',
      ...metadata
    }
  };
}

/**
 * 检查是否为成功响应
 * 
 * @param response API响应
 * @returns 是否成功
 */
export function isSuccessResponse<T>(response: APIResponse<T>): response is APIResponse<T> & { data: T } {
  return response.success && response.data !== undefined;
}

/**
 * 检查是否为错误响应
 * 
 * @param response API响应
 * @returns 是否错误
 */
export function isErrorResponse<T>(response: APIResponse<T>): response is APIResponse<T> & { error: APIError } {
  return !response.success && response.error !== undefined;
}