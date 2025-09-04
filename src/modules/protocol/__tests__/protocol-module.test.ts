/**
 * Protocol Module Unit Tests
 * 
 * 协议模块单元测试
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { ProtocolModule, ProtocolType, ProtocolConfig } from '../protocol-module';
import { ModuleState } from '../../../interfaces/module/base-module';

// 实际的测试配置
const createTestConfig = (): ProtocolConfig => ({
  type: ProtocolType.OPENAI,
  version: '1.0.0',
  enabled: true,
  priority: 1,
  endpoint: 'http://localhost:8080/v1',
  apiKey: 'test-key',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  defaultModel: 'gpt-3.5-turbo',
  modelMapping: {
    'claude-3-opus': 'gpt-4',
    'claude-3-sonnet': 'gpt-3.5-turbo'
  }
});

describe('ProtocolModule', () => {
  let protocolModule: ProtocolModule;
  let testConfig: ProtocolConfig;

  beforeEach(() => {
    testConfig = createTestConfig();
  });

  afterEach(async () => {
    if (protocolModule && protocolModule.getState() \!== ModuleState.DESTROYED) {
      await protocolModule.destroy();
    }
  });

  describe('Module Creation and Configuration', () => {
    test('should create protocol module with valid config', () => {
      protocolModule = new ProtocolModule(testConfig);
      
      expect(protocolModule).toBeDefined();
      expect(protocolModule.getId()).toContain('protocol_');
      expect(protocolModule.getName()).toBe('ProtocolModule');
      expect(protocolModule.getVersion()).toBe('1.0.0');
      expect(protocolModule.getType()).toBe('PROTOCOL');
      expect(protocolModule.getState()).toBe(ModuleState.CREATED);
    });

    test('should validate protocol type', () => {
      const invalidConfig = { ...testConfig, type: 'invalid' as ProtocolType };
      
      expect(() => new ProtocolModule(invalidConfig)).toThrow('Invalid protocol type');
    });

    test('should validate endpoint requirement', () => {
      const invalidConfig = { ...testConfig, endpoint: '' };
      
      expect(() => new ProtocolModule(invalidConfig)).toThrow('Endpoint is required');
    });

    test('should validate timeout range', () => {
      const invalidConfig = { ...testConfig, timeout: -1 };
      
      expect(() => new ProtocolModule(invalidConfig)).toThrow('Timeout must be between 1000 and 300000');
    });

    test('should validate retry configuration', () => {
      const invalidConfig = { ...testConfig, maxRetries: -1 };
      
      expect(() => new ProtocolModule(invalidConfig)).toThrow('Max retries must be between 0 and 10');
    });
  });

  describe('Module Lifecycle', () => {
    beforeEach(() => {
      protocolModule = new ProtocolModule(testConfig);
    });

    test('should initialize module successfully', async () => {
      await protocolModule.initialize();
      
      expect(protocolModule.getState()).toBe(ModuleState.INITIALIZED);
    });

    test('should start module successfully', async () => {
      await protocolModule.initialize();
      await protocolModule.start();
      
      expect(protocolModule.getState()).toBe(ModuleState.RUNNING);
    });

    test('should stop module successfully', async () => {
      await protocolModule.initialize();
      await protocolModule.start();
      await protocolModule.stop();
      
      expect(protocolModule.getState()).toBe(ModuleState.STOPPED);
    });

    test('should reset module successfully', async () => {
      await protocolModule.initialize();
      await protocolModule.start();
      await protocolModule.reset();
      
      expect(protocolModule.getState()).toBe(ModuleState.STOPPED);
    });

    test('should configure module successfully', async () => {
      await protocolModule.initialize();
      
      const newConfig = { ...testConfig, timeout: 60000 };
      await protocolModule.configure(newConfig);
      
      const health = await protocolModule.healthCheck();
      expect(health).toBeDefined();
    });
  });

  describe('Request Processing - Request Stages', () => {
    beforeEach(async () => {
      protocolModule = new ProtocolModule(testConfig);
      await protocolModule.initialize();
      await protocolModule.start();
    });

    test('should handle req_in stage correctly', async () => {
      const input = {
        stage: 'req_in',
        request: {
          model: 'claude-3-opus',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        metadata: {}
      };

      const result = await protocolModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.protocol).toBeDefined();
      expect(result.metadata.protocol.stage).toBe('req_in');
      expect(result.validated).toBe(true);
    });

    test('should handle req_process stage with model mapping', async () => {
      const input = {
        stage: 'req_process',
        request: {
          model: 'claude-3-opus',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        metadata: {
          protocol: {
            stage: 'req_in',
            timestamp: new Date().toISOString()
          }
        }
      };

      const result = await protocolModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.request).toBeDefined();
      expect(result.metadata.protocol.stage).toBe('req_process');
      expect(result.request.model).toBe('gpt-4');
    });

    test('should handle req_out stage with protocol formatting', async () => {
      const input = {
        stage: 'req_out',
        request: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        metadata: {
          protocol: {
            stage: 'req_process',
            processedAt: new Date().toISOString()
          }
        }
      };

      const result = await protocolModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.request).toBeDefined();
      expect(result.metadata.protocol.stage).toBe('req_out');
      expect(result.metadata.protocol.validatedAt).toBeDefined();
    });
  });

  describe('Response Processing - Response Stages', () => {
    beforeEach(async () => {
      protocolModule = new ProtocolModule(testConfig);
      await protocolModule.initialize();
      await protocolModule.start();
    });

    test('should handle response_in stage', async () => {
      const input = {
        stage: 'response_in',
        response: {
          id: 'test-response',
          choices: []
        },
        metadata: {}
      };

      const result = await protocolModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.protocol).toBeDefined();
      expect(result.metadata.protocol.stage).toBe('response_in');
      expect(result.metadata.protocol.responseReceivedAt).toBeDefined();
    });

    test('should handle response_process stage', async () => {
      const input = {
        stage: 'response_process',
        response: {
          id: 'test-response',
          choices: []
        },
        metadata: {
          protocol: {
            stage: 'response_in',
            responseReceivedAt: new Date().toISOString()
          }
        }
      };

      const result = await protocolModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.metadata.protocol.stage).toBe('response_process');
      expect(result.metadata.protocol.processedAt).toBeDefined();
    });

    test('should handle response_out stage', async () => {
      const input = {
        stage: 'response_out',
        response: {
          id: 'test-response',
          choices: []
        },
        metadata: {
          protocol: {
            stage: 'response_process',
            processedAt: new Date().toISOString()
          }
        }
      };

      const result = await protocolModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.metadata.protocol.stage).toBe('response_out');
      expect(result.metadata.protocol.finalizedAt).toBeDefined();
    });
  });

  describe('Protocol Specific Functionality', () => {
    beforeEach(async () => {
      protocolModule = new ProtocolModule(testConfig);
      await protocolModule.initialize();
      await protocolModule.start();
    });

    test('should apply model mapping correctly', async () => {
      const input = {
        stage: 'req_process',
        request: {
          model: 'claude-3-opus',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      };

      const result = await protocolModule.process(input);
      
      expect(result.request.model).toBe('gpt-4');
    });

    test('should preserve unmapped models', async () => {
      const input = {
        stage: 'req_process',
        request: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      };

      const result = await protocolModule.process(input);
      
      expect(result.request.model).toBe('gpt-3.5-turbo');
    });

    test('should add protocol headers', async () => {
      const input = {
        stage: 'req_process',
        request: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      };

      const result = await protocolModule.process(input);
      
      expect(result.request.headers).toBeDefined();
      expect(result.request.headers['Content-Type']).toBe('application/json');
      expect(result.request.headers['Authorization']).toBe('Bearer test-key');
    });

    test('should format request for OpenAI protocol', async () => {
      const input = {
        stage: 'req_out',
        request: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      };

      const result = await protocolModule.process(input);
      
      expect(result.request.model).toBe('gpt-3.5-turbo');
      expect(Array.isArray(result.request.messages)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      protocolModule = new ProtocolModule(testConfig);
      await protocolModule.initialize();
      await protocolModule.start();
    });

    test('should handle disabled module', async () => {
      const disabledConfig = { ...testConfig, enabled: false };
      const disabledModule = new ProtocolModule(disabledConfig);
      await disabledModule.initialize();
      await disabledModule.start();
      
      const input = { stage: 'req_in' };
      
      await expect(disabledModule.process(input))
        .rejects
        .toThrow('Protocol module is disabled');
      
      await disabledModule.destroy();
    });

    test('should handle invalid stage with default processing', async () => {
      const input = {
        stage: 'invalid_stage',
        request: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      };

      const result = await protocolModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.stage).toBe('invalid_stage');
    });

    test('should validate model requirements', async () => {
      const input = {
        stage: 'req_process',
        request: {
          messages: [{ role: 'user', content: 'Hello' }]
        }
      };

      await expect(protocolModule.process(input))
        .rejects
        .toThrow('Model is required');
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      protocolModule = new ProtocolModule(testConfig);
      await protocolModule.initialize();
      await protocolModule.start();
    });

    test('should return health check information', async () => {
      const health = await protocolModule.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.protocolType).toBe(ProtocolType.OPENAI);
      expect(health.enabled).toBe(true);
      expect(health.endpoint).toBe('http://localhost:8080/v1');
      expect(health.modelMapping).toBe(true);
    });

    test('should include base health information', async () => {
      const health = await protocolModule.healthCheck();
      
      expect(health.id).toBe(protocolModule.getId());
      expect(health.name).toBe(protocolModule.getName());
      expect(health.version).toBe(protocolModule.getVersion());
      expect(health.state).toBe(protocolModule.getState());
      expect(health.createdAt).toBeDefined();
      expect(health.updatedAt).toBeDefined();
    });
  });
});
EOF < /dev/null