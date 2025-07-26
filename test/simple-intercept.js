#!/usr/bin/env node
/**
 * 简化的Claude Code请求拦截器
 * 捕获后手动转发到路由器
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CAPTURE_PORT = 3456;
const ROUTER_PORT = 3457;
const TEST_DATA_DIR = path.join(__dirname, 'captured-data');

// 确保目录存在
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

const app = express();
app.use(express.json({ limit: '10mb' }));

let captureCount = 0;

// 拦截所有请求
app.all('*', async (req, res) => {
  console.log(`\\n📥 [${++captureCount}] 捕获Claude Code请求:`);
  console.log(`   ${req.method} ${req.path}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'N/A'}`);
  
  // 捕获数据
  const capturedRequest = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
    query: req.query,
    captureIndex: captureCount
  };

  // 如果是/v1/messages请求，分析并保存
  if (req.path === '/v1/messages' && req.method === 'POST') {
    console.log('🎯 这是Claude Code的消息请求!');
    
    if (req.body) {
      console.log(`   Model: ${req.body.model || 'N/A'}`);
      console.log(`   Stream: ${req.body.stream || false}`);
      console.log(`   Messages: ${req.body.messages ? req.body.messages.length : 0}`);
      
      if (req.body.messages && req.body.messages[0]) {
        const content = req.body.messages[0].content;
        const preview = typeof content === 'string' ? content : JSON.stringify(content);
        console.log(`   Content: ${preview.substring(0, 100)}...`);
      }
    }

    // 保存真实的Claude Code请求
    const filename = path.join(TEST_DATA_DIR, `claude-request-${captureCount}.json`);
    fs.writeFileSync(filename, JSON.stringify(capturedRequest, null, 2));
    console.log(`   ✅ 已保存到: ${filename}`);
    
    // 转发到路由器
    console.log('🔄 转发到路由器...');
    try {
      const forwardResponse = await axios({
        method: req.method,
        url: `http://127.0.0.1:${ROUTER_PORT}${req.path}`,
        data: req.body,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || 'Bearer test-key'
        },
        responseType: req.body.stream ? 'stream' : 'json',
        timeout: 30000
      });

      // 设置响应头
      Object.keys(forwardResponse.headers).forEach(key => {
        res.set(key, forwardResponse.headers[key]);
      });
      
      res.status(forwardResponse.status);

      if (req.body.stream) {
        // 流式响应
        console.log('📡 转发流式响应...');
        forwardResponse.data.pipe(res);
      } else {
        // 普通响应
        console.log('📤 转发普通响应...');
        res.json(forwardResponse.data);
      }

    } catch (error) {
      console.error('❌ 转发失败:', error.message);
      res.status(502).json({
        error: 'Router forwarding failed',
        message: error.message
      });
    }
    
  } else if (req.path === '/health') {
    // 健康检查
    res.json({ 
      status: 'intercepting', 
      captureCount,
      timestamp: new Date().toISOString()
    });
    
  } else if (req.path === '/status') {
    // 状态检查
    res.json({
      server: 'claude-request-interceptor',
      version: '1.0.0',
      captureCount,
      timestamp: new Date().toISOString()
    });
    
  } else {
    // 其他请求直接返回404
    res.status(404).json({
      error: 'Not found',
      intercepted: true,
      path: req.path
    });
  }
});

// 启动服务器
const server = app.listen(CAPTURE_PORT, '127.0.0.1', () => {
  console.log('🎯 Claude Code请求拦截器启动');
  console.log(`📍 监听端口: ${CAPTURE_PORT}`);
  console.log(`🎯 转发到: http://127.0.0.1:${ROUTER_PORT}`);
  console.log('\\n📋 使用步骤:');
  console.log('   1. 确保路由器已在端口3457运行');
  console.log('   2. 设置环境变量:');
  console.log(`      export ANTHROPIC_BASE_URL="http://127.0.0.1:${CAPTURE_PORT}"`);
  console.log('      export ANTHROPIC_API_KEY="test-key"');
  console.log('   3. 运行: claude "hello test"');
  console.log('\\n⏳ 等待Claude Code请求...');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\\n🛑 关闭拦截器...');
  server.close(() => {
    console.log(`✅ 共捕获 ${captureCount} 个请求`);
    console.log(`📁 数据保存在: ${TEST_DATA_DIR}`);
    process.exit(0);
  });
});