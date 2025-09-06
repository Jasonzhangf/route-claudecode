/**
 * HTTP服务器集成测试
 * 
 * 验证完整的Config→Router→Pipeline→Assembly→HTTP流程
 */

import { HTTPServer } from '../http-server';
import { JQJsonHandler } from '../../../error-handler/src/utils/jq-json-handler';

describe('HTTP服务器集成测试', () => {
  const configPath = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511-standard.json';
  let server: HTTPServer;

  beforeAll(() => {
    // 创建HTTP服务器实例，集成配置文件路径
    server = new HTTPServer({
      port: 5511,
      host: '0.0.0.0',
      debug: true
    }, configPath);
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  test('应该成功初始化流水线系统', async () => {
    // 启动服务器（包含流水线初始化）
    await server.start();
    
    // 验证服务器状态
    const status = server.getStatus();
    expect(status.isRunning).toBe(true);
    expect(status.port).toBe(5511);
    expect(status.host).toBe('0.0.0.0');
    
    console.log('🎉 HTTP服务器成功启动并初始化流水线系统');
    console.log(`📊 服务器状态: ${JQJsonHandler.stringifyJson(status, true)}`);
  }, 30000);

  test('应该创建完整的Config→Router→Pipeline→Assembly流程', async () => {
    // 服务器已启动，验证流水线初始化
    const status = server.getStatus();
    expect(status.activePipelines).toBeGreaterThan(0);
    
    console.log('✅ 完整的Config→Router→Pipeline→Assembly流程已建立');
    console.log(`📊 活跃流水线数量: ${status.activePipelines}`);
  });

  test('应该提供OpenAI兼容的/v1/chat/completions端点', async () => {
    // 创建真实的请求上下文
    const realRequest = {
      id: 'test-request-1',
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
        max_tokens: 100
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
    console.log(`📊 Pipeline ID: ${realResponse.headers['X-Pipeline-ID']}`);
  });
});