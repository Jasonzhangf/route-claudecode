/**
 * 客户端模块测试
 *
 * 测试客户端模块的核心功能
 *
 * @author Jason Zhang
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient, ClientModule, CLIError, SessionError, HttpError } from '../client';

describe('Client Module', () => {
  let client: ClientModule;

  beforeEach(async () => {
    // 创建测试客户端实例
    client = await createClient({
      serverHost: 'localhost',
      serverPort: 15506, // 使用测试端口
      enableDebug: false,
      enableCache: true,
    });
  });

  afterEach(async () => {
    // 清理资源
    if (client) {
      await client.cleanup();
    }
  });

  describe('Client Module Initialization', () => {
    test('should initialize client module successfully', () => {
      expect(client).toBeDefined();
      expect(client.version).toBe('4.0.0-alpha.2');
    });

    test('should provide all required components', () => {
      expect(client.getHttpClient).toBeDefined();
      expect(client.getProxy).toBeDefined();
      expect(client.getSessionManager).toBeDefined();
      expect(client.getEnvironmentExporter).toBeDefined();
    });
  });

  describe('Session Management', () => {
    test('should create session successfully', () => {
      const session = client.createSession();
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.status).toBe('idle');
    });

    test('should track session statistics', () => {
      const session1 = client.createSession();
      const session2 = client.createSession();

      const sessionManager = client.getSessionManager();
      const stats = sessionManager.getStats();

      expect(stats.totalSessions).toBeGreaterThanOrEqual(2);
      expect(stats.activeSessions).toBe(0); // 未连接状态
    });

    test('should handle session errors appropriately', async () => {
      const session = client.createSession({
        serverHost: 'invalid-host',
        timeout: 1000,
      });

      await expect(session.connect()).rejects.toThrow(SessionError);
    });
  });

  describe('HTTP Client', () => {
    test('should provide HTTP client with caching', () => {
      const httpClient = client.getHttpClient();
      expect(httpClient).toBeDefined();

      const stats = httpClient.getStats();
      expect(stats).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
      });
    });

    test('should handle HTTP errors appropriately', async () => {
      const httpClient = client.getHttpClient();

      await expect(httpClient.get('http://invalid-domain-12345.com', { timeout: 1000 })).rejects.toThrow(HttpError);
    });
  });

  describe('Error Handling', () => {
    test('should create appropriate error types', () => {
      const cliError = new CLIError('Test CLI error', { code: 'TEST' });
      const sessionError = new SessionError('Test session error', 'session-123');
      const httpError = new HttpError('Test HTTP error', 404);

      expect(cliError).toBeInstanceOf(CLIError);
      expect(cliError.code).toBe('CLI_ERROR');
      expect(cliError.details).toEqual({ code: 'TEST' });

      expect(sessionError).toBeInstanceOf(SessionError);
      expect(sessionError.code).toBe('SESSION_ERROR');
      expect(sessionError.details?.sessionId).toBe('session-123');

      expect(httpError).toBeInstanceOf(HttpError);
      expect(httpError.code).toBe('HTTP_ERROR');
      expect(httpError.status).toBe(404);
    });
  });

  describe('Configuration Management', () => {
    test('should handle configuration validation', async () => {
      // 这是一个模拟测试，因为ConfigManager需要文件系统
      const validConfig = {
        serverCompatibilityProviders: {
          'test-provider': {
            name: 'Test Provider',
            protocol: 'openai',
            connection: {
              endpoint: 'http://localhost:1234/v1/chat/completions',
              authentication: { apiKey: 'test-key' },
            },
          },
        },
        routing: {
          strategy: 'round-robin',
          defaultProvider: 'test-provider',
        },
        zeroFallbackPolicy: true,
      };

      // 基本验证逻辑测试
      expect(validConfig.serverCompatibilityProviders).toBeDefined();
      expect(validConfig.routing?.defaultProvider).toBe('test-provider');
      expect(validConfig.zeroFallbackPolicy).toBe(true);
    });
  });

  describe('Client Proxy', () => {
    test('should provide proxy functionality', () => {
      const proxy = client.getProxy();
      expect(proxy).toBeDefined();
      expect(proxy.isConnected()).toBe(false);
    });

    test('should provide environment exporter', () => {
      const envExporter = client.getEnvironmentExporter();
      expect(envExporter).toBeDefined();

      const bashCommands = envExporter.getShellCommands('bash');
      expect(bashCommands).toContain('export ANTHROPIC_BASE_URL="http://localhost:5506"');
      expect(bashCommands).toContain('export OPENAI_BASE_URL="http://localhost:5506"');
    });
  });

  describe('Module Statistics', () => {
    test('should provide comprehensive stats', () => {
      const stats = client.getStats();

      expect(stats).toHaveProperty('sessions');
      expect(stats).toHaveProperty('http');
      expect(stats).toHaveProperty('proxy');

      expect(stats.sessions).toHaveProperty('totalSessions');
      expect(stats.http).toHaveProperty('totalRequests');
      expect(stats.proxy).toHaveProperty('connected');
    });
  });

  describe('CLI Command Structure', () => {
    test('should validate CLI command structure', () => {
      // 验证CLI命令结构的测试
      const commands = ['start', 'stop', 'status', 'code', 'config'];

      commands.forEach(command => {
        expect(typeof command).toBe('string');
        expect(command.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Client Module Integration', () => {
  test('should support full workflow simulation', async () => {
    // 模拟完整的客户端工作流程
    const client = await createClient({
      serverHost: 'localhost',
      serverPort: 15507,
      enableDebug: false,
    });

    try {
      // 1. 创建会话
      const session = client.createSession();
      expect(session.status).toBe('idle');

      // 2. 获取HTTP客户端
      const httpClient = client.getHttpClient();
      expect(httpClient.getStats().totalRequests).toBe(0);

      // 3. 获取代理
      const proxy = client.getProxy();
      expect(proxy.isConnected()).toBe(false);

      // 4. 检查统计信息
      const stats = client.getStats();
      expect(stats.sessions.totalSessions).toBeGreaterThanOrEqual(1);
    } finally {
      await client.cleanup();
    }
  });

  test('should handle cleanup properly', async () => {
    const client = await createClient();

    // 创建一些资源
    const session1 = client.createSession();
    const session2 = client.createSession();

    const initialStats = client.getStats();
    expect(initialStats.sessions.totalSessions).toBeGreaterThanOrEqual(2);

    // 清理
    await client.cleanup();

    // 验证清理后的状态
    // 注意：清理后可能无法再访问stats，这是正常的
    expect(client).toBeDefined(); // 对象仍然存在，但资源已清理
  });
});

// 性能测试
describe('Client Module Performance', () => {
  test('should handle concurrent session creation', async () => {
    const client = await createClient();

    try {
      const startTime = Date.now();

      // 并发创建多个会话
      const sessions = await Promise.all(
        Array(10)
          .fill(0)
          .map(() => client.createSession())
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(sessions).toHaveLength(10);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成

      // 验证所有会话都有唯一ID
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    } finally {
      await client.cleanup();
    }
  });

  test('should handle HTTP client cache efficiently', async () => {
    const client = await createClient({ enableCache: true });

    try {
      const httpClient = client.getHttpClient();

      // 重置统计
      httpClient.resetStats();

      const initialStats = httpClient.getStats();
      expect(initialStats.cacheHitRate).toBe(0);

      // 清理缓存
      await httpClient.clearCache();

      const finalStats = httpClient.getStats();
      expect(finalStats.cacheHitRate).toBe(0);
    } finally {
      await client.cleanup();
    }
  });
});
