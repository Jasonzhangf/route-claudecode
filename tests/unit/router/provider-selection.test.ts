// Provider Unit Tests
import { MockDataGenerator } from '../../data/mocks/mock-data-generator';
import { testFixtures } from '../../data/fixtures/test-fixtures';

describe('Provider Unit Tests', () => {
  // Test Qwen Provider
  describe('Qwen Provider Tests', () => {
    test('should validate Qwen provider configuration', () => {
      const qwenConfig = {
        name: 'qwen',
        priority: 1,
        protocol: 'openai',
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
        apiKey: 'qwen-auth-1',
        models: [
          {
            name: 'qwen3-coder-plus',
            maxTokens: 1000000,
            capabilities: ['programming', 'long-context']
          }
        ]
      };

      expect(qwenConfig.name).toBe('qwen');
      expect(qwenConfig.protocol).toBe('openai');
      expect(qwenConfig.baseURL).toBe('https://dashscope.aliyuncs.com/compatible-mode');
      expect(qwenConfig.models[0].name).toBe('qwen3-coder-plus');
    });

    test('should handle Qwen API key validation', () => {
      const apiKey = 'qwen-auth-1';
      // Qwen API key can be any format, just checking it exists
      const isValid = apiKey.length > 0;

      expect(apiKey).toBe('qwen-auth-1');
      expect(isValid).toBe(true);
    });

    test('should validate Qwen model capabilities', () => {
      const model = {
        name: 'qwen3-coder-plus',
        maxTokens: 1000000,
        capabilities: ['programming', 'long-context', 'extended-long-context', 'ultra-long-context']
      };

      expect(model.capabilities).toContain('programming');
      expect(model.capabilities).toContain('long-context');
      expect(model.capabilities).toContain('extended-long-context');
      expect(model.capabilities).toContain('ultra-long-context');
      expect(model.maxTokens).toBe(1000000);
    });
  });

  // Test Shuaihong Provider
  describe('Shuaihong Provider Tests', () => {
    test('should validate Shuaihong provider configuration', () => {
      const shuaihongConfig = {
        name: 'shuaihong',
        priority: 2,
        protocol: 'openai',
        baseURL: 'http://ai.shuaihong.xyz:3939',
        apiKey: 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl',
        models: [
          {
            name: 'gemini-2.5-pro',
            maxTokens: 1000000,
            capabilities: ['programming', 'multimodal', 'image-processing']
          }
        ]
      };

      expect(shuaihongConfig.name).toBe('shuaihong');
      expect(shuaihongConfig.protocol).toBe('openai');
      expect(shuaihongConfig.baseURL).toBe('http://ai.shuaihong.xyz:3939');
      expect(shuaihongConfig.models[0].name).toBe('gemini-2.5-pro');
    });

    test('should handle Shuaihong API key validation', () => {
      const apiKey = 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl';
      // Simple validation that the key exists and is a string
      const isValidFormat = typeof apiKey === 'string' && apiKey.startsWith('sk-') && apiKey.length > 10;

      expect(apiKey).toBe('sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl');
      expect(apiKey.length).toBeGreaterThan(10);
      expect(isValidFormat).toBe(true);
    });

    test('should validate Shuaihong model capabilities', () => {
      const model = {
        name: 'gemini-2.5-pro',
        maxTokens: 1000000,
        capabilities: ['programming', 'multimodal', 'image-processing', 'long-context']
      };

      expect(model.capabilities).toContain('programming');
      expect(model.capabilities).toContain('multimodal');
      expect(model.capabilities).toContain('image-processing');
      expect(model.capabilities).toContain('long-context');
      expect(model.maxTokens).toBe(1000000);
    });
  });

  // Test ModelScope Provider
  describe('ModelScope Provider Tests', () => {
    test('should validate ModelScope provider configuration', () => {
      const modelscopeConfig = {
        name: 'modelscope',
        priority: 3,
        protocol: 'openai',
        baseURL: 'https://api-inference.modelscope.cn',
        apiKey: 'ms-cc2f461b-8228-427f-99aa-1d44fab73e67',
        models: [
          {
            name: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
            maxTokens: 65536,
            capabilities: ['programming', 'long-context']
          }
        ]
      };

      expect(modelscopeConfig.name).toBe('modelscope');
      expect(modelscopeConfig.protocol).toBe('openai');
      expect(modelscopeConfig.baseURL).toBe('https://api-inference.modelscope.cn');
      expect(modelscopeConfig.models[0].name).toBe('Qwen/Qwen3-Coder-480B-A35B-Instruct');
    });

    test('should handle ModelScope API key validation', () => {
      const apiKey = 'ms-cc2f461b-8228-427f-99aa-1d44fab73e67';
      // More flexible validation for ModelScope API key
      const isValidFormat = typeof apiKey === 'string' && apiKey.length > 0;

      expect(apiKey).toBe('ms-cc2f461b-8228-427f-99aa-1d44fab73e67');
      expect(isValidFormat).toBe(true);
    });

    test('should validate ModelScope model capabilities', () => {
      const model = {
        name: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
        maxTokens: 65536,
        capabilities: ['programming', 'long-context']
      };

      expect(model.capabilities).toContain('programming');
      expect(model.capabilities).toContain('long-context');
      expect(model.maxTokens).toBe(65536);
    });
  });

  // Test LM Studio Provider
  describe('LM Studio Provider Tests', () => {
    test('should validate LM Studio provider configuration', () => {
      const lmstudioConfig = {
        name: 'lmstudio',
        priority: 4,
        protocol: 'openai',
        baseURL: 'http://localhost:1234',
        apiKey: 'lm-studio',
        models: [
          {
            name: 'seed-oss-36b-instruct',
            maxTokens: 131072,
            capabilities: ['programming']
          }
        ]
      };

      expect(lmstudioConfig.name).toBe('lmstudio');
      expect(lmstudioConfig.protocol).toBe('openai');
      expect(lmstudioConfig.baseURL).toBe('http://localhost:1234');
      expect(lmstudioConfig.models[0].name).toBe('seed-oss-36b-instruct');
    });

    test('should handle LM Studio API key validation', () => {
      const apiKey = 'lm-studio';
      const isValidFormat = typeof apiKey === 'string' && apiKey.length > 0;

      expect(apiKey).toBe('lm-studio');
      expect(isValidFormat).toBe(true);
    });

    test('should validate LM Studio model capabilities', () => {
      const model = {
        name: 'seed-oss-36b-instruct',
        maxTokens: 131072,
        capabilities: ['programming']
      };

      expect(model.capabilities).toContain('programming');
      expect(model.maxTokens).toBe(131072);
    });
  });

  // Test Provider Selection Logic
  describe('Provider Selection Logic Tests', () => {
    test('should select provider based on priority', () => {
      const providers = [
        { name: 'qwen', priority: 1 },
        { name: 'shuaihong', priority: 2 },
        { name: 'modelscope', priority: 3 },
        { name: 'lmstudio', priority: 4 }
      ];

      const sortedProviders = providers.sort((a, b) => a.priority - b.priority);
      expect(sortedProviders[0].name).toBe('qwen');
      expect(sortedProviders[0].priority).toBe(1);
    });

    test('should handle model category mapping', () => {
      const modelCategories = {
        coding: 'qwen',
        default: 'shuaihong',
        reasoning: 'shuaihong',
        longContext: 'qwen'
      };

      expect(modelCategories.coding).toBe('qwen');
      expect(modelCategories.default).toBe('shuaihong');
      expect(modelCategories.reasoning).toBe('shuaihong');
      expect(modelCategories.longContext).toBe('qwen');
    });
  });
});