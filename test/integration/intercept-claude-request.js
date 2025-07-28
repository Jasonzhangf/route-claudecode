#!/usr/bin/env node
/**
 * 拦截Claude Code真实请求的工具
 * 在请求进入路由器服务之前进行捕获
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const CAPTURE_PORT = 3456;  // Claude Code会连接到这个端口
const ROUTER_PORT = 3457;   // 实际的路由器服务端口
const TEST_DATA_DIR = path.join(__dirname, 'captured-data');
const CLAUDE_REQUEST_FILE = path.join(TEST_DATA_DIR, 'real-claude-request.json');

// 确保目录存在
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

const app = express();

// 用于捕获请求体的中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: '*/*', limit: '10mb' }));

let requestCaptured = false;
let captureCount = 0;

// 拦截中间件 - 捕获并转发
app.use('*', (req, res, next) => {
  if (req.path === '/health' || req.path === '/status') {
    return next();
  }

  console.log(`\\n📥 [${++captureCount}] 捕获到Claude Code请求:`);
  console.log(`   Method: ${req.method}`);
  console.log(`   Path: ${req.path}`);
  console.log(`   User-Agent: ${req.headers['user-agent']}`);
  console.log(`   Content-Type: ${req.headers['content-type']}`);
  
  // 捕获完整的请求数据
  const capturedRequest = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
    query: req.query,
    captureIndex: captureCount
  };

  // 分析请求
  if (req.body && typeof req.body === 'object') {
    console.log(`   Model: ${req.body.model || 'N/A'}`);
    console.log(`   Stream: ${req.body.stream || false}`);
    console.log(`   Messages: ${req.body.messages ? req.body.messages.length : 0}`);
    console.log(`   Max tokens: ${req.body.max_tokens || 'N/A'}`);
    
    if (req.body.messages && req.body.messages[0] && req.body.messages[0].content) {
      const content = req.body.messages[0].content;
      const preview = typeof content === 'string' ? content.substring(0, 100) : JSON.stringify(content).substring(0, 100);
      console.log(`   Content preview: ${preview}...`);
    }
  }

  // 保存第一个有效的/v1/messages请求
  if (req.path === '/v1/messages' && req.method === 'POST' && !requestCaptured) {
    const filename = CLAUDE_REQUEST_FILE.replace('.json', `-${captureCount}.json`);
    fs.writeFileSync(filename, JSON.stringify(capturedRequest, null, 2));
    console.log(`   ✅ 已保存到: ${filename}`);
    requestCaptured = true;
  }

  // 继续处理请求
  next();
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'intercepting',
    captured: requestCaptured,
    count: captureCount
  });
});

app.get('/status', (req, res) => {
  res.json({
    server: 'claude-request-interceptor',
    version: '1.0.0',
    captured: requestCaptured,
    captureCount: captureCount,
    timestamp: new Date().toISOString()
  });
});

// 代理中间件 - 转发到真实的路由器
const proxyOptions = {
  target: `http://127.0.0.1:${ROUTER_PORT}`,
  changeOrigin: true,
  selfHandleResponse: false,
  onError: (err, req, res) => {
    console.error('❌ 代理错误:', err.message);
    res.status(502).json({
      error: 'Router not available',
      message: '请确保路由器服务器运行在端口 ' + ROUTER_PORT
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 转发请求到路由器: ${req.method} ${req.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`📤 路由器响应: ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
  }
};

app.use('*', createProxyMiddleware(proxyOptions));

// 启动拦截服务器
const server = app.listen(CAPTURE_PORT, '127.0.0.1', () => {
  console.log('🎯 Claude Code请求拦截器启动');
  console.log(`📍 拦截端口: ${CAPTURE_PORT}`);
  console.log(`🎯 转发到路由器端口: ${ROUTER_PORT}`);
  console.log('\\n📋 使用步骤:');
  console.log('   1. 在另一个终端启动路由器服务:');
  console.log(`      ccr start --port ${ROUTER_PORT} --debug`);
  console.log('   2. 设置环境变量:');
  console.log(`      export ANTHROPIC_BASE_URL="http://127.0.0.1:${CAPTURE_PORT}"`);
  console.log('      export ANTHROPIC_API_KEY="test-key"');
  console.log('   3. 运行Claude Code:');
  console.log('      claude "hello test"');
  console.log('   4. 请求将被捕获并转发到路由器\\n');
  console.log('⏳ 等待Claude Code请求...');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\\n🛑 关闭拦截器...');
  server.close(() => {
    console.log('✅ 拦截器已关闭');
    
    if (requestCaptured) {
      console.log('\\n📊 捕获总结:');
      console.log(`   总请求数: ${captureCount}`);
      console.log(`   已保存请求文件到: ${TEST_DATA_DIR}`);
      console.log('💡 现在可以使用捕获的数据进行流水线测试!');
    } else {
      console.log('⚠️  没有捕获到有效的Claude Code请求');
    }
    
    process.exit(0);
  });
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的Promise拒绝:', reason);
  process.exit(1);
});