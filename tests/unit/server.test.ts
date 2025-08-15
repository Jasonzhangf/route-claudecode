/**
 * HTTP服务器测试
 * 
 * 测试HTTP服务器核心功能、中间件、路由等
 * 
 * @author Jason Zhang
 */

import { HTTPServer } from '../../src/server/http-server';
import { Router } from '../../src/routes/router';
import { setupApiRoutes } from '../../src/routes/api-routes';
import { setupProxyRoutes } from '../../src/routes/proxy-routes';
import { cors, logger, rateLimit } from '../../src/middleware';

describe('RCC v4.0 HTTP Server', () => {
  let server: HTTPServer;
  let router: Router;
  let port: number;
  
  beforeEach(() => {
    port = 3000 + Math.floor(Math.random() * 1000); // 随机端口避免冲突
    server = new HTTPServer({ 
      port, 
      host: 'localhost', 
      debug: false 
    });
    router = new Router(server);
  });
  
  afterEach(async () => {
    if (server) {
      try {
        await server.stop();
      } catch (error) {
        // 忽略停止错误
      }
    }
  });
  
  describe('Basic Server Operations', () => {
    it('should create server with correct configuration', () => {
      expect(server).toBeInstanceOf(HTTPServer);
      
      const status = server.getStatus();
      expect(status.port).toBe(port);
      expect(status.host).toBe('localhost');
      expect(status.isRunning).toBe(false);
    });
    
    it('should start and stop server successfully', async () => {
      expect(server.getStatus().isRunning).toBe(false);
      
      await server.start();
      expect(server.getStatus().isRunning).toBe(true);
      expect(server.getStatus().startTime).toBeInstanceOf(Date);
      
      await server.stop();
      expect(server.getStatus().isRunning).toBe(false);
    });
    
    it('should handle start/stop errors correctly', async () => {
      await server.start();
      
      // 尝试重复启动应该失败
      await expect(server.start()).rejects.toThrow('Server is already running');
      
      await server.stop();
      
      // 尝试停止已停止的服务器应该失败
      await expect(server.stop()).rejects.toThrow('Server is not running');
    });
    
    it('should track request count and uptime', async () => {
      await server.start();
      
      const status1 = server.getStatus();
      expect(status1.totalRequests).toBe(0);
      
      // 发送健康检查请求
      const response = await fetch(`http://localhost:${port}/health`);
      expect(response.ok).toBe(true);
      
      const status2 = server.getStatus();
      expect(status2.totalRequests).toBe(1);
      expect(status2.uptime).toBeTruthy();
      
      await server.stop();
    });
  });
  
  describe('Default Routes', () => {
    beforeEach(async () => {
      await server.start();
    });
    
    it('should respond to health check', async () => {
      const response = await fetch(`http://localhost:${port}/health`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('checks');
      expect(Array.isArray(data.checks)).toBe(true);
    });
    
    it('should respond to status endpoint', async () => {
      const response = await fetch(`http://localhost:${port}/status`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('isRunning', true);
      expect(data).toHaveProperty('port', port);
      expect(data).toHaveProperty('host', 'localhost');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('health');
    });
    
    it('should respond to version endpoint', async () => {
      const response = await fetch(`http://localhost:${port}/version`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('name', 'RCC (Route Claude Code)');
      expect(data).toHaveProperty('version', '4.0.0-alpha.1');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('author');
    });
    
    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`http://localhost:${port}/unknown-route`);
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Not Found');
    });
  });
  
  describe('Router Integration', () => {
    beforeEach(async () => {
      // 添加测试路由
      router.get('/test', async (req, res, params) => {
        res.body = { message: 'Test route', params };
      });
      
      router.get('/test/:id', async (req, res, params) => {
        res.body = { message: 'Test route with param', id: params.id };
      });
      
      await server.start();
    });
    
    it('should handle basic route', async () => {
      const response = await fetch(`http://localhost:${port}/test`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('message', 'Test route');
      expect(data).toHaveProperty('params', {});
    });
    
    it('should handle parameterized routes', async () => {
      const response = await fetch(`http://localhost:${port}/test/123`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('message', 'Test route with param');
      expect(data).toHaveProperty('id', '123');
    });
    
    it('should handle POST requests with body', async () => {
      router.post('/echo', async (req, res, params) => {
        res.body = { echo: req.body };
      });
      
      const testData = { message: 'Hello, world!' };
      const response = await fetch(`http://localhost:${port}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('echo');
      expect(data.echo).toEqual(testData);
    });
  });
  
  describe('Middleware System', () => {
    beforeEach(async () => {
      await server.start();
    });
    
    it('should apply CORS middleware', async () => {
      router.get('/cors-test', async (req, res, params) => {
        res.body = { message: 'CORS test' };
      }, [cors({ origin: '*' })]);
      
      const response = await fetch(`http://localhost:${port}/cors-test`);
      expect(response.ok).toBe(true);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
    
    it('should apply rate limiting middleware', async () => {
      router.get('/rate-limit-test', async (req, res, params) => {
        res.body = { message: 'Rate limit test' };
      }, [rateLimit({ maxRequests: 2, windowMs: 1000 })]);
      
      // 第一个请求应该成功
      const response1 = await fetch(`http://localhost:${port}/rate-limit-test`);
      expect(response1.ok).toBe(true);
      expect(response1.headers.get('X-RateLimit-Remaining')).toBe('1');
      
      // 第二个请求应该成功
      const response2 = await fetch(`http://localhost:${port}/rate-limit-test`);
      expect(response2.ok).toBe(true);
      expect(response2.headers.get('X-RateLimit-Remaining')).toBe('0');
      
      // 第三个请求应该被限制
      const response3 = await fetch(`http://localhost:${port}/rate-limit-test`);
      expect(response3.status).toBe(429);
    });
    
    it('should chain multiple middleware', async () => {
      let middlewareOrder: string[] = [];
      
      const middleware1 = (req: any, res: any, next: any) => {
        middlewareOrder.push('middleware1');
        next();
      };
      
      const middleware2 = (req: any, res: any, next: any) => {
        middlewareOrder.push('middleware2');
        next();
      };
      
      router.get('/middleware-chain', async (req, res, params) => {
        middlewareOrder.push('handler');
        res.body = { order: middlewareOrder };
      }, [middleware1, middleware2]);
      
      const response = await fetch(`http://localhost:${port}/middleware-chain`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.order).toEqual(['middleware1', 'middleware2', 'handler']);
    });
  });
  
  describe('API Routes', () => {
    beforeEach(async () => {
      setupApiRoutes(router);
      await server.start();
    });
    
    it('should respond to API info endpoint', async () => {
      const response = await fetch(`http://localhost:${port}/api/v1/info`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('name', 'RCC (Route Claude Code)');
      expect(data).toHaveProperty('version', '4.0.0-alpha.1');
      expect(data).toHaveProperty('features');
      expect(Array.isArray(data.features)).toBe(true);
    });
    
    it('should respond to providers endpoint', async () => {
      const response = await fetch(`http://localhost:${port}/api/v1/providers`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('providers');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.providers)).toBe(true);
    });
    
    it('should respond to pipelines endpoint', async () => {
      const response = await fetch(`http://localhost:${port}/api/v1/pipelines`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('pipelines');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.pipelines)).toBe(true);
    });
    
    it('should respond to config endpoint', async () => {
      const response = await fetch(`http://localhost:${port}/api/v1/config`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('server');
      expect(data).toHaveProperty('routing');
    });
  });
  
  describe('Proxy Routes', () => {
    beforeEach(async () => {
      setupProxyRoutes(router);
      await server.start();
    });
    
    it('should handle Anthropic proxy requests', async () => {
      const requestBody = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello, world!' }
        ]
      };
      
      const response = await fetch(`http://localhost:${port}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('type', 'message');
      expect(data).toHaveProperty('role', 'assistant');
      expect(data).toHaveProperty('content');
      expect(Array.isArray(data.content)).toBe(true);
    });
    
    it('should handle OpenAI proxy requests', async () => {
      const requestBody = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello, world!' }
        ]
      };
      
      const response = await fetch(`http://localhost:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('object', 'chat.completion');
      expect(data).toHaveProperty('choices');
      expect(Array.isArray(data.choices)).toBe(true);
    });
    
    it('should handle universal proxy requests', async () => {
      const requestBody = {
        messages: [{ role: 'user', content: 'Hello, world!' }]
      };
      
      const response = await fetch(`http://localhost:${port}/v1/proxy/anthropic/claude-3-sonnet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('provider', 'anthropic');
      expect(data).toHaveProperty('model', 'claude-3-sonnet');
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('metadata');
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      await server.start();
    });
    
    it('should handle route errors gracefully', async () => {
      router.get('/error-test', async (req, res, params) => {
        throw new Error('Test error');
      });
      
      const response = await fetch(`http://localhost:${port}/error-test`);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
    
    it('should handle malformed JSON requests', async () => {
      router.post('/json-test', async (req, res, params) => {
        res.body = { received: req.body };
      });
      
      const response = await fetch(`http://localhost:${port}/json-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {'
      });
      
      expect(response.status).toBe(500);
    });
    
    it('should handle large request bodies', async () => {
      const largeBody = 'x'.repeat(20 * 1024 * 1024); // 20MB
      
      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: largeBody
      });
      
      expect(response.status).toBe(500);
    });
  });
});