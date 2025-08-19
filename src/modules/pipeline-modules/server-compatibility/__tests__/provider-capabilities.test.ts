/**
 * Provider Capabilities Manager - 单元测试
 *
 * 验证Provider能力配置管理器的功能
 *
 * @author Jason Zhang
 */

import { ProviderCapabilitiesManager } from '../provider-capabilities';

describe('ProviderCapabilitiesManager', () => {
  describe('Capabilities Retrieval', () => {
    test('should return correct DeepSeek capabilities', () => {
      const capabilities = ProviderCapabilitiesManager.getCapabilities('deepseek');

      expect(capabilities.name).toBe('deepseek');
      expect(capabilities.supportsTools).toBe(true);
      expect(capabilities.supportsThinking).toBe(true);
      expect(capabilities.parameterLimits.temperature).toEqual({ min: 0.01, max: 2.0 });
      expect(capabilities.parameterLimits.top_p).toEqual({ min: 0.01, max: 1.0 });
      expect(capabilities.parameterLimits.max_tokens).toEqual({ min: 1, max: 8192 });
      expect(capabilities.responseFixesNeeded).toContain('tool_calls_format');
      expect(capabilities.responseFixesNeeded).toContain('thinking_mode_cleanup');
    });

    test('should return correct LM Studio capabilities', () => {
      const capabilities = ProviderCapabilitiesManager.getCapabilities('lmstudio');

      expect(capabilities.name).toBe('lmstudio');
      expect(capabilities.supportsTools).toBe(false);
      expect(capabilities.supportsThinking).toBe(false);
      expect(capabilities.parameterLimits.max_tokens).toEqual({ min: 1, max: 4096 });
      expect(capabilities.responseFixesNeeded).toContain('missing_usage');
      expect(capabilities.responseFixesNeeded).toContain('missing_id');
      expect(capabilities.responseFixesNeeded).toContain('choices_array_fix');
    });

    test('should return correct Ollama capabilities', () => {
      const capabilities = ProviderCapabilitiesManager.getCapabilities('ollama');

      expect(capabilities.name).toBe('ollama');
      expect(capabilities.supportsTools).toBe(false);
      expect(capabilities.supportsThinking).toBe(false);
      expect(capabilities.parameterLimits.temperature).toEqual({ min: 0, max: 2.0 }); // 注意Ollama允许0
      expect(capabilities.responseFixesNeeded).toContain('format_standardization');
    });

    test('should return correct OpenAI capabilities', () => {
      const capabilities = ProviderCapabilitiesManager.getCapabilities('openai');

      expect(capabilities.name).toBe('openai');
      expect(capabilities.supportsTools).toBe(true);
      expect(capabilities.supportsThinking).toBe(false);
      expect(capabilities.responseFixesNeeded).toHaveLength(0); // OpenAI标准格式，不需要修复
    });

    test('should return default capabilities for unknown provider', () => {
      const capabilities = ProviderCapabilitiesManager.getCapabilities('unknown-provider');

      expect(capabilities.name).toBe('unknown');
      expect(capabilities.supportsTools).toBe(false);
      expect(capabilities.supportsThinking).toBe(false);
      expect(capabilities.responseFixesNeeded).toContain('basic_standardization');
    });
  });

  describe('Feature Support Checks', () => {
    test('should correctly identify tool support', () => {
      expect(ProviderCapabilitiesManager.supportsFeature('deepseek', 'tools')).toBe(true);
      expect(ProviderCapabilitiesManager.supportsFeature('openai', 'tools')).toBe(true);
      expect(ProviderCapabilitiesManager.supportsFeature('anthropic', 'tools')).toBe(true);
      expect(ProviderCapabilitiesManager.supportsFeature('lmstudio', 'tools')).toBe(false);
      expect(ProviderCapabilitiesManager.supportsFeature('ollama', 'tools')).toBe(false);
    });

    test('should correctly identify thinking mode support', () => {
      expect(ProviderCapabilitiesManager.supportsFeature('deepseek', 'thinking')).toBe(true);
      expect(ProviderCapabilitiesManager.supportsFeature('openai', 'thinking')).toBe(false);
      expect(ProviderCapabilitiesManager.supportsFeature('lmstudio', 'thinking')).toBe(false);
    });

    test('should correctly identify streaming support', () => {
      // 大部分Provider支持streaming，除了特定的如huggingface
      expect(ProviderCapabilitiesManager.supportsFeature('deepseek', 'streaming')).toBe(true);
      expect(ProviderCapabilitiesManager.supportsFeature('openai', 'streaming')).toBe(true);
      expect(ProviderCapabilitiesManager.supportsFeature('lmstudio', 'streaming')).toBe(true);
      expect(ProviderCapabilitiesManager.supportsFeature('huggingface', 'streaming')).toBe(false);
    });

    test('should handle unknown features', () => {
      expect(ProviderCapabilitiesManager.supportsFeature('deepseek', 'unknown' as any)).toBe(false);
    });
  });

  describe('Parameter Validation and Adjustment', () => {
    test('should validate parameters within limits', () => {
      // DeepSeek temperature limits
      expect(ProviderCapabilitiesManager.isParameterValid('deepseek', 'temperature', 1.0)).toBe(true);
      expect(ProviderCapabilitiesManager.isParameterValid('deepseek', 'temperature', 0.005)).toBe(false);
      expect(ProviderCapabilitiesManager.isParameterValid('deepseek', 'temperature', 3.0)).toBe(false);

      // LM Studio max_tokens limits
      expect(ProviderCapabilitiesManager.isParameterValid('lmstudio', 'max_tokens', 2000)).toBe(true);
      expect(ProviderCapabilitiesManager.isParameterValid('lmstudio', 'max_tokens', 8000)).toBe(false);

      // Ollama temperature (allows 0)
      expect(ProviderCapabilitiesManager.isParameterValid('ollama', 'temperature', 0)).toBe(true);
      expect(ProviderCapabilitiesManager.isParameterValid('ollama', 'temperature', -0.1)).toBe(false);
    });

    test('should return true for undefined parameter limits', () => {
      // Test with a parameter that has no defined limits
      expect(ProviderCapabilitiesManager.isParameterValid('deepseek', 'unknown_param', 999)).toBe(true);
    });

    test('should clamp parameters to valid ranges', () => {
      // DeepSeek temperature clamping
      expect(ProviderCapabilitiesManager.clampParameter('deepseek', 'temperature', 0.005)).toBe(0.01);
      expect(ProviderCapabilitiesManager.clampParameter('deepseek', 'temperature', 3.0)).toBe(2.0);
      expect(ProviderCapabilitiesManager.clampParameter('deepseek', 'temperature', 1.5)).toBe(1.5);

      // Anthropic temperature range (different from others)
      expect(ProviderCapabilitiesManager.clampParameter('anthropic', 'temperature', 1.5)).toBe(1.0);

      // LM Studio max_tokens
      expect(ProviderCapabilitiesManager.clampParameter('lmstudio', 'max_tokens', 8000)).toBe(4096);

      // Ollama temperature (allows 0)
      expect(ProviderCapabilitiesManager.clampParameter('ollama', 'temperature', -0.5)).toBe(0);
    });

    test('should return original value for undefined limits', () => {
      expect(ProviderCapabilitiesManager.clampParameter('deepseek', 'unknown_param', 999)).toBe(999);
    });
  });

  describe('Response Fixes Analysis', () => {
    test('should return correct response fixes needed', () => {
      const deepseekFixes = ProviderCapabilitiesManager.getResponseFixesNeeded('deepseek');
      expect(deepseekFixes).toEqual(['tool_calls_format', 'thinking_mode_cleanup']);

      const lmstudioFixes = ProviderCapabilitiesManager.getResponseFixesNeeded('lmstudio');
      expect(lmstudioFixes).toEqual(['missing_usage', 'missing_id', 'missing_created', 'choices_array_fix']);

      const openaieFixes = ProviderCapabilitiesManager.getResponseFixesNeeded('openai');
      expect(openaieFixes).toEqual([]);
    });

    test('should correctly identify if fixes are needed', () => {
      expect(ProviderCapabilitiesManager.needsResponseFixes('deepseek')).toBe(true);
      expect(ProviderCapabilitiesManager.needsResponseFixes('lmstudio')).toBe(true);
      expect(ProviderCapabilitiesManager.needsResponseFixes('openai')).toBe(false);
    });
  });

  describe('Provider Management', () => {
    test('should add and update provider capabilities', () => {
      const customCapabilities = {
        name: 'custom-provider',
        supportsTools: true,
        supportsThinking: false,
        parameterLimits: {
          temperature: { min: 0.1, max: 1.0 },
          max_tokens: { min: 1, max: 2048 },
        },
        responseFixesNeeded: ['custom_fix'],
      };

      ProviderCapabilitiesManager.setCapabilities('custom-provider', customCapabilities);

      const retrieved = ProviderCapabilitiesManager.getCapabilities('custom-provider');
      expect(retrieved).toEqual(customCapabilities);
    });

    test('should list all supported providers', () => {
      const providers = ProviderCapabilitiesManager.getSupportedProviders();

      expect(providers).toContain('deepseek');
      expect(providers).toContain('lmstudio');
      expect(providers).toContain('ollama');
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('gemini');
      expect(providers).toContain('cohere');
      expect(providers).toContain('huggingface');
    });

    test('should list tool-supported providers', () => {
      const toolProviders = ProviderCapabilitiesManager.getToolSupportedProviders();

      expect(toolProviders).toContain('deepseek');
      expect(toolProviders).toContain('openai');
      expect(toolProviders).toContain('anthropic');
      expect(toolProviders).not.toContain('lmstudio');
      expect(toolProviders).not.toContain('ollama');
    });

    test('should list thinking-supported providers', () => {
      const thinkingProviders = ProviderCapabilitiesManager.getThinkingSupportedProviders();

      expect(thinkingProviders).toContain('deepseek');
      expect(thinkingProviders).not.toContain('openai');
      expect(thinkingProviders).not.toContain('lmstudio');
    });
  });

  describe('Provider Comparison', () => {
    test('should compare two providers correctly', () => {
      const comparison = ProviderCapabilitiesManager.compareProviders('deepseek', 'lmstudio');

      expect(comparison.provider1).toBe('deepseek');
      expect(comparison.provider2).toBe('lmstudio');
      expect(comparison.tools.provider1).toBe(true);
      expect(comparison.tools.provider2).toBe(false);
      expect(comparison.thinking.provider1).toBe(true);
      expect(comparison.thinking.provider2).toBe(false);
      expect(comparison.parameterLimits.temperature.provider1).toEqual({ min: 0.01, max: 2.0 });
      expect(comparison.parameterLimits.max_tokens.provider1).toEqual({ min: 1, max: 8192 });
      expect(comparison.parameterLimits.max_tokens.provider2).toEqual({ min: 1, max: 4096 });
    });

    test('should handle comparison with unknown providers', () => {
      const comparison = ProviderCapabilitiesManager.compareProviders('deepseek', 'unknown');

      expect(comparison.tools.provider1).toBe(true);
      expect(comparison.tools.provider2).toBe(false);
    });
  });

  describe('Provider Recommendation', () => {
    test('should recommend providers based on tool requirements', () => {
      const recommendations = ProviderCapabilitiesManager.recommendProvider({
        needsTools: true,
      });

      expect(recommendations).toContain('deepseek');
      expect(recommendations).toContain('openai');
      expect(recommendations).toContain('anthropic');
      expect(recommendations).not.toContain('lmstudio');
      expect(recommendations).not.toContain('ollama');
    });

    test('should recommend providers based on thinking requirements', () => {
      const recommendations = ProviderCapabilitiesManager.recommendProvider({
        needsThinking: true,
      });

      expect(recommendations).toContain('deepseek');
      expect(recommendations).not.toContain('openai');
      expect(recommendations).not.toContain('lmstudio');
    });

    test('should recommend providers based on max_tokens requirements', () => {
      const recommendations = ProviderCapabilitiesManager.recommendProvider({
        maxTokens: 100000, // High token requirement
      });

      expect(recommendations).toContain('anthropic'); // Supports up to 200k
      expect(recommendations).not.toContain('lmstudio'); // Only supports 4k
    });

    test('should recommend providers based on temperature range', () => {
      const recommendations = ProviderCapabilitiesManager.recommendProvider({
        preferredTemperatureRange: { min: 1.5, max: 2.0 },
      });

      expect(recommendations).toContain('deepseek'); // Supports up to 2.0
      expect(recommendations).toContain('lmstudio'); // Supports up to 2.0
      expect(recommendations).not.toContain('anthropic'); // Only supports up to 1.0
    });

    test('should recommend providers with multiple requirements', () => {
      const recommendations = ProviderCapabilitiesManager.recommendProvider({
        needsTools: true,
        maxTokens: 6000,
        preferredTemperatureRange: { min: 0.5, max: 1.5 },
      });

      expect(recommendations).toContain('deepseek'); // Supports tools, 8192 tokens, and temperature range
      expect(recommendations).toContain('openai'); // Supports tools and temperature range
      expect(recommendations).not.toContain('lmstudio'); // No tool support
    });

    test('should return empty list when no providers meet requirements', () => {
      const recommendations = ProviderCapabilitiesManager.recommendProvider({
        needsTools: true,
        needsThinking: true,
        maxTokens: 500000, // Impossibly high requirement
      });

      expect(recommendations).toHaveLength(0);
    });
  });

  describe('Performance Rating System', () => {
    test('should provide performance ratings for different providers', () => {
      const openaiRating = ProviderCapabilitiesManager.getPerformanceRating('openai');
      expect(openaiRating.overall).toBeGreaterThan(80);
      expect(openaiRating.speed).toBe(85);
      expect(openaiRating.accuracy).toBe(95);
      expect(openaiRating.stability).toBe(90);

      const deepseekRating = ProviderCapabilitiesManager.getPerformanceRating('deepseek');
      expect(deepseekRating.features).toBe(100); // Supports both tools and thinking

      const lmstudioRating = ProviderCapabilitiesManager.getPerformanceRating('lmstudio');
      expect(lmstudioRating.features).toBe(50); // No advanced features
      expect(lmstudioRating.speed).toBeLessThan(70); // Local processing is slower
    });

    test('should calculate feature scores correctly', () => {
      // Provider with both tools and thinking
      const fullFeaturesRating = ProviderCapabilitiesManager.getPerformanceRating('deepseek');
      expect(fullFeaturesRating.features).toBe(100); // 50 base + 25 tools + 25 thinking

      // Provider with tools only
      const toolsOnlyRating = ProviderCapabilitiesManager.getPerformanceRating('openai');
      expect(toolsOnlyRating.features).toBe(75); // 50 base + 25 tools

      // Provider with no advanced features
      const basicRating = ProviderCapabilitiesManager.getPerformanceRating('ollama');
      expect(basicRating.features).toBe(50); // 50 base only
    });

    test('should handle unknown providers in performance rating', () => {
      const unknownRating = ProviderCapabilitiesManager.getPerformanceRating('unknown');

      expect(unknownRating.overall).toBeGreaterThan(0);
      expect(unknownRating.speed).toBe(70); // Default values
      expect(unknownRating.accuracy).toBe(70);
      expect(unknownRating.stability).toBe(70);
      expect(unknownRating.features).toBe(50);
    });
  });

  describe('Capabilities Validation', () => {
    test('should validate complete capabilities', () => {
      const validCapabilities = {
        name: 'test-provider',
        supportsTools: true,
        supportsThinking: false,
        parameterLimits: {
          temperature: { min: 0, max: 1 },
        },
        responseFixesNeeded: ['fix1', 'fix2'],
      };

      expect(ProviderCapabilitiesManager.validateCapabilities(validCapabilities)).toBe(true);
    });

    test('should reject invalid capabilities', () => {
      const invalidCases = [
        {
          // Missing name
          supportsTools: true,
          supportsThinking: false,
          parameterLimits: {},
          responseFixesNeeded: [],
        },
        {
          // Invalid supportsTools type
          name: 'test',
          supportsTools: 'yes',
          supportsThinking: false,
          parameterLimits: {},
          responseFixesNeeded: [],
        },
        {
          // Missing parameterLimits
          name: 'test',
          supportsTools: true,
          supportsThinking: false,
          responseFixesNeeded: [],
        },
        {
          // Invalid responseFixesNeeded type
          name: 'test',
          supportsTools: true,
          supportsThinking: false,
          parameterLimits: {},
          responseFixesNeeded: 'invalid',
        },
      ];

      invalidCases.forEach(invalidCapabilities => {
        expect(ProviderCapabilitiesManager.validateCapabilities(invalidCapabilities as any)).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing parameter types gracefully', () => {
      const limits = ProviderCapabilitiesManager.getParameterLimits('deepseek', 'non_existent_param' as any);
      expect(limits).toBeNull();
    });

    test('should handle empty provider names', () => {
      const capabilities = ProviderCapabilitiesManager.getCapabilities('');
      expect(capabilities.name).toBe('unknown');
    });

    test('should handle provider comparison with same provider', () => {
      const comparison = ProviderCapabilitiesManager.compareProviders('deepseek', 'deepseek');

      expect(comparison.tools.provider1).toBe(comparison.tools.provider2);
      expect(comparison.thinking.provider1).toBe(comparison.thinking.provider2);
    });

    test('should handle recommendation with no requirements', () => {
      const recommendations = ProviderCapabilitiesManager.recommendProvider({});

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations).toContain('deepseek');
      expect(recommendations).toContain('openai');
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle multiple capability lookups efficiently', () => {
      const providers = ['deepseek', 'openai', 'lmstudio', 'ollama', 'anthropic'];

      const startTime = Date.now();
      const results = providers.map(provider => ({
        provider,
        capabilities: ProviderCapabilitiesManager.getCapabilities(provider),
        toolSupport: ProviderCapabilitiesManager.supportsFeature(provider, 'tools'),
        rating: ProviderCapabilitiesManager.getPerformanceRating(provider),
      }));
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
      expect(results).toHaveLength(providers.length);

      results.forEach(result => {
        expect(result.capabilities).toBeDefined();
        expect(typeof result.toolSupport).toBe('boolean');
        expect(result.rating).toHaveProperty('overall');
      });
    });

    test('should handle concurrent access safely', async () => {
      const providers = Array.from({ length: 100 }, (_, i) => `provider-${i % 5}`);

      const startTime = Date.now();
      const results = await Promise.all(
        providers.map(provider => Promise.resolve(ProviderCapabilitiesManager.getCapabilities(provider)))
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(results).toHaveLength(100);
    });
  });
});
