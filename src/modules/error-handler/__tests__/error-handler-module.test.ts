/**
 * Error Handler Module Unit Tests
 * 
 * 错误处理模块单元测试
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { ErrorHandlerModule, ErrorType, ErrorSeverity, ErrorHandlingStrategy, ErrorHandlerConfig } from '../error-handler-module';
import { ModuleState } from '../../../interfaces/module/base-module';

// 实际的测试配置
const createTestConfig = (): ErrorHandlerConfig => ({
  enabled: true,
  priority: 1,
  defaultStrategy: ErrorHandlingStrategy.RETRY,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
  logErrors: true,
  logLevel: 'error'
});

describe('ErrorHandlerModule', () => {
  let errorHandlerModule: ErrorHandlerModule;
  let testConfig: ErrorHandlerConfig;

  beforeEach(() => {
    testConfig = createTestConfig();
  });

  afterEach(async () => {
    if (errorHandlerModule && errorHandlerModule.getState() \!== ModuleState.DESTROYED) {
      await errorHandlerModule.destroy();
    }
  });

  describe('Module Creation and Configuration', () => {
    test('should create error handler module with valid config', () => {
      errorHandlerModule = new ErrorHandlerModule(testConfig);
      
      expect(errorHandlerModule).toBeDefined();
      expect(errorHandlerModule.getId()).toContain('error-handler_');
      expect(errorHandlerModule.getName()).toBe('ErrorHandlerModule');
      expect(errorHandlerModule.getVersion()).toBe('1.0.0');
      expect(errorHandlerModule.getType()).toBe('ERROR_HANDLER');
      expect(errorHandlerModule.getState()).toBe(ModuleState.CREATED);
    });

    test('should validate max retries configuration', () => {
      const invalidConfig = { ...testConfig, maxRetries: -1 };
      
      expect(() => new ErrorHandlerModule(invalidConfig)).toThrow('Max retries must be between 0 and 10');
    });

    test('should validate retry delay configuration', () => {
      const invalidConfig = { ...testConfig, retryDelay: -1 };
      
      expect(() => new ErrorHandlerModule(invalidConfig)).toThrow('Retry delay must be non-negative');
    });

    test('should validate timeout configuration', () => {
      const invalidConfig = { ...testConfig, timeout: -1 };
      
      expect(() => new ErrorHandlerModule(invalidConfig)).toThrow('Timeout must be between 1000 and 300000 milliseconds');
    });
  });

  describe('Module Lifecycle', () => {
    beforeEach(() => {
      errorHandlerModule = new ErrorHandlerModule(testConfig);
    });

    test('should initialize module successfully', async () => {
      await errorHandlerModule.initialize();
      
      expect(errorHandlerModule.getState()).toBe(ModuleState.INITIALIZED);
    });

    test('should start module successfully', async () => {
      await errorHandlerModule.initialize();
      await errorHandlerModule.start();
      
      expect(errorHandlerModule.getState()).toBe(ModuleState.RUNNING);
    });

    test('should stop module successfully', async () => {
      await errorHandlerModule.initialize();
      await errorHandlerModule.start();
      await errorHandlerModule.stop();
      
      expect(errorHandlerModule.getState()).toBe(ModuleState.STOPPED);
    });

    test('should reset module successfully', async () => {
      await errorHandlerModule.initialize();
      await errorHandlerModule.start();
      await errorHandlerModule.reset();
      
      expect(errorHandlerModule.getState()).toBe(ModuleState.STOPPED);
    });

    test('should configure module successfully', async () => {
      await errorHandlerModule.initialize();
      
      const newConfig = { ...testConfig, maxRetries: 5 };
      await errorHandlerModule.configure(newConfig);
      
      const health = await errorHandlerModule.healthCheck();
      expect(health).toBeDefined();
    });
  });

  describe('Request Processing - Request Stages', () => {
    beforeEach(async () => {
      errorHandlerModule = new ErrorHandlerModule(testConfig);
      await errorHandlerModule.initialize();
      await errorHandlerModule.start();
    });

    test('should handle req_in stage correctly', async () => {
      const input = {
        stage: 'req_in',
        error: new Error('Test error'),
        metadata: {}
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.errorHandler).toBeDefined();
      expect(result.metadata.errorHandler.stage).toBe('req_in');
      expect(result.errorPreprocessed).toBe(true);
    });

    test('should handle req_process stage with error handling', async () => {
      const input = {
        stage: 'req_process',
        error: new Error('Test error'),
        metadata: {
          errorHandler: {
            stage: 'req_in',
            timestamp: new Date().toISOString()
          }
        }
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.errorHandlingResult).toBeDefined();
      expect(result.metadata.errorHandler.stage).toBe('req_process');
      expect(result.metadata.errorHandler.handled).toBe(true);
    });

    test('should handle req_out stage with result validation', async () => {
      const input = {
        stage: 'req_out',
        errorHandlingResult: {
          handled: true,
          strategy: ErrorHandlingStrategy.RETRY,
          retryCount: 1
        },
        metadata: {
          errorHandler: {
            stage: 'req_process',
            processedAt: new Date().toISOString(),
            handled: true
          }
        }
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.errorHandlingResult).toBeDefined();
      expect(result.metadata.errorHandler.stage).toBe('req_out');
      expect(result.metadata.errorHandler.validatedAt).toBeDefined();
    });
  });

  describe('Response Processing - Response Stages', () => {
    beforeEach(async () => {
      errorHandlerModule = new ErrorHandlerModule(testConfig);
      await errorHandlerModule.initialize();
      await errorHandlerModule.start();
    });

    test('should handle response_in stage with error detection', async () => {
      const input = {
        stage: 'response_in',
        error: new Error('Response error'),
        metadata: {}
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.errorHandler).toBeDefined();
      expect(result.metadata.errorHandler.stage).toBe('response_in');
      expect(result.metadata.errorHandler.errorReceivedAt).toBeDefined();
      expect(result.metadata.errorHandler.handled).toBe(true);
    });

    test('should handle response_process stage with result processing', async () => {
      const input = {
        stage: 'response_process',
        errorHandlingResult: {
          handled: true,
          strategy: ErrorHandlingStrategy.RETRY,
          retryCount: 1
        },
        metadata: {
          errorHandler: {
            stage: 'response_in',
            errorReceivedAt: new Date().toISOString(),
            handled: true
          }
        }
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.errorHandlingResult).toBeDefined();
      expect(result.metadata.errorHandler.stage).toBe('response_process');
      expect(result.metadata.errorHandler.processedAt).toBeDefined();
    });

    test('should handle response_out stage with finalization', async () => {
      const input = {
        stage: 'response_out',
        errorHandlingResult: {
          handled: true,
          strategy: ErrorHandlingStrategy.RETRY,
          retryCount: 1
        },
        metadata: {
          errorHandler: {
            stage: 'response_process',
            processedAt: new Date().toISOString()
          }
        }
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.errorHandler.stage).toBe('response_out');
      expect(result.metadata.errorHandler.finalizedAt).toBeDefined();
    });
  });

  describe('Error Handler Specific Functionality', () => {
    beforeEach(async () => {
      errorHandlerModule = new ErrorHandlerModule(testConfig);
      await errorHandlerModule.initialize();
      await errorHandlerModule.start();
    });

    test('should determine error type correctly', async () => {
      const input = {
        stage: 'req_process',
        error: new Error('Network connection failed'),
        metadata: {}
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result.errorHandlingResult).toBeDefined();
      expect(result.errorHandlingResult.errorMessage).toBe('Network connection failed');
    });

    test('should handle error without error data', async () => {
      const input = {
        stage: 'req_process',
        metadata: {
          errorHandler: {
            stage: 'req_in',
            timestamp: new Date().toISOString()
          }
        }
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.errorHandler.stage).toBe('req_process');
      expect(result.metadata.errorHandler.processedAt).toBeDefined();
    });

    test('should handle response without error handling result', async () => {
      const input = {
        stage: 'response_out',
        metadata: {
          errorHandler: {
            stage: 'response_process',
            processedAt: new Date().toISOString()
          }
        }
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.metadata.errorHandler.stage).toBe('response_out');
      expect(result.metadata.errorHandler.finalizedAt).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      errorHandlerModule = new ErrorHandlerModule(testConfig);
      await errorHandlerModule.initialize();
      await errorHandlerModule.start();
    });

    test('should handle disabled module', async () => {
      const disabledConfig = { ...testConfig, enabled: false };
      const disabledModule = new ErrorHandlerModule(disabledConfig);
      await disabledModule.initialize();
      await disabledModule.start();
      
      const input = { stage: 'req_in' };
      
      await expect(disabledModule.process(input))
        .rejects
        .toThrow('Error handler module is disabled');
      
      await disabledModule.destroy();
    });

    test('should handle invalid stage with default processing', async () => {
      const input = {
        stage: 'invalid_stage',
        error: new Error('Test error')
      };

      const result = await errorHandlerModule.process(input);
      
      expect(result).toBeDefined();
      expect(result.stage).toBe('invalid_stage');
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      errorHandlerModule = new ErrorHandlerModule(testConfig);
      await errorHandlerModule.initialize();
      await errorHandlerModule.start();
    });

    test('should return health check information', async () => {
      const health = await errorHandlerModule.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.enabled).toBe(true);
      expect(health.errorCount).toBe(0);
      expect(health.errorStats).toBeDefined();
      expect(health.defaultStrategy).toBe(ErrorHandlingStrategy.RETRY);
      expect(health.maxRetries).toBe(3);
    });

    test('should include base health information', async () => {
      const health = await errorHandlerModule.healthCheck();
      
      expect(health.id).toBe(errorHandlerModule.getId());
      expect(health.name).toBe(errorHandlerModule.getName());
      expect(health.version).toBe(errorHandlerModule.getVersion());
      expect(health.state).toBe(errorHandlerModule.getState());
      expect(health.createdAt).toBeDefined();
      expect(health.updatedAt).toBeDefined();
    });
  });
});
EOF < /dev/null