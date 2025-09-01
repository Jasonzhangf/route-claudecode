/**
 * Error Response Normalizer - 错误响应标准化器
 *
 * 将不同Provider的错误响应统一转换为OpenAI标准错误格式
 *
 * @author Jason Zhang
 */

import { OpenAIErrorResponse, DebugRecorder } from './enhanced-compatibility';

/**
 * 错误响应标准化器
 */
export class ErrorResponseNormalizer {
  private debugRecorder: DebugRecorder;

  constructor(debugRecorder: DebugRecorder) {
    this.debugRecorder = debugRecorder;
  }

  /**
   * 主要的错误标准化方法
   */
  normalizeError(error: any, serverType: string): OpenAIErrorResponse {
    const baseError: OpenAIErrorResponse = {
      error: {
        message: '',
        type: 'api_error',
        code: null,
        param: null,
      },
    };

    this.debugRecorder.record('error_normalization', {
      server_type: serverType,
      original_error_type: error?.constructor?.name,
      original_error_message: error?.message,
      original_error_status: error?.status || error?.statusCode,
      original_error_data: this.sanitizeErrorData(error),
    });

    switch (serverType) {
      case 'lmstudio':
        return this.normalizeLMStudioError(error, baseError);
      case 'deepseek':
        return this.normalizeDeepSeekError(error, baseError);
      case 'ollama':
        return this.normalizeOllamaError(error, baseError);
      default:
        return this.normalizeGenericError(error, baseError);
    }
  }

  /**
   * LM Studio错误标准化
   */
  private normalizeLMStudioError(error: any, baseError: OpenAIErrorResponse): OpenAIErrorResponse {
    this.debugRecorder.record('lmstudio_error_normalization', {
      error_message: error.message,
      error_status: error.status,
      has_response_data: !!error.response,
    });

    // LM Studio连接错误
    if (error.code === 'ECONNREFUSED' || error.message?.includes('connect ECONNREFUSED')) {
      baseError.error.message =
        'Unable to connect to LM Studio server. Please ensure LM Studio is running and accessible.';
      baseError.error.type = 'api_error';
      baseError.error.code = 'connection_error';
      return baseError;
    }

    // 模型未加载错误
    if (error.message?.includes('model not loaded') || error.message?.includes('no model loaded')) {
      baseError.error.message = 'No model is currently loaded in LM Studio. Please load a model first.';
      baseError.error.type = 'invalid_request_error';
      baseError.error.code = 'model_not_loaded';
      return baseError;
    }

    // 上下文长度超限
    if (error.message?.includes('context length') || error.message?.includes('maximum context')) {
      baseError.error.message = 'Request exceeds maximum context length for the current model.';
      baseError.error.type = 'invalid_request_error';
      baseError.error.code = 'context_length_exceeded';
      return baseError;
    }

    // 内存不足
    if (error.message?.includes('out of memory') || error.message?.includes('memory')) {
      baseError.error.message = 'Insufficient memory available for processing this request.';
      baseError.error.type = 'api_error';
      baseError.error.code = 'insufficient_memory';
      return baseError;
    }

    // 请求超时
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      baseError.error.message = 'Request timed out. The model may be taking too long to respond.';
      baseError.error.type = 'api_error';
      baseError.error.code = 'timeout';
      return baseError;
    }

    // HTTP状态码错误
    if (error.status) {
      switch (error.status) {
        case 400:
          baseError.error.message = 'Invalid request format or parameters.';
          baseError.error.type = 'invalid_request_error';
          baseError.error.code = 'invalid_request';
          break;
        case 404:
          baseError.error.message = 'LM Studio endpoint not found. Please check the server configuration.';
          baseError.error.type = 'invalid_request_error';
          baseError.error.code = 'not_found';
          break;
        case 500:
          baseError.error.message = `Internal server error in LM Studio (HTTP ${error.status}).`;
          baseError.error.type = 'api_error';
          baseError.error.code = 'internal_server_error';
          break;
        default:
          baseError.error.message = `LM Studio server error (HTTP ${error.status})`;
          baseError.error.type = 'api_error';
          baseError.error.code = `http_${error.status}`;
      }
    } else {
      // 通用LM Studio错误
      baseError.error.message = error.message || 'Unknown LM Studio server error';
      baseError.error.type = 'api_error';
      baseError.error.code = 'lmstudio_error';
    }

    return baseError;
  }

  /**
   * DeepSeek错误标准化
   */
  private normalizeDeepSeekError(error: any, baseError: OpenAIErrorResponse): OpenAIErrorResponse {
    this.debugRecorder.record('deepseek_error_normalization', {
      error_status: error.status,
      error_data: error.response?.data,
      error_message: error.message,
    });

    // DeepSeek API状态码错误
    if (error.status) {
      switch (error.status) {
        case 400:
          baseError.error.message = error.response?.data?.error?.message || 'Invalid request parameters.';
          baseError.error.type = 'invalid_request_error';
          baseError.error.code = error.response?.data?.error?.code || 'invalid_request';
          baseError.error.param = error.response?.data?.error?.param || null;
          break;

        case 401:
          baseError.error.message = 'Invalid or missing API key for DeepSeek.';
          baseError.error.type = 'authentication_error';
          baseError.error.code = 'invalid_api_key';
          break;

        case 403:
          baseError.error.message = 'Access forbidden. Please check your API key permissions.';
          baseError.error.type = 'authentication_error';
          baseError.error.code = 'forbidden';
          break;

        case 429:
          const retryAfter = error.response?.headers?.['retry-after'];
          baseError.error.message = retryAfter
            ? `Rate limit exceeded. Retry after ${retryAfter} seconds.`
            : 'Rate limit exceeded. Please reduce request frequency.';
          baseError.error.type = 'rate_limit_error';
          baseError.error.code = 'rate_limit_exceeded';
          break;

        case 500:
          baseError.error.message = 'DeepSeek internal server error.';
          baseError.error.type = 'api_error';
          baseError.error.code = 'internal_server_error';
          break;

        case 502:
          baseError.error.message = 'DeepSeek service temporarily unavailable.';
          baseError.error.type = 'api_error';
          baseError.error.code = 'service_unavailable';
          break;

        case 503:
          baseError.error.message = 'DeepSeek service overloaded. Please try again later.';
          baseError.error.type = 'api_error';
          baseError.error.code = 'service_overloaded';
          break;

        default:
          baseError.error.message = error.message || `DeepSeek API error (HTTP ${error.status})`;
          baseError.error.type = 'api_error';
          baseError.error.code = `http_${error.status}`;
      }
    } else if (error.code === 'ECONNREFUSED') {
      baseError.error.message = 'Unable to connect to DeepSeek API. Please check your network connection.';
      baseError.error.type = 'api_error';
      baseError.error.code = 'connection_error';
    } else if (error.code === 'ETIMEDOUT') {
      baseError.error.message = 'DeepSeek API request timed out.';
      baseError.error.type = 'api_error';
      baseError.error.code = 'timeout';
    } else {
      baseError.error.message = error.message || 'Unknown DeepSeek API error';
      baseError.error.type = 'api_error';
      baseError.error.code = 'deepseek_error';
    }

    return baseError;
  }

  /**
   * Ollama错误标准化
   */
  private normalizeOllamaError(error: any, baseError: OpenAIErrorResponse): OpenAIErrorResponse {
    this.debugRecorder.record('ollama_error_normalization', {
      error_status: error.status,
      error_message: error.message,
      ollama_response: error.response?.data,
    });

    // Ollama服务器连接错误
    if (error.code === 'ECONNREFUSED') {
      baseError.error.message = 'Unable to connect to Ollama server. Please ensure Ollama is running.';
      baseError.error.type = 'api_error';
      baseError.error.code = 'connection_error';
      return baseError;
    }

    // Ollama模型错误 - 只处理没有HTTP状态码的情况
    if (!error.status && error.message?.includes('model') && error.message?.includes('not found')) {
      baseError.error.message = 'Model not found in Ollama. Please pull the model first.';
      baseError.error.type = 'invalid_request_error';
      baseError.error.code = 'model_not_found';
      return baseError;
    }

    // Ollama HTTP状态码
    if (error.status) {
      switch (error.status) {
        case 400:
          baseError.error.message = error.response?.data?.error || 'Invalid request to Ollama server.';
          baseError.error.type = 'invalid_request_error';
          baseError.error.code = 'invalid_request';
          break;

        case 404:
          if (error.message?.includes('model') && error.message?.includes('"') && error.message?.includes('not found')) {
            baseError.error.message = 'Model not found in Ollama. Please pull the model first.';
            baseError.error.type = 'invalid_request_error';
            baseError.error.code = 'model_not_found';
            return baseError;
          } else if (error.message?.includes('model')) {
            baseError.error.message = 'Model not available in Ollama.';
            baseError.error.type = 'invalid_request_error';
            baseError.error.code = 'model_not_found';
          } else {
            baseError.error.message = 'Ollama endpoint not found.';
            baseError.error.type = 'invalid_request_error';
            baseError.error.code = 'not_found';
          }
          break;

        case 500:
          baseError.error.message = 'Ollama internal server error.';
          baseError.error.type = 'api_error';
          baseError.error.code = 'internal_server_error';
          break;

        default:
          baseError.error.message = error.message || `Ollama server error (HTTP ${error.status})`;
          baseError.error.type = 'api_error';
          baseError.error.code = `http_${error.status}`;
      }
    } else {
      baseError.error.message = error.message || 'Unknown Ollama server error';
      baseError.error.type = 'api_error';
      baseError.error.code = 'ollama_error';
    }

    return baseError;
  }

  /**
   * 通用错误标准化
   */
  private normalizeGenericError(error: any, baseError: OpenAIErrorResponse): OpenAIErrorResponse {
    this.debugRecorder.record('generic_error_normalization', {
      error_type: typeof error,
      error_constructor: error?.constructor?.name,
      has_status: !!error?.status,
      has_code: !!error?.code,
      has_message: !!error?.message,
    });

    // 网络连接错误
    if (error?.code === 'ECONNREFUSED') {
      baseError.error.message = 'Connection refused. Please check if the server is running.';
      baseError.error.type = 'api_error';
      baseError.error.code = 'connrefused_error';
      return baseError;
    }

    if (error?.code === 'ETIMEDOUT') {
      baseError.error.message = 'Request timed out.';
      baseError.error.type = 'api_error';
      baseError.error.code = 'timedout_error';
      return baseError;
    }

    if (error?.code === 'ENOTFOUND') {
      baseError.error.message = 'Server not found. Please check the server address.';
      baseError.error.type = 'api_error';
      baseError.error.code = 'notfound_error';
      return baseError;
    }

    // HTTP状态码通用处理
    if (error?.status) {
      switch (error.status) {
        case 400:
          baseError.error.message = 'Bad request. Please check your request parameters.';
          baseError.error.type = 'invalid_request_error';
          baseError.error.code = 'bad_request';
          break;

        case 401:
          baseError.error.message = 'Authentication failed. Please check your credentials.';
          baseError.error.type = 'authentication_error';
          baseError.error.code = 'authentication_failed';
          break;

        case 403:
          baseError.error.message = 'Access forbidden.';
          baseError.error.type = 'authentication_error';
          baseError.error.code = 'forbidden';
          break;

        case 404:
          baseError.error.message = 'Resource not found.';
          baseError.error.type = 'invalid_request_error';
          baseError.error.code = 'not_found';
          break;

        case 429:
          baseError.error.message = 'Rate limit exceeded.';
          baseError.error.type = 'rate_limit_error';
          baseError.error.code = 'rate_limit_exceeded';
          break;

        case 500:
          baseError.error.message = 'Internal server error.';
          baseError.error.type = 'api_error';
          baseError.error.code = 'internal_server_error';
          break;

        case 502:
          baseError.error.message = 'Bad gateway.';
          baseError.error.type = 'api_error';
          baseError.error.code = 'bad_gateway';
          break;

        case 503:
          baseError.error.message = 'Service unavailable.';
          baseError.error.type = 'api_error';
          baseError.error.code = 'service_unavailable';
          break;

        default:
          baseError.error.message = error.message || `Server error (HTTP ${error.status})`;
          baseError.error.type = 'api_error';
          baseError.error.code = `http_${error.status}`;
      }
    } else {
      // 无状态码的通用错误处理
      baseError.error.message = error?.message || 'Unknown error occurred';
      baseError.error.type = 'api_error';
      baseError.error.code = 'unknown_error';
    }

    return baseError;
  }

  /**
   * 检查错误是否需要特殊处理
   */
  isRetryableError(error: any): boolean {
    // 网络错误通常可重试
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      return true;
    }

    // HTTP 5xx错误通常可重试
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // 429 (rate limit) 可重试，但需要延迟
    if (error.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * 获取建议的重试延迟（毫秒）
   */
  getRetryDelay(error: any): number {
    // 从响应头获取重试延迟
    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter) {
      const delay = parseInt(retryAfter, 10);
      return !isNaN(delay) ? delay * 1000 : 5000; // 转换为毫秒，默认5秒
    }

    // 根据错误类型设置默认延迟
    switch (error.status) {
      case 429: // Rate limit
        return 10000; // 10秒
      case 502:
      case 503:
        return 5000; // 5秒
      case 500:
        return 2000; // 2秒
      default:
        return 1000; // 1秒
    }
  }

  /**
   * 提取错误的严重程度
   */
  getErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    // 认证错误 - 高严重程度
    if (error.status === 401 || error.status === 403) {
      return 'high';
    }

    // 客户端错误 - 中等严重程度
    if (error.status >= 400 && error.status < 500) {
      return 'medium';
    }

    // 服务器错误 - 高严重程度
    if (error.status >= 500) {
      return 'high';
    }

    // 网络错误 - 中等到高严重程度
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return 'high';
    }

    if (error.code === 'ETIMEDOUT') {
      return 'medium';
    }

    // 未知错误 - 中等严重程度
    return 'medium';
  }

  /**
   * 安全化错误数据，移除敏感信息
   */
  private sanitizeErrorData(error: any): any {
    const sanitized: any = {
      name: error?.name,
      message: error?.message,
      status: error?.status || error?.statusCode,
      code: error?.code,
    };

    // 移除可能包含敏感信息的字段
    if (error?.response?.data && typeof error.response.data === 'object') {
      sanitized.response_data = {
        error: error.response.data.error?.message || error.response.data.message,
      };
    }

    if (error?.config) {
      sanitized.config = {
        method: error.config.method,
        url: error.config.url?.replace(/[?&]key=[^&]+/g, '?key=***'), // 隐藏API key
        timeout: error.config.timeout,
      };
    }

    return sanitized;
  }
}
