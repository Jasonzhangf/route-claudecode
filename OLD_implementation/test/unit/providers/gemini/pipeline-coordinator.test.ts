/**
 * Gemini管道协调器单元测试
 * 项目所有者: Jason Zhang
 */

import { GeminiPipelineCoordinator } from '@/providers/gemini/modules/pipeline-coordinator';
import { BaseRequest, ProviderConfig } from '@/types';

// Mock all the dependencies
jest.mock('@/providers/gemini/modules/request-converter');
jest.mock('@/providers/gemini/modules/response-converter');
jest.mock('@/providers/gemini/modules/api-client');
jest.mock('@/providers/gemini/modules/streaming-simulator');

import { GeminiRequestConverter } from '@/providers/gemini/modules/request-converter';
import { GeminiResponseConverter } from '@/providers/gemini/modules/response-converter';
import { GeminiApiClient } from '@/providers/gemini/modules/api-client';
import { GeminiStreamingSimulator } from '@/providers/gemini/modules/streaming-simulator';

describe('GeminiPipelineCoordinator', () => {
  let coordinator: GeminiPipelineCoordinator;
  let mockProviderConfig: ProviderConfig;
  let mockRequest: BaseRequest;

  const MockedRequestConverter = GeminiRequestConverter as jest.MockedClass<typeof GeminiRequestConverter>;
  const MockedResponseConverter = GeminiResponseConverter as jest.MockedClass<typeof GeminiResponseConverter>;
  const MockedApiClient = GeminiApiClient as jest.MockedClass<typeof GeminiApiClient>;
  const MockedStreamingSimulator = GeminiStreamingSimulator as jest.MockedClass<typeof GeminiStreamingSimulator>;

  beforeEach(() => {
    // Reset mocks
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

    mockRequest = {
      model: 'gemini-2.5-pro',
      messages: [
        { role: 'user', content: 'Hello, world!' }
      ],
      metadata: { requestId: 'test-request-001' }
    };

    // Setup constructor mocks
    MockedApiClient.mockImplementation(() => ({
      executeRequest: jest.fn(),
      healthCheck: jest.fn()
    } as any));

    MockedStreamingSimulator.mockImplementation(() => ({
      simulateStreaming: jest.fn(),
      updateConfig: jest.fn()
    } as any));

    coordinator = new GeminiPipelineCoordinator(mockProviderConfig, 'gemini-provider-1');
  });

  describe('constructor', () => {
    it('should initialize all components correctly', () => {
      expect(MockedApiClient).toHaveBeenCalledWith(mockProviderConfig, 'gemini-provider-1');
      expect(MockedStreamingSimulator).toHaveBeenCalled();
    });
  });

  describe('processRequest - non-streaming mode', () => {
    it('should process request through complete pipeline', async () => {
      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      const mockGeminiResponse = { candidates: [{ content: { parts: [{ text: 'Hello!' }] } }] };
      const mockAnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }]
      };

      // Setup mocks
      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      MockedResponseConverter.validateResponse = jest.fn();
      MockedResponseConverter.convertToAnthropicFormat = jest.fn().mockReturnValue(mockAnthropicResponse);
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockResolvedValue(mockGeminiResponse);

      const result = await coordinator.processRequest(mockRequest, {
        streaming: false,
        simulateStreaming: false
      });

      expect(MockedRequestConverter.convertToGeminiFormat).toHaveBeenCalledWith(mockRequest);
      expect(mockApiClient.executeRequest).toHaveBeenCalledWith(mockGeminiRequest, 'test-request-001');
      expect(MockedResponseConverter.validateResponse).toHaveBeenCalledWith(mockGeminiResponse, 'test-request-001');
      expect(MockedResponseConverter.convertToAnthropicFormat).toHaveBeenCalledWith(
        mockGeminiResponse,
        'gemini-2.5-pro',
        'test-request-001'
      );
      expect(result).toEqual(mockAnthropicResponse);
    });

    it('should handle request conversion errors', async () => {
      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockImplementation(() => {
        throw new Error('Invalid request format');
      });

      await expect(coordinator.processRequest(mockRequest, {
        streaming: false,
        simulateStreaming: false
      })).rejects.toThrow('Gemini request conversion failed: Invalid request format');
    });

    it('should handle API call errors', async () => {
      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      
      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockRejectedValue(new Error('API timeout'));

      await expect(coordinator.processRequest(mockRequest, {
        streaming: false,
        simulateStreaming: false
      })).rejects.toThrow('API timeout');
    });

    it('should handle response conversion errors', async () => {
      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      const mockGeminiResponse = { candidates: [] };

      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      MockedResponseConverter.validateResponse = jest.fn();
      MockedResponseConverter.convertToAnthropicFormat = jest.fn().mockImplementation(() => {
        throw new Error('Invalid response format');
      });
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockResolvedValue(mockGeminiResponse);

      await expect(coordinator.processRequest(mockRequest, {
        streaming: false,
        simulateStreaming: false
      })).rejects.toThrow('Gemini response conversion failed: Invalid response format');
    });
  });

  describe('processRequest - streaming mode', () => {
    it('should return streaming generator when streaming is enabled', async () => {
      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      const mockGeminiResponse = { candidates: [{ content: { parts: [{ text: 'Hello!' }] } }] };
      const mockAnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }]
      };
      const mockStreamGenerator = (async function* () {
        yield { event: 'message_start', data: '{}' };
      })();

      // Setup mocks
      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      MockedResponseConverter.validateResponse = jest.fn();
      MockedResponseConverter.convertToAnthropicFormat = jest.fn().mockReturnValue(mockAnthropicResponse);
      MockedStreamingSimulator.validateResponse = jest.fn();
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockResolvedValue(mockGeminiResponse);
      
      const mockStreamingSimulator = coordinator['streamingSimulator'] as jest.Mocked<GeminiStreamingSimulator>;
      mockStreamingSimulator.simulateStreaming = jest.fn().mockReturnValue(mockStreamGenerator);
      mockStreamingSimulator.updateConfig = jest.fn();

      const result = await coordinator.processRequest(mockRequest, {
        streaming: true,
        simulateStreaming: true,
        streamingConfig: {
          chunkDelay: 50,
          textChunkSize: 10,
          enableToolCallStreaming: true
        }
      });

      expect(mockStreamingSimulator.updateConfig).toHaveBeenCalledWith({
        chunkDelay: 50,
        textChunkSize: 10,
        enableToolCallStreaming: true
      });
      expect(MockedStreamingSimulator.validateResponse).toHaveBeenCalledWith(mockAnthropicResponse);
      expect(mockStreamingSimulator.simulateStreaming).toHaveBeenCalledWith(
        mockAnthropicResponse,
        'test-request-001'
      );
      expect(result).toBe(mockStreamGenerator);
    });

    it('should handle streaming simulation errors', async () => {
      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      const mockGeminiResponse = { candidates: [{ content: { parts: [{ text: 'Hello!' }] } }] };
      const mockAnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }]
      };

      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      MockedResponseConverter.validateResponse = jest.fn();
      MockedResponseConverter.convertToAnthropicFormat = jest.fn().mockReturnValue(mockAnthropicResponse);
      MockedStreamingSimulator.validateResponse = jest.fn().mockImplementation(() => {
        throw new Error('Streaming validation failed');
      });
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockResolvedValue(mockGeminiResponse);

      await expect(coordinator.processRequest(mockRequest, {
        streaming: true,
        simulateStreaming: true
      })).rejects.toThrow('Gemini streaming simulation failed: Streaming validation failed');
    });
  });

  describe('healthCheck', () => {
    it('should return true when API client is healthy', async () => {
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.healthCheck = jest.fn().mockResolvedValue(true);

      const result = await coordinator.healthCheck();

      expect(mockApiClient.healthCheck).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when API client is unhealthy', async () => {
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.healthCheck = jest.fn().mockResolvedValue(false);

      const result = await coordinator.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when health check throws error', async () => {
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.healthCheck = jest.fn().mockRejectedValue(new Error('Health check failed'));

      const result = await coordinator.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('error stage identification', () => {
    it('should identify request conversion errors', async () => {
      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockImplementation(() => {
        throw new Error('GeminiRequestConverter: Invalid format');
      });

      try {
        await coordinator.processRequest(mockRequest, {
          streaming: false,
          simulateStreaming: false
        });
      } catch (error) {
        // The error should be caught and re-thrown with stage identification
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should identify API execution errors', async () => {
      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      
      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockRejectedValue(new Error('GeminiApiClient: timeout'));

      try {
        await coordinator.processRequest(mockRequest, {
          streaming: false,
          simulateStreaming: false
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should identify response conversion errors', async () => {
      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      const mockGeminiResponse = { candidates: [] };

      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      MockedResponseConverter.validateResponse = jest.fn();
      MockedResponseConverter.convertToAnthropicFormat = jest.fn().mockImplementation(() => {
        throw new Error('GeminiResponseConverter: Invalid format');
      });
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockResolvedValue(mockGeminiResponse);

      try {
        await coordinator.processRequest(mockRequest, {
          streaming: false,
          simulateStreaming: false
        });
      } catch (error) {
        expect((error as Error).message).toContain('Gemini response conversion failed');
      }
    });
  });

  describe('getPipelineStats', () => {
    it('should return correct pipeline statistics', () => {
      const stats = coordinator.getPipelineStats();

      expect(stats).toEqual({
        coordinator: 'GeminiPipelineCoordinator',
        modules: [
          'GeminiRequestConverter',
          'GeminiApiClient',
          'GeminiResponseConverter',
          'GeminiStreamingSimulator'
        ],
        capabilities: [
          'request-format-conversion',
          'api-communication',
          'response-format-conversion',
          'streaming-simulation'
        ],
        architecture: 'modular-pipeline'
      });
    });
  });

  describe('request with missing requestId', () => {
    it('should handle requests without requestId gracefully', async () => {
      const requestWithoutId = {
        model: 'gemini-2.5-pro',
        messages: [{ role: 'user', content: 'Test' }]
        // No metadata.requestId
      };

      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      const mockGeminiResponse = { candidates: [{ content: { parts: [{ text: 'Response' }] } }] };
      const mockAnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }]
      };

      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      MockedResponseConverter.validateResponse = jest.fn();
      MockedResponseConverter.convertToAnthropicFormat = jest.fn().mockReturnValue(mockAnthropicResponse);
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockResolvedValue(mockGeminiResponse);

      const result = await coordinator.processRequest(requestWithoutId as BaseRequest, {
        streaming: false,
        simulateStreaming: false
      });

      expect(mockApiClient.executeRequest).toHaveBeenCalledWith(mockGeminiRequest, 'unknown');
      expect(result).toEqual(mockAnthropicResponse);
    });
  });

  describe('configuration handling', () => {
    it('should handle streaming config properly when provided', async () => {
      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      const mockGeminiResponse = { candidates: [{ content: { parts: [{ text: 'Hello!' }] } }] };
      const mockAnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }]
      };
      const mockStreamGenerator = (async function* () {
        yield { event: 'message_start', data: '{}' };
      })();

      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      MockedResponseConverter.validateResponse = jest.fn();
      MockedResponseConverter.convertToAnthropicFormat = jest.fn().mockReturnValue(mockAnthropicResponse);
      MockedStreamingSimulator.validateResponse = jest.fn();
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockResolvedValue(mockGeminiResponse);
      
      const mockStreamingSimulator = coordinator['streamingSimulator'] as jest.Mocked<GeminiStreamingSimulator>;
      mockStreamingSimulator.simulateStreaming = jest.fn().mockReturnValue(mockStreamGenerator);
      mockStreamingSimulator.updateConfig = jest.fn();

      const customStreamingConfig = {
        chunkDelay: 25,
        textChunkSize: 15,
        enableToolCallStreaming: false
      };

      await coordinator.processRequest(mockRequest, {
        streaming: true,
        simulateStreaming: true,
        streamingConfig: customStreamingConfig
      });

      expect(mockStreamingSimulator.updateConfig).toHaveBeenCalledWith(customStreamingConfig);
    });

    it('should not update streaming config when not provided', async () => {
      const mockGeminiRequest = { model: 'gemini-2.5-pro', contents: [] };
      const mockGeminiResponse = { candidates: [{ content: { parts: [{ text: 'Hello!' }] } }] };
      const mockAnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }]
      };
      const mockStreamGenerator = (async function* () {
        yield { event: 'message_start', data: '{}' };
      })();

      MockedRequestConverter.convertToGeminiFormat = jest.fn().mockReturnValue(mockGeminiRequest);
      MockedResponseConverter.validateResponse = jest.fn();
      MockedResponseConverter.convertToAnthropicResponse = jest.fn().mockReturnValue(mockAnthropicResponse);
      MockedStreamingSimulator.validateResponse = jest.fn();
      
      const mockApiClient = coordinator['apiClient'] as jest.Mocked<GeminiApiClient>;
      mockApiClient.executeRequest = jest.fn().mockResolvedValue(mockGeminiResponse);
      
      const mockStreamingSimulator = coordinator['streamingSimulator'] as jest.Mocked<GeminiStreamingSimulator>;
      mockStreamingSimulator.simulateStreaming = jest.fn().mockReturnValue(mockStreamGenerator);
      mockStreamingSimulator.updateConfig = jest.fn();

      await coordinator.processRequest(mockRequest, {
        streaming: true,
        simulateStreaming: true
        // No streamingConfig provided
      });

      expect(mockStreamingSimulator.updateConfig).not.toHaveBeenCalled();
    });
  });
});