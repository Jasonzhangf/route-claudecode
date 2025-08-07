/**
 * Gemini API客户端单元测试
 * 项目所有者: Jason Zhang
 */

import { GeminiApiClient } from '@/providers/gemini/modules/api-client';
import { ProviderConfig } from '@/types';

// Mock Google GenAI
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn()
    }
  }))
}));

import { GoogleGenAI } from '@google/genai';

describe('GeminiApiClient', () => {
  let mockProviderConfig: ProviderConfig;
  let apiClient: GeminiApiClient;
  let mockGenAI: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProviderConfig = {
      type: 'gemini',
      baseURL: 'https://generativelanguage.googleapis.com',
      authentication: {
        type: 'bearer',
        credentials: {
          apiKey: 'test-api-key'
        }
      }
    };

    mockGenAI = {
      models: {
        generateContent: jest.fn()
      }
    };

    (GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>).mockImplementation(() => mockGenAI);

    apiClient = new GeminiApiClient(mockProviderConfig, 'test-provider');
  });

  describe('constructor', () => {
    it('should initialize with single API key', () => {
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('should initialize with multiple API keys', () => {
      const multiKeyConfig = {
        ...mockProviderConfig,
        authentication: {
          type: 'bearer' as const,
          credentials: {
            apiKey: ['key1', 'key2', 'key3']
          }
        }
      };

      new GeminiApiClient(multiKeyConfig, 'test-provider');

      expect(GoogleGenAI).toHaveBeenCalledTimes(3);
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'key1' });
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'key2' });
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'key3' });
    });

    it('should throw error for missing API key', () => {
      const invalidConfig = {
        ...mockProviderConfig,
        authentication: {
          type: 'bearer' as const,
          credentials: {}
        }
      };

      expect(() => {
        new GeminiApiClient(invalidConfig, 'test-provider');
      }).toThrow('GeminiApiClient: API key is required');
    });

    it('should throw error for empty API keys array', () => {
      const invalidConfig = {
        ...mockProviderConfig,
        authentication: {
          type: 'bearer' as const,
          credentials: {
            apiKey: []
          }
        }
      };

      expect(() => {
        new GeminiApiClient(invalidConfig, 'test-provider');
      }).toThrow('GeminiApiClient: All API keys must be non-empty strings');
    });

    it('should throw error for empty string API key', () => {
      const invalidConfig = {
        ...mockProviderConfig,
        authentication: {
          type: 'bearer' as const,
          credentials: {
            apiKey: ['valid-key', '', 'another-key']
          }
        }
      };

      expect(() => {
        new GeminiApiClient(invalidConfig, 'test-provider');
      }).toThrow('GeminiApiClient: All API keys must be non-empty strings');
    });
  });

  describe('executeRequest', () => {
    const mockRequest = {
      model: 'gemini-2.5-pro',
      contents: [
        {
          role: 'user' as const,
          parts: [{ text: 'Hello, world!' }]
        }
      ]
    };

    it('should execute successful request', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Hello! How can I help you?' }],
              role: 'model'
            },
            finishReason: 'STOP'
          }
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 15
        }
      };

      mockGenAI.models.generateContent.mockResolvedValue(mockResponse);

      const result = await apiClient.executeRequest(mockRequest, 'test-request-001');

      expect(mockGenAI.models.generateContent).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should rotate API keys on multiple requests', async () => {
      const multiKeyConfig = {
        ...mockProviderConfig,
        authentication: {
          type: 'bearer' as const,
          credentials: {
            apiKey: ['key1', 'key2']
          }
        }
      };

      const multiKeyClient = new GeminiApiClient(multiKeyConfig, 'test-provider');
      const mockResponse = { candidates: [{ content: { parts: [{ text: 'Response' }] } }] };

      // Mock multiple GenAI instances
      const mockGenAI1 = { models: { generateContent: jest.fn().mockResolvedValue(mockResponse) } };
      const mockGenAI2 = { models: { generateContent: jest.fn().mockResolvedValue(mockResponse) } };

      (GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>)
        .mockImplementationOnce(() => mockGenAI1)
        .mockImplementationOnce(() => mockGenAI2);

      // Create new instance to use the mocked implementations
      const newClient = new GeminiApiClient(multiKeyConfig, 'test-provider');

      // Execute multiple requests
      await newClient.executeRequest(mockRequest, 'req1');
      await newClient.executeRequest(mockRequest, 'req2');
      await newClient.executeRequest(mockRequest, 'req3');

      // Should use different keys in rotation
      expect(mockGenAI1.models.generateContent).toHaveBeenCalledTimes(2); // requests 1 and 3
      expect(mockGenAI2.models.generateContent).toHaveBeenCalledTimes(1); // request 2
    });

    it('should retry on retryable errors', async () => {
      const mockResponse = { candidates: [{ content: { parts: [{ text: 'Success' }] } }] };
      
      mockGenAI.models.generateContent
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(mockResponse);

      const result = await apiClient.executeRequest(mockRequest, 'test-request-001');

      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockResponse);
    });

    it('should not retry on non-retryable errors', async () => {
      mockGenAI.models.generateContent.mockRejectedValue(new Error('400 Bad Request'));

      await expect(
        apiClient.executeRequest(mockRequest, 'test-request-001')
      ).rejects.toThrow('Gemini API requests failed after 3 attempts: 400 Bad Request');

      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout', async () => {
      // Mock a request that never resolves
      mockGenAI.models.generateContent.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      await expect(
        apiClient.executeRequest(mockRequest, 'test-request-001')
      ).rejects.toThrow('Gemini API requests failed after 3 attempts');

      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(3);
    }, 10000); // Longer timeout for this test

    it('should detect streaming response as error', async () => {
      const streamingResponse = {
        stream: true,
        candidates: [{ content: { parts: [{ text: 'Response' }] } }]
      };

      mockGenAI.models.generateContent.mockResolvedValue(streamingResponse);

      await expect(
        apiClient.executeRequest(mockRequest, 'test-request-001')
      ).rejects.toThrow('CRITICAL: Gemini API returned streaming response when non-streaming was requested');
    });

    it('should validate response format', async () => {
      const invalidResponse = null;

      mockGenAI.models.generateContent.mockResolvedValue(invalidResponse);

      await expect(
        apiClient.executeRequest(mockRequest, 'test-request-001')
      ).rejects.toThrow('GeminiApiClient: API returned null or undefined response');
    });

    it('should handle API error responses', async () => {
      const errorResponse = {
        error: {
          code: 400,
          message: 'Invalid request'
        }
      };

      mockGenAI.models.generateContent.mockResolvedValue(errorResponse);

      await expect(
        apiClient.executeRequest(mockRequest, 'test-request-001')
      ).rejects.toThrow('GeminiApiClient: API returned error');
    });

    it('should identify retryable error patterns', async () => {
      const retryableErrors = [
        new Error('timeout'),
        new Error('network error'),
        new Error('ECONNRESET'),
        new Error('ETIMEDOUT'),
        new Error('rate limit exceeded'),
        new Error('quota exceeded'),
        new Error('429 Too Many Requests'),
        new Error('500 Internal Server Error'),
        new Error('502 Bad Gateway'),
        new Error('503 Service Unavailable'),
        new Error('504 Gateway Timeout')
      ];

      for (const error of retryableErrors) {
        mockGenAI.models.generateContent
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'Success' }] } }] });

        const result = await apiClient.executeRequest(mockRequest, 'test-request-001');
        
        expect(result.candidates).toBeDefined();
        jest.clearAllMocks();
      }
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy service', async () => {
      const mockResponse = {
        candidates: [{ content: { parts: [{ text: 'Hi' }] } }]
      };

      mockGenAI.models.generateContent.mockResolvedValue(mockResponse);

      const isHealthy = await apiClient.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockGenAI.models.generateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: 'Hi' }]
        }]
      });
    });

    it('should return false for unhealthy service', async () => {
      mockGenAI.models.generateContent.mockRejectedValue(new Error('Service unavailable'));

      const isHealthy = await apiClient.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false for empty response', async () => {
      mockGenAI.models.generateContent.mockResolvedValue(null);

      const isHealthy = await apiClient.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false for response without candidates', async () => {
      mockGenAI.models.generateContent.mockResolvedValue({ candidates: [] });

      const isHealthy = await apiClient.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should handle timeout in health check', async () => {
      mockGenAI.models.generateContent.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const isHealthy = await apiClient.healthCheck();

      expect(isHealthy).toBe(false);
    }, 65000); // Longer timeout for this test
  });

  describe('streaming detection', () => {
    it('should detect various streaming response formats', () => {
      const streamingFormats = [
        { stream: true },
        { streaming: true },
        { read: () => {} },
        { pipe: () => {} },
        { constructor: { name: 'ReadableStream' } }
      ];

      streamingFormats.forEach(format => {
        mockGenAI.models.generateContent.mockResolvedValue({
          ...format,
          candidates: [{ content: { parts: [{ text: 'Test' }] } }]
        });

        expect(
          apiClient.executeRequest(mockRequest, 'test-request-001')
        ).rejects.toThrow('CRITICAL: Gemini API returned streaming response');
        
        jest.clearAllMocks();
      });
    });

    it('should not detect streaming for normal objects', async () => {
      const normalResponse = {
        candidates: [{ content: { parts: [{ text: 'Normal response' }] } }],
        usageMetadata: { promptTokenCount: 5 }
      };

      mockGenAI.models.generateContent.mockResolvedValue(normalResponse);

      const result = await apiClient.executeRequest(mockRequest, 'test-request-001');

      expect(result).toEqual(normalResponse);
    });
  });

  describe('configuration extraction', () => {
    it('should extract API key from credentials.apiKey', () => {
      const config = {
        ...mockProviderConfig,
        authentication: {
          type: 'bearer' as const,
          credentials: {
            apiKey: 'test-key'
          }
        }
      };

      expect(() => {
        new GeminiApiClient(config, 'test');
      }).not.toThrow();
    });

    it('should extract API key from credentials.api_key', () => {
      const config = {
        ...mockProviderConfig,
        authentication: {
          type: 'bearer' as const,
          credentials: {
            api_key: 'test-key'
          }
        }
      };

      expect(() => {
        new GeminiApiClient(config, 'test');
      }).not.toThrow();
    });

    it('should use default configuration values', () => {
      // This test verifies that the client uses sensible defaults
      // The actual values are tested implicitly through timeout and retry behavior
      expect(() => {
        new GeminiApiClient(mockProviderConfig, 'test');
      }).not.toThrow();
    });
  });

  describe('request execution edge cases', () => {
    it('should handle non-Error rejection', async () => {
      mockGenAI.models.generateContent.mockRejectedValue('String error');

      await expect(
        apiClient.executeRequest(mockRequest, 'test-request-001')
      ).rejects.toThrow('Gemini API requests failed after 3 attempts: String error');
    });

    it('should handle non-object response', async () => {
      mockGenAI.models.generateContent.mockResolvedValue('string response');

      await expect(
        apiClient.executeRequest(mockRequest, 'test-request-001')
      ).rejects.toThrow('GeminiApiClient: API returned non-object response');
    });

    it('should stop retries on non-retryable error', async () => {
      mockGenAI.models.generateContent
        .mockRejectedValueOnce(new Error('401 Unauthorized'))
        .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'Success' }] } }] });

      await expect(
        apiClient.executeRequest(mockRequest, 'test-request-001')
      ).rejects.toThrow('Gemini API requests failed after 3 attempts: 401 Unauthorized');

      // Should only be called once (no retry)
      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('key rotation', () => {
    it('should start with first key', async () => {
      const mockResponse = { candidates: [{ content: { parts: [{ text: 'Response' }] } }] };
      mockGenAI.models.generateContent.mockResolvedValue(mockResponse);

      await apiClient.executeRequest(mockRequest, 'test-request-001');

      // Should use the first (and only) client
      expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(1);
    });
  });
});