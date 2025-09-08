/**
 * HTTP服务器架构验证测试
 * 
 * 验证HTTP服务器组件化架构的正确性和功能完整性
 * 
 * @author RCC v4.0
 */

import { 
  HTTPServer, 
  HTTPContextManager, 
  HTTPRoutingSystemImpl, 
  HTTPRequestHandlersImpl,
  AnthropicMessageHandlerImpl,
  HTTPErrorCenter,
  ServerConfig
} from '../index';
import { getEnhancedErrorHandler } from '../../../error-handler/src/enhanced-error-handler';

// 测试配置
const TEST_CONFIG: ServerConfig = {
  port: 5507, // 使用不同的端口避免冲突
  host: '127.0.0.1',
  debug: false
};

describe('HTTP Server Component Architecture', () => {
  let server: HTTPServer;

  afterEach(async () => {
    if (server && (server as any).isRunning) {
      try {
        await server.stop();
      } catch (error) {
        // 忽略停止服务器时的错误
      }
    }
  });

  test('should create HTTP server with all components', () => {
    server = new HTTPServer(TEST_CONFIG);
    
    // 验证组件被正确初始化
    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
    expect(typeof server.getStatus).toBe('function');
    expect(typeof server.addRoute).toBe('function');
  });

  test('should have independent component instances', () => {
    server = new HTTPServer(TEST_CONFIG);
    
    // 验证各个组件都被正确创建
    expect((server as any).contextManager).toBeInstanceOf(HTTPContextManager);
    expect((server as any).routingSystem).toBeInstanceOf(HTTPRoutingSystemImpl);
    expect((server as any).requestHandlers).toBeInstanceOf(HTTPRequestHandlersImpl);
    expect((server as any).anthropicHandler).toBeInstanceOf(AnthropicMessageHandlerImpl);
    
    // 验证错误处理器被正确初始化
    expect((server as any).errorHandler).toBeDefined();
    expect((server as any).httpErrorCenter).toBeInstanceOf(HTTPErrorCenter);
  });

  test('should allow component interaction through public interface', () => {
    server = new HTTPServer(TEST_CONFIG);
    
    // 验证可以添加路由
    expect(() => {
      server.addRoute('GET', '/test', async (req, res) => {
        res.statusCode = 200;
        res.body = { message: 'test' };
      });
    }).not.toThrow();
    
    // 验证可以获取状态
    const status = server.getStatus();
    expect(status).toBeDefined();
    expect(status.isRunning).toBe(false);
    expect(status.port).toBe(TEST_CONFIG.port);
  });

  test('should handle component communication properly', () => {
    // 创建独立的组件实例
    const contextManager = new HTTPContextManager(TEST_CONFIG);
    const routingSystem = new HTTPRoutingSystemImpl();
    const requestHandlers = new HTTPRequestHandlersImpl();
    const errorHandler = getEnhancedErrorHandler(TEST_CONFIG.port);
    const httpErrorCenter = new HTTPErrorCenter(errorHandler, TEST_CONFIG.debug);
    
    // 验证所有组件都能独立工作
    expect(contextManager).toBeDefined();
    expect(routingSystem).toBeDefined();
    expect(requestHandlers).toBeDefined();
    expect(httpErrorCenter).toBeDefined();
    
    // 验证路由系统功能
    const routeStats = routingSystem.getRouteStats();
    expect(routeStats).toBeDefined();
    expect(typeof routeStats.totalRoutes).toBe('number');
  });
});