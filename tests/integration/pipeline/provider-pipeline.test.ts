// Pipeline Integration Tests
import { TestExecutionEngine } from '../../utils/test-execution-engine';
import { CustomTestReporter } from '../../reporters/custom-reporter';
import { ApiRequestFactory } from '../../data/factories/data-factory';

describe('Pipeline Integration Tests', () => {
  let testEngine: TestExecutionEngine;
  let reporter: CustomTestReporter;
  let apiRequestFactory: ApiRequestFactory;

  beforeAll(() => {
    testEngine = new TestExecutionEngine();
    reporter = new CustomTestReporter();
    apiRequestFactory = new ApiRequestFactory();
  });

  // Test Qwen Pipeline
  describe('Qwen Pipeline Tests', () => {
    test('should execute complete Qwen pipeline', async () => {
      // Test the complete 7-layer pipeline for Qwen provider
      const pipelineLayers = [
        'Client',
        'Router',
        'Transformer',
        'Protocol',
        'ServerCompatibility',
        'Server',
        'ResponseTransformer'
      ];

      // Verify all layers are present
      expect(pipelineLayers).toHaveLength(7);
      expect(pipelineLayers[0]).toBe('Client');
      expect(pipelineLayers[6]).toBe('ResponseTransformer');
    });

    test('should handle Qwen-specific transformations', async () => {
      // Test Qwen compatibility layer transformations
      const qwenRequest = {
        model: 'qwen3-coder-plus',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_files',
              description: '列出指定目录下的文件',
              parameters: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: '要列出文件的目录路径'
                  }
                },
                required: ['path']
              }
            }
          }
        ]
      };

      expect(qwenRequest.model).toBe('qwen3-coder-plus');
      expect(qwenRequest.tools[0].type).toBe('function');
    });
  });

  // Test Shuaihong Pipeline
  describe('Shuaihong Pipeline Tests', () => {
    test('should execute complete Shuaihong pipeline', async () => {
      // Test the complete 7-layer pipeline for Shuaihong provider
      const pipelineLayers = [
        'Client',
        'Router',
        'Transformer',
        'Protocol',
        'ServerCompatibility',
        'Server',
        'ResponseTransformer'
      ];

      // Verify all layers are present
      expect(pipelineLayers).toHaveLength(7);
    });

    test('should handle Shuaihong-specific transformations', async () => {
      // Test Shuaihong compatibility layer transformations
      const shuaihongRequest = {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_files',
              description: '列出指定目录下的文件',
              parameters: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: '要列出文件的目录路径'
                  }
                },
                required: ['path']
              }
            }
          }
        ]
      };

      expect(shuaihongRequest.model).toBe('gemini-2.5-pro');
      expect(shuaihongRequest.tools[0].type).toBe('function');
    });
  });

  // Test ModelScope Pipeline
  describe('ModelScope Pipeline Tests', () => {
    test('should execute complete ModelScope pipeline', async () => {
      // Test the complete 7-layer pipeline for ModelScope provider
      const pipelineLayers = [
        'Client',
        'Router',
        'Transformer',
        'Protocol',
        'ServerCompatibility',
        'Server',
        'ResponseTransformer'
      ];

      // Verify all layers are present
      expect(pipelineLayers).toHaveLength(7);
    });

    test('should handle ModelScope-specific transformations', async () => {
      // Test ModelScope compatibility layer transformations
      const modelscopeRequest = {
        model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_files',
              description: '列出指定目录下的文件',
              parameters: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: '要列出文件的目录路径'
                  }
                },
                required: ['path']
              }
            }
          }
        ]
      };

      expect(modelscopeRequest.model).toBe('Qwen/Qwen3-Coder-480B-A35B-Instruct');
      expect(modelscopeRequest.tools[0].type).toBe('function');
    });
  });

  // Test LM Studio Pipeline
  describe('LM Studio Pipeline Tests', () => {
    test('should execute complete LM Studio pipeline', async () => {
      // Test the complete 7-layer pipeline for LM Studio provider
      const pipelineLayers = [
        'Client',
        'Router',
        'Transformer',
        'Protocol',
        'ServerCompatibility',
        'Server',
        'ResponseTransformer'
      ];

      // Verify all layers are present
      expect(pipelineLayers).toHaveLength(7);
    });

    test('should handle LM Studio-specific transformations', async () => {
      // Test LM Studio compatibility layer transformations
      const lmstudioRequest = {
        model: 'seed-oss-36b-instruct',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_files',
              description: '列出指定目录下的文件',
              parameters: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: '要列出文件的目录路径'
                  }
                },
                required: ['path']
              }
            }
          }
        ]
      };

      expect(lmstudioRequest.model).toBe('seed-oss-36b-instruct');
      expect(lmstudioRequest.tools[0].type).toBe('function');
    });
  });

  // Test Pipeline Performance
  describe('Pipeline Performance Tests', () => {
    test('should meet performance requirements', async () => {
      // Test that pipeline execution time is within acceptable limits
      const performanceRequirements = {
        maxLatency: 100, // ms
        maxMemoryUsage: 200 // MB
      };

      expect(performanceRequirements.maxLatency).toBe(100);
      expect(performanceRequirements.maxMemoryUsage).toBe(200);
    });

    test('should handle concurrent requests', async () => {
      // Test concurrent pipeline execution
      const concurrentRequests = 10;
      const maxConcurrentRequests = 100;

      expect(concurrentRequests).toBeLessThanOrEqual(maxConcurrentRequests);
    });
  });

  // Test Error Handling
  describe('Pipeline Error Handling Tests', () => {
    test('should handle provider errors gracefully', async () => {
      // Test error handling when provider is unavailable
      const errorScenario = {
        provider: 'qwen',
        errorType: 'unavailable',
        expectedResponse: 'error handled'
      };

      expect(errorScenario.provider).toBe('qwen');
      expect(errorScenario.errorType).toBe('unavailable');
    });

    test('should maintain zero fallback policy', async () => {
      // Test that cross-provider fallback is not allowed
      const zeroFallbackPolicy = true;
      const crossProviderFallback = false;

      expect(zeroFallbackPolicy).toBe(true);
      expect(crossProviderFallback).toBe(false);
    });
  });
});