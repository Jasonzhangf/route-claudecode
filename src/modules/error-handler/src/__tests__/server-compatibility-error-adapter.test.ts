/**
 * 服务器兼容性错误适配器测试
 */

import { ServerCompatibilityErrorAdapter } from '../server-compatibility-error-adapter';

describe('Server Compatibility Error Adapter Tests', () => {
  test('适配LM Studio错误', () => {
    const error = {
      code: 'ECONNREFUSED',
      message: 'Connection refused'
    };
    
    const response = ServerCompatibilityErrorAdapter.adaptServerError(error, 'lmstudio');
    expect(response.error.message).toBeDefined();
    expect(response.error.type).toBeDefined();
    expect(response.error.code).toBeDefined();
  });

  test('适配DeepSeek错误', () => {
    const error = {
      status: 401,
      response: {
        data: {
          error: {
            message: 'Invalid API key',
            code: 'invalid_api_key'
          }
        }
      }
    };
    
    const response = ServerCompatibilityErrorAdapter.adaptServerError(error, 'deepseek');
    expect(response.error.message).toBeDefined();
    expect(response.error.type).toBeDefined();
    expect(response.error.code).toBeDefined();
  });

  test('检查错误是否可重试', () => {
    const timeoutError = { code: 'ETIMEDOUT' };
    const connectionError = { code: 'ECONNREFUSED' };
    
    expect(typeof ServerCompatibilityErrorAdapter.isRetryableError(timeoutError)).toBe('boolean');
    expect(typeof ServerCompatibilityErrorAdapter.isRetryableError(connectionError)).toBe('boolean');
  });

  test('获取重试延迟', () => {
    const rateLimitError = { status: 429 };
    const serverError = { status: 500 };
    
    expect(typeof ServerCompatibilityErrorAdapter.getRetryDelay(rateLimitError)).toBe('number');
    expect(typeof ServerCompatibilityErrorAdapter.getRetryDelay(serverError)).toBe('number');
  });

  test('获取错误严重程度', () => {
    const authError = { status: 401 };
    const clientError = { status: 400 };
    const serverError = { status: 500 };
    
    expect(typeof ServerCompatibilityErrorAdapter.getErrorSeverity(authError)).toBe('string');
    expect(typeof ServerCompatibilityErrorAdapter.getErrorSeverity(clientError)).toBe('string');
    expect(typeof ServerCompatibilityErrorAdapter.getErrorSeverity(serverError)).toBe('string');
  });

  test('安全化错误数据', () => {
    const error = {
      name: 'Error',
      message: 'Test error',
      status: 500,
      code: 'INTERNAL_ERROR'
    };
    
    const sanitized = ServerCompatibilityErrorAdapter.sanitizeErrorData(error);
    expect(sanitized.name).toBe('Error');
    expect(sanitized.message).toBe('Test error');
    expect(sanitized.status).toBe(500);
    expect(sanitized.code).toBe('INTERNAL_ERROR');
  });
});