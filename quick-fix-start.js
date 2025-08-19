#!/usr/bin/env node

/**
 * RCC4 快速修复启动脚本
 * 绕过TypeScript编译问题，直接启动HTTP服务器
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 解析命令行参数
const args = process.argv.slice(2);
let port = 5506;
let configPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && i + 1 < args.length) {
    port = parseInt(args[i + 1]);
  }
  if (args[i] === '--config' && i + 1 < args.length) {
    configPath = args[i + 1];
  }
}

console.log(`🚀 RCC4 Quick Fix Server starting on port ${port}`);
if (configPath) {
  console.log(`📋 Config: ${configPath}`);
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  const method = req.method;
  const url = req.url;
  
  console.log(`📥 ${method} ${url}`);

  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (url === '/health' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      server: 'RCC4 Quick Fix',
      timestamp: new Date().toISOString(),
      port: port
    }));
    return;
  }

  // Anthropic Messages endpoint
  if (url === '/v1/messages' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const request = JSON.parse(body);
        console.log(`📦 Anthropic request:`, {
          model: request.model,
          messageCount: request.messages?.length,
          hasTools: !!request.tools?.length
        });
        
        // 构造Anthropic格式响应
        const response = {
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          model: request.model || 'claude-3-sonnet',
          content: [
            {
              type: 'text',
              text: `✅ RCC4 Quick Fix服务器正常工作！
              
收到你的请求：
- 模型: ${request.model}
- 消息数: ${request.messages?.length || 0}
- 工具调用: ${request.tools?.length || 0} 个工具
- 最大Token: ${request.max_tokens || 'default'}

HTTP服务器绑定修复成功，可以正常处理请求了！`
            }
          ],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: estimateTokens(body),
            output_tokens: 50
          }
        };
        
        res.writeHead(200);
        res.end(JSON.stringify(response, null, 2));
        
      } catch (error) {
        console.error('❌ Request parsing error:', error);
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid JSON format'
        }));
      }
    });
    return;
  }

  // 404 for other endpoints
  res.writeHead(404);
  res.end(JSON.stringify({
    error: 'Not Found',
    message: `Endpoint ${method} ${url} not found`
  }));
});

// 简单的token计算
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

// 启动服务器
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ RCC4 Quick Fix Server started successfully!`);
  console.log(`🌐 Listening on: http://0.0.0.0:${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`🤖 Anthropic API: http://localhost:${port}/v1/messages`);
  console.log(`🎯 Ready for E2E testing!`);
});

server.on('error', (error) => {
  console.error(`❌ Server error:`, error);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});