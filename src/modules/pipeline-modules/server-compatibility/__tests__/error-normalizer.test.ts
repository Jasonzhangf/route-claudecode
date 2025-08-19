/**
 * Error Response Normalizer - 单元测试
 *
 * 验证错误响应标准化器的功能
 *
 * @author Jason Zhang
 */

import { ErrorResponseNormalizer } from '../error-response-normalizer';
import { DebugRecorder, OpenAIErrorResponse } from '../enhanced-compatibility';

describe('ErrorResponseNormalizer', () => {
  let normalizer: ErrorResponseNormalizer;
  let mockDebugRecorder: DebugRecorder;

  beforeEach(() => {
    mockDebugRecorder = {
      record: jest.fn(),
      recordInput: jest.fn(),
      recordOutput: jest.fn(),
      recordError: jest.fn(),
    };

    normalizer = new ErrorResponseNormalizer(mockDebugRecorder);
  });

  describe('LM Studio Error Normalization', () => {
    test('should normalize connection refused errors', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:1234',
      };

      const result = normalizer.normalizeError(error, 'lmstudio');

      expect(result.error.message).toBe(
        'Unable to connect to LM Studio server. Please ensure LM Studio is running and accessible.'
      );
      expect(result.error.type).toBe('api_error');
      expect(result.error.code).toBe('connection_error');
    });

    test('should normalize model not loaded errors', () => {
      const error = {
        message: 'model not loaded',
        status: 400,
      };

      const result = normalizer.normalizeError(error, 'lmstudio');

      expect(result.error.message).toBe('No model is currently loaded in LM Studio. Please load a model first.');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.code).toBe('model_not_loaded');
    });

    test('should normalize context length exceeded errors', () => {
      const error = {
        message: 'Request exceeds maximum context length for model',
        status: 400,
      };

      const result = normalizer.normalizeError(error, 'lmstudio');

      expect(result.error.message).toBe('Request exceeds maximum context length for the current model.');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.code).toBe('context_length_exceeded');
    });

    test('should normalize memory errors', () => {
      const error = {
        message: 'out of memory during inference',
      };

      const result = normalizer.normalizeError(error, 'lmstudio');

      expect(result.error.message).toBe('Insufficient memory available for processing this request.');
      expect(result.error.type).toBe('api_error');
      expect(result.error.code).toBe('insufficient_memory');
    });

    test('should normalize timeout errors', () => {
      const error = {
        code: 'ETIMEDOUT',
        message: 'Request timeout',
      };

      const result = normalizer.normalizeError(error, 'lmstudio');

      expect(result.error.message).toBe('Request timed out. The model may be taking too long to respond.');
      expect(result.error.type).toBe('api_error');
      expect(result.error.code).toBe('timeout');
    });

    test('should normalize HTTP status errors', () => {
      const testCases = [
        { status: 400, expectedType: 'invalid_request_error', expectedCode: 'invalid_request' },
        { status: 404, expectedType: 'invalid_request_error', expectedCode: 'not_found' },
        { status: 500, expectedType: 'api_error', expectedCode: 'internal_server_error' },
      ];

      testCases.forEach(({ status, expectedType, expectedCode }) => {
        const error = { status, message: `HTTP ${status} error` };
        const result = normalizer.normalizeError(error, 'lmstudio');

        expect(result.error.type).toBe(expectedType);
        expect(result.error.code).toBe(expectedCode);
      });
    });
  });

  describe('DeepSeek Error Normalization', () => {
    test('should normalize authentication errors', () => {
      const error = {
        status: 401,
        message: 'Unauthorized',
      };

      const result = normalizer.normalizeError(error, 'deepseek');

      expect(result.error.message).toBe('Invalid or missing API key for DeepSeek.');
      expect(result.error.type).toBe('authentication_error');
      expect(result.error.code).toBe('invalid_api_key');
    });

    test('should normalize rate limit errors with retry-after header', () => {
      const error = {
        status: 429,
        message: 'Too Many Requests',
        response: {
          headers: {
            'retry-after': '60',
          },
        },
      };

      const result = normalizer.normalizeError(error, 'deepseek');

      expect(result.error.message).toBe('Rate limit exceeded. Retry after 60 seconds.');
      expect(result.error.type).toBe('rate_limit_error');
      expect(result.error.code).toBe('rate_limit_exceeded');
    });

    test('should normalize rate limit errors without retry-after header', () => {
      const error = {
        status: 429,
        message: 'Too Many Requests',
      };

      const result = normalizer.normalizeError(error, 'deepseek');

      expect(result.error.message).toBe('Rate limit exceeded. Please reduce request frequency.');
      expect(result.error.type).toBe('rate_limit_error');
      expect(result.error.code).toBe('rate_limit_exceeded');
    });

    test('should normalize detailed API errors', () => {
      const error = {
        status: 400,
        response: {
          data: {
            error: {
              message: 'Invalid parameter: temperature must be between 0.01 and 2.0',
              code: 'invalid_parameter',
              param: 'temperature',
            },
          },
        },
      };

      const result = normalizer.normalizeError(error, 'deepseek');

      expect(result.error.message).toBe('Invalid parameter: temperature must be between 0.01 and 2.0');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.code).toBe('invalid_parameter');
      expect(result.error.param).toBe('temperature');
    });

    test('should normalize service unavailable errors', () => {
      const testCases = [
        {
          status: 502,
          expectedMessage: 'DeepSeek service temporarily unavailable.',
          expectedCode: 'service_unavailable',
        },
        {
          status: 503,
          expectedMessage: 'DeepSeek service overloaded. Please try again later.',
          expectedCode: 'service_overloaded',
        },
      ];

      testCases.forEach(({ status, expectedMessage, expectedCode }) => {
        const error = { status, message: `HTTP ${status}` };
        const result = normalizer.normalizeError(error, 'deepseek');

        expect(result.error.message).toBe(expectedMessage);
        expect(result.error.code).toBe(expectedCode);
      });
    });
  });

  describe('Ollama Error Normalization', () => {
    test('should normalize model not found errors', () => {
      const error = {
        message: 'model "nonexistent-model" not found',
        status: 404,
      };

      const result = normalizer.normalizeError(error, 'ollama');

      expect(result.error.message).toBe('Model not found in Ollama. Please pull the model first.');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.code).toBe('model_not_found');
    });

    test('should normalize connection errors', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:11434',
      };

      const result = normalizer.normalizeError(error, 'ollama');

      expect(result.error.message).toBe('Unable to connect to Ollama server. Please ensure Ollama is running.');
      expect(result.error.type).toBe('api_error');
      expect(result.error.code).toBe('connection_error');
    });

    test('should normalize Ollama-specific response errors', () => {
      const error = {
        status: 400,
        response: {
          data: {
            error: 'Invalid request format',
          },
        },
      };

      const result = normalizer.normalizeError(error, 'ollama');

      expect(result.error.message).toBe('Invalid request format');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.code).toBe('invalid_request');
    });

    test('should handle various HTTP status codes', () => {
      const testCases = [
        { status: 404, withModel: true, expectedMessage: 'Model not available in Ollama.' },
        { status: 404, withModel: false, expectedMessage: 'Ollama endpoint not found.' },
        { status: 500, expectedMessage: 'Ollama internal server error.' },
      ];

      testCases.forEach(({ status, withModel, expectedMessage }) => {
        const message = withModel ? 'model xyz not found' : 'endpoint not found';
        const error = { status, message };
        const result = normalizer.normalizeError(error, 'ollama');

        expect(result.error.message).toBe(expectedMessage);
      });
    });
  });

  describe('Generic Error Normalization', () => {
    test('should normalize network errors', () => {
      const networkErrors = [
        { code: 'ECONNREFUSED', expectedMessage: 'Connection refused. Please check if the server is running.' },
        { code: 'ETIMEDOUT', expectedMessage: 'Request timed out.' },
        { code: 'ENOTFOUND', expectedMessage: 'Server not found. Please check the server address.' },
      ];

      networkErrors.forEach(({ code, expectedMessage }) => {
        const error = { code, message: `Network error: ${code}` };
        const result = normalizer.normalizeError(error, 'generic');

        expect(result.error.message).toBe(expectedMessage);
        expect(result.error.type).toBe('api_error');
        expect(result.error.code).toBe(code.toLowerCase().replace('e', '') + '_error');
      });
    });

    test('should normalize standard HTTP status codes', () => {
      const statusCodes = [
        {
          status: 400,
          expectedMessage: 'Bad request. Please check your request parameters.',
          expectedType: 'invalid_request_error',
        },
        {
          status: 401,
          expectedMessage: 'Authentication failed. Please check your credentials.',
          expectedType: 'authentication_error',
        },
        { status: 403, expectedMessage: 'Access forbidden.', expectedType: 'authentication_error' },
        { status: 404, expectedMessage: 'Resource not found.', expectedType: 'invalid_request_error' },
        { status: 429, expectedMessage: 'Rate limit exceeded.', expectedType: 'rate_limit_error' },
        { status: 500, expectedMessage: 'Internal server error.', expectedType: 'api_error' },
        { status: 502, expectedMessage: 'Bad gateway.', expectedType: 'api_error' },
        { status: 503, expectedMessage: 'Service unavailable.', expectedType: 'api_error' },
      ];

      statusCodes.forEach(({ status, expectedMessage, expectedType }) => {
        const error = { status, message: `HTTP ${status}` };
        const result = normalizer.normalizeError(error, 'generic');

        expect(result.error.message).toBe(expectedMessage);
        expect(result.error.type).toBe(expectedType);
      });
    });

    test('should handle unknown errors gracefully', () => {
      const unknownError = {
        message: 'Something unexpected happened',
      };

      const result = normalizer.normalizeError(unknownError, 'generic');

      expect(result.error.message).toBe('Something unexpected happened');
      expect(result.error.type).toBe('api_error');
      expect(result.error.code).toBe('unknown_error');
    });
  });

  describe('Error Classification and Analysis', () => {
    test('should correctly identify retryable errors', () => {
      const retryableErrors = [
        { code: 'ETIMEDOUT' },
        { code: 'ECONNREFUSED' },
        { status: 500 },
        { status: 502 },
        { status: 503 },
        { status: 429 },
      ];

      retryableErrors.forEach(error => {
        expect(normalizer.isRetryableError(error)).toBe(true);
      });
    });

    test('should correctly identify non-retryable errors', () => {
      const nonRetryableErrors = [{ status: 400 }, { status: 401 }, { status: 403 }, { status: 404 }];

      nonRetryableErrors.forEach(error => {
        expect(normalizer.isRetryableError(error)).toBe(false);
      });
    });

    test('should calculate appropriate retry delays', () => {
      const delayTests = [
        {
          error: { status: 429, response: { headers: { 'retry-after': '30' } } },
          expectedDelay: 30000,
        },
        {
          error: { status: 429 },
          expectedDelay: 10000,
        },
        {
          error: { status: 502 },
          expectedDelay: 5000,
        },
        {
          error: { status: 503 },
          expectedDelay: 5000,
        },
        {
          error: { status: 500 },
          expectedDelay: 2000,
        },
        {
          error: { status: 408 },
          expectedDelay: 1000,
        },
      ];

      delayTests.forEach(({ error, expectedDelay }) => {
        const delay = normalizer.getRetryDelay(error);
        expect(delay).toBe(expectedDelay);
      });
    });

    test('should assess error severity correctly', () => {
      const severityTests = [
        { error: { status: 401 }, expectedSeverity: 'high' },
        { error: { status: 403 }, expectedSeverity: 'high' },
        { error: { status: 400 }, expectedSeverity: 'medium' },
        { error: { status: 404 }, expectedSeverity: 'medium' },
        { error: { status: 500 }, expectedSeverity: 'high' },
        { error: { code: 'ECONNREFUSED' }, expectedSeverity: 'high' },
        { error: { code: 'ENOTFOUND' }, expectedSeverity: 'high' },
        { error: { code: 'ETIMEDOUT' }, expectedSeverity: 'medium' },
        { error: { message: 'Unknown error' }, expectedSeverity: 'medium' },
      ];

      severityTests.forEach(({ error, expectedSeverity }) => {
        const severity = normalizer.getErrorSeverity(error);
        expect(severity).toBe(expectedSeverity);
      });
    });
  });

  describe('Debug Recording', () => {
    test('should record error normalization events', () => {
      const error = {
        status: 429,
        message: 'Rate limit exceeded',
      };

      normalizer.normalizeError(error, 'deepseek');

      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'error_normalization',
        expect.objectContaining({
          server_type: 'deepseek',
          original_error_type: error.constructor.name,
          original_error_message: error.message,
          original_error_status: error.status,
          original_error_data: expect.any(Object),
        })
      );
    });

    test('should record provider-specific normalization', () => {
      const error = {
        message: 'model not loaded',
      };

      normalizer.normalizeError(error, 'lmstudio');

      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'lmstudio_error_normalization',
        expect.objectContaining({
          error_message: error.message,
          has_response_data: false,
        })
      );
    });

    test('should sanitize sensitive data in error logs', () => {
      const error = {
        status: 401,
        message: 'Unauthorized',
        config: {
          url: 'https://api.deepseek.com/v1/chat?key=sk-abc123',
          headers: {
            Authorization: 'Bearer sk-secret-key',
            'Content-Type': 'application/json',
          },
        },
      };

      normalizer.normalizeError(error, 'deepseek');

      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'error_normalization',
        expect.objectContaining({
          original_error_data: expect.objectContaining({
            config: expect.objectContaining({
              url: expect.stringContaining('?key=***'), // API key should be masked
            }),
          }),
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null and undefined errors', () => {
      const cases = [null, undefined];

      cases.forEach(errorInput => {
        const result = normalizer.normalizeError(errorInput, 'generic');

        expect(result.error.message).toBe('Unknown error occurred');
        expect(result.error.type).toBe('api_error');
        expect(result.error.code).toBe('unknown_error');
      });
    });

    test('should handle errors with missing properties', () => {
      const incompleteError = {};

      const result = normalizer.normalizeError(incompleteError, 'deepseek');

      expect(result.error.message).toBe('Unknown DeepSeek API error');
      expect(result.error.type).toBe('api_error');
      expect(result.error.code).toBe('deepseek_error');
    });

    test('should handle circular reference errors safely', () => {
      const circularError: any = {
        message: 'Circular reference error',
      };
      circularError.self = circularError;

      // Should not throw when normalizing
      expect(() => {
        normalizer.normalizeError(circularError, 'generic');
      }).not.toThrow();
    });

    test('should handle complex nested error structures', () => {
      const complexError = {
        status: 400,
        response: {
          data: {
            error: {
              message: 'Validation failed',
              details: [
                { field: 'temperature', message: 'Must be between 0 and 2' },
                { field: 'max_tokens', message: 'Must be positive integer' },
              ],
            },
          },
        },
      };

      const result = normalizer.normalizeError(complexError, 'deepseek');

      expect(result.error.message).toBe('Validation failed');
      expect(result.error.type).toBe('invalid_request_error');
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple error normalizations efficiently', () => {
      const errors = Array.from({ length: 100 }, (_, i) => ({
        status: 400 + (i % 5),
        message: `Error ${i}`,
        code: i % 2 === 0 ? 'ETIMEDOUT' : undefined,
      }));

      const startTime = Date.now();
      const results = errors.map(error => normalizer.normalizeError(error, 'generic'));
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(results).toHaveLength(100);

      results.forEach(result => {
        expect(result).toHaveProperty('error');
        expect(result.error).toHaveProperty('message');
        expect(result.error).toHaveProperty('type');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('param');
      });
    });

    test('should handle concurrent error normalizations', async () => {
      const errors = Array.from({ length: 50 }, (_, i) => ({
        status: 500 + i,
        message: `Concurrent error ${i}`,
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        errors.map(error => Promise.resolve(normalizer.normalizeError(error, 'lmstudio')))
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(results).toHaveLength(50);

      results.forEach((result, i) => {
        expect(result.error.message).toContain(`${500 + i}`);
      });
    });
  });

  describe('Integration with Retry Logic', () => {
    test('should provide comprehensive retry information', () => {
      const retryableError = {
        status: 429,
        response: { headers: { 'retry-after': '15' } },
      };

      const isRetryable = normalizer.isRetryableError(retryableError);
      const retryDelay = normalizer.getRetryDelay(retryableError);
      const severity = normalizer.getErrorSeverity(retryableError);

      expect(isRetryable).toBe(true);
      expect(retryDelay).toBe(15000); // 15 seconds in milliseconds
      expect(severity).toBe('medium');
    });

    test('should handle invalid retry-after headers gracefully', () => {
      const invalidRetryError = {
        status: 429,
        response: { headers: { 'retry-after': 'invalid-value' } },
      };

      const retryDelay = normalizer.getRetryDelay(invalidRetryError);
      expect(retryDelay).toBe(5000); // Should fall back to default
    });
  });
});
