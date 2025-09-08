/**
 * HTTP服务器集成测试
 * 
 * 验证完整的Config→Router→Pipeline→Assembly→HTTP流程
 */

import { StartupService } from '../../../bootstrap/src/startup-service';
import { JQJsonHandler } from '../../../utils/jq-json-handler';

describe('HTTP服务器集成测试', () => {
  const configPath = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511-standard.json';
  let startupService: StartupService;
  let server: any;

  beforeAll(async () => {
    // 使用正确的启动服务创建和初始化服务器
    startupService = new StartupService();
  });

  afterAll(async () => {
    try {
      console.log('🧹 开始清理测试资源...');
      
      // 1. 停止HTTP服务器
      if (server && typeof server.stop === 'function') {
        console.log('🛑 停止HTTP服务器...');
        await server.stop();
      }
      
      // 2. 停止启动服务（包含所有子服务）
      if (startupService && typeof startupService.stop === 'function') {
        console.log('🛑 停止启动服务...');
        await startupService.stop();
      }
      
      // 3. 等待一小段时间确保异步操作完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('✅ 测试资源清理完成');
    } catch (error) {
      console.warn('⚠️ 清理测试资源时出错:', error);
      // 不抛出错误，避免影响测试结果
    }
  });

  test('应该成功初始化流水线系统', async () => {
    try {
      // 使用启动服务启动完整系统
      const result = await startupService.start({
        configPath,
        port: 5513, // 使用不同端口避免冲突
        host: '0.0.0.0',
        debug: false // 减少调试日志输出
      });
      
      expect(result.success).toBe(true);
      expect(result.server).toBeDefined();
      server = result.server;
      
      // 验证服务器状态
      const status = server.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.port).toBe(5513);
      expect(status.host).toBe('0.0.0.0');
      
      console.log('🎉 HTTP服务器成功启动并初始化流水线系统');
      console.log(`📊 活跃流水线数量: ${status.activePipelines || 0}`);
    } catch (error) {
      console.error('❌ HTTP服务器启动失败:', error);
      throw error;
    }
  }, 15000);

  test('应该创建完整的Config→Router→Pipeline→Assembly流程', async () => {
    try {
      // 确保服务器已启动
      expect(server).toBeDefined();
      
      // 验证流水线初始化
      const status = server.getStatus();
      expect(status).toBeDefined();
      expect(status.activePipelines).toBeGreaterThan(0);
      
      console.log('✅ 完整的Config→Router→Pipeline→Assembly流程已建立');
      console.log(`📊 活跃流水线数量: ${status.activePipelines}`);
    } catch (error) {
      console.error('❌ 流水线系统验证失败:', error);
      throw error;
    }
  }, 5000);

  test('应该提供OpenAI兼容的/v1/chat/completions端点', async () => {
    try {
      // 确保服务器已启动
      expect(server).toBeDefined();
      
      // 创建测试请求上下文（避免硬编码值）
      const testRequestId = `test-request-${Date.now()}`;
      const testMaxTokens = 100;
      
      const realRequest = {
        id: testRequestId,
        startTime: new Date(),
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'content-type': 'application/json' },
        query: {},
        params: {},
        body: {
          messages: [
            {
              role: 'user',
              content: '测试HTTP服务器集成'
            }
          ],
          max_tokens: testMaxTokens
        },
        metadata: {}
      };

      const realResponse = {
        req: realRequest,
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: undefined as any,
        sent: false
      };

      // 测试聊天完成处理器
      await (server as any).handleChatCompletions(realRequest, realResponse);
      
      // 验证响应
      expect(realResponse.statusCode).toBe(200);
      expect(realResponse.body).toBeDefined();
      expect(realResponse.headers['X-Pipeline-ID']).toBeDefined();
      
      console.log('✅ OpenAI兼容端点测试成功');
      console.log(`📊 响应状态码: ${realResponse.statusCode}`);
    } catch (error) {
      console.error('❌ OpenAI端点测试失败:', error);
      throw error;
    }
  }, 8000);
});