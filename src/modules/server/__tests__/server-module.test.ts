/**
 * Server Module Unit Tests
 * 
 * 服务器模块单元测试
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { ServerModule, ServerType, ServerConfig } from '../server-module';
import { ModuleState } from '../../../interfaces/module/base-module';

// 实际的测试配置
const createTestConfig = (): ServerConfig => ({
  type: ServerType.HTTP,
  endpoint: 'http://localhost:8080/v1',
  apiKey: 'test-key',
  version: '1.0.0',
  enabled: true,
  priority: 1,
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  keepAlive: true,
  validateSSL: true,
  defaultHeaders: {
    'User-Agent': 'Test-Agent/1.0'
  }
});

describe('ServerModule', () => {
  let serverModule: ServerModule;
  let testConfig: ServerConfig;

  beforeEach(() => {
    testConfig = createTestConfig();
  });

  afterEach(async () => {
    if (serverModule && serverModule.getState() \!== ModuleState.DESTROYED) {
      await serverModule.destroy();
    }
  });

  describe('Module Creation and Configuration', () => {
    test('should create server module with valid config', () => {
      serverModule = new ServerModule(testConfig);
      
      expect(serverModule).toBeDefined();
      expect(serverModule.getId()).toContain('server_');
      expect(serverModule.getName()).toBe('ServerModule');
      expect(serverModule.getVersion()).toBe('1.0.0');
      expect(serverModule.getType()).toBe('SERVER');
      expect(serverModule.getState()).toBe(ModuleState.CREATED);
    });

    test('should validate server type', () => {
      const invalidConfig = { ...testConfig, type: 'invalid' as ServerType };
      
      expect(() => new ServerModule(invalidConfig)).toThrow('Invalid server type');
    });

    test('should validate endpoint requirement', () => {
      const invalidConfig = { ...testConfig, endpoint: '' };
      
      expect(() => new ServerModule(invalidConfig)).toThrow('Endpoint is required');
    });

    test('should validate endpoint URL format', () => {
      const invalidConfig = { ...testConfig, endpoint: 'invalid-url' };
      
      expect(() => new ServerModule(invalidConfig)).toThrow('Invalid endpoint URL');
    });

    test('should validate timeout range', () => {
      const invalidConfig = { ...testConfig, timeout: -1 };
      
      expect(() => new ServerModule(invalidConfig)).toThrow('Timeout must be between 1000 and 300000 milliseconds');
    });

    test('should validate retry configuration', () => {
      const invalidConfig = { ...testConfig, maxRetries: -1 };
      
      expect(() => new ServerModule(invalidConfig)).toThrow('Max retries must be between 0 and 10');
    });
  });

  describe('Module Lifecycle', () => {
    beforeEach(() => {
      serverModule = new ServerModule(testConfig);
    });

    test('should initialize module successfully', async () => {
      await serverModule.initialize();
      
      expect(serverModule.getState()).toBe(ModuleState.INITIALIZED);
    });

    test('should start module successfully', async () => {
      await serverModule.initialize();
      await serverModule.start();
      
      expect(serverModule.getState()).toBe(ModuleState.RUNNING);
    });

    test('should stop module successfully', async () => {
      await serverModule.initialize();
      await serverModule.start();
      await serverModule.stop();
      
      expect(serverModule.getState()).toBe(ModuleState.STOPPED);
    });

    test('should reset module successfully', async () => {
      await serverModule.initialize();
      await serverModule.start();
      await serverModule.reset();
      
      expect(serverModule.getState()).toBe(ModuleState.STOPPED);
    });

    test('should configure module successfully', async () => {
      await serverModule.initialize();
      
      const newConfig = { ...testConfig, timeout: 60000 };
      await serverModule.configure(newConfig);
      
      const health = await serverModule.healthCheck();
      expect(health).toBeDefined();
    });
  });

  describe('Request Processing - Request Stages', () => {
    beforeEach(async () => {
      serverModule = new ServerModule(testConfig);
      await serverModule.initialize();
      await serverModule.start();
    });

    test('should handle req_in stage correctly', async () => {
      const input = {
        stage: 'req_in',
        request: {
          url: 'http://localhost:8080/v1/chat/completions',
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hello' }]
          })
        },
        metadata: {}
      };

      const result = await serverModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.server).toBeDefined();
      expect(result.metadata.server.stage).toBe('req_in');
      expect(result.validated).toBe(true);
    });

    test('should handle req_process stage with request preparation', async () => {
      const input = {
        stage: 'req_process',
        request: {
          url: 'http://localhost:8080/v1/chat/completions',
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hello' }]
          })
        },
        metadata: {
          server: {
            stage: 'req_in',
            timestamp: new Date().toISOString()
          }
        }
      };

      const result = await serverModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.request).toBeDefined();
      expect(result.metadata.server.stage).toBe('req_process');
      expect(result.request.headers).toBeDefined();
      expect(result.request.headers['Content-Type']).toBe('application/json');
      expect(result.request.headers['Authorization']).toBe('Bearer test-key');
    });

    test('should handle req_out stage with request execution', async () => {
      const input = {
        stage: 'req_out',
        request: {
          url: 'http://localhost:8080/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hello' }]
          })
        },
        metadata: {
          server: {
            stage: 'req_process',
            processedAt: new Date().toISOString()
          }
        }
      };

      // 注意：实际的HTTP请求测试需要mock网络调用
      // 这里我们只测试请求结构的正确性
      const result = await serverModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.server.stage).toBe('req_out');
      expect(result.metadata.server.executedAt).toBeDefined();
    });
  });

  describe('Response Processing - Response Stages', () => {
    beforeEach(async () => {
      serverModule = new ServerModule(testConfig);
      await serverModule.initialize();
      await serverModule.start();
    });

    test('should handle response_in stage', async () => {
      const input = {
        stage: 'response_in',
        response: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            id: 'test-response',
            choices: []
          }),
          duration: 100
        },
        metadata: {}
      };

      const result = await serverModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.server).toBeDefined();
      expect(result.metadata.server.stage).toBe('response_in');
      expect(result.metadata.server.responseReceivedAt).toBeDefined();
    });

    test('should handle response_process stage', async () => {
      const input = {
        stage: 'response_process',
        response: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            id: 'test-response',
            choices: []
          }),
          duration: 100
        },
        metadata: {
          server: {
            stage: 'response_in',
            responseReceivedAt: new Date().toISOString()
          }
        }
      };

      const result = await serverModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.metadata.server.stage).toBe('response_process');
      expect(result.metadata.server.processedAt).toBeDefined();
    });

    test('should handle response_out stage', async () => {
      const input = {
        stage: 'response_out',
        response: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            id: 'test-response',
            choices: []
          }),
          duration: 100
        },
        metadata: {
          server: {
            stage: 'response_process',
            processedAt: new Date().toISOString()
          }
        }
      };

      const result = await serverModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.metadata.server.stage).toBe('response_out');
      expect(result.metadata.server.finalizedAt).toBeDefined();
    });
  });

  describe('Server Specific Functionality', () => {
    beforeEach(async () => {
      serverModule = new ServerModule(testConfig);
      await serverModule.initialize();
      await serverModule.start();
    });

    test('should prepare request options correctly', async () => {
      const input = {
        stage: 'req_process',
        request: {
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hello' }]
          })
        }
      };

      const result = await serverModule.process(input);
      
      expect(result.request.timeout).toBe(30000);
      expect(result.request.method).toBe('POST');
      expect(result.request.headers['Content-Type']).toBe('application/json');
      expect(result.request.headers['User-Agent']).toBe('Test-Agent/1.0');
    });

    test('should add authentication headers', async () => {
      const input = {
        stage: 'req_process',
        request: {
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hello' }]
          })
        }
      };

      const result = await serverModule.process(input);
      
      expect(result.request.headers['Authorization']).toBe('Bearer test-key');
    });

    test('should handle JSON response formatting', async () => {
      const input = {
        stage: 'response_out',
        response: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json'
          },
          body: '{"id":"test-response","choices":[]}',
          duration: 100
        }
      };

      const result = await serverModule.process(input);
      
      expect(result.response.body).toBeDefined();
      expect(typeof result.response.body).toBe('object');
      expect(result.response.body.id).toBe('test-response');
    });

    test('should handle non-JSON response', async () => {
      const input = {
        stage: 'response_out',
        response: {
          statusCode: 200,
          headers: {
            'content-type': 'text/plain'
          },
          body: 'Plain text response',
          duration: 100
        }
      };

      const result = await serverModule.process(input);
      
      expect(result.response.body).toBe('Plain text response');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      serverModule = new ServerModule(testConfig);
      await serverModule.initialize();
      await serverModule.start();
    });

    test('should handle disabled module', async () => {
      const disabledConfig = { ...testConfig, enabled: false };
      const disabledModule = new ServerModule(disabledConfig);
      await disabledModule.initialize();
      await disabledModule.start();
      
      const input = { stage: 'req_in' };
      
      await expect(disabledModule.process(input))
        .rejects
        .toThrow('Server module is disabled');
      
      await disabledModule.destroy();
    });

    test('should handle invalid stage with default processing', async () => {
      const input = {
        stage: 'invalid_stage',
        request: {
          url: 'http://localhost:8080/v1/chat/completions',
          method: 'POST'
        }
      };

      const result = await serverModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.stage).toBe('invalid_stage');
    });

    test('should handle HTTP error responses', async () => {
      const input = {
        stage: 'response_process',
        response: {
          statusCode: 400,
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            error: {
              message: 'Bad Request',
              type: 'invalid_request_error'
            }
          }),
          duration: 100
        }
      };

      const result = await serverModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.response.statusCode).toBe(400);
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      serverModule = new ServerModule(testConfig);
      await serverModule.initialize();
      await serverModule.start();
    });

    test('should return health check information', async () => {
      const health = await serverModule.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.serverType).toBe(ServerType.HTTP);
      expect(health.endpoint).toBe('http://localhost:8080/v1');
      expect(health.enabled).toBe(true);
      expect(health.timeout).toBe(30000);
      expect(health.maxRetries).toBe(3);
      expect(health.keepAlive).toBe(true);
    });

    test('should include base health information', async () => {
      const health = await serverModule.healthCheck();
      
      expect(health.id).toBe(serverModule.getId());
      expect(health.name).toBe(serverModule.getName());
      expect(health.version).toBe(serverModule.getVersion());
      expect(health.state).toBe(serverModule.getState());
      expect(health.createdAt).toBeDefined();
      expect(health.updatedAt).toBeDefined();
    });
  });
});
EOF < /dev/null