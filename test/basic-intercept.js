#!/usr/bin/env node
/**
 * 基础的Claude Code请求拦截器 - 使用原生HTTP模块
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CAPTURE_PORT = 3456;
const ROUTER_PORT = 3457;
const TEST_DATA_DIR = path.join(__dirname, 'captured-data');

// 确保目录存在
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

let captureCount = 0;

const server = http.createServer((req, res) => {
  console.log(`\\n📥 [${++captureCount}] ${req.method} ${req.url}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'N/A'}`);
  console.log(`   Content-Type: ${req.headers['content-type'] || 'N/A'}`);

  // 收集请求体
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    let parsedBody = null;
    
    // 尝试解析JSON
    if (body && req.headers['content-type']?.includes('application/json')) {
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {
        console.log('⚠️  无法解析JSON:', e.message);
      }
    }

    // 捕获请求数据
    const capturedRequest = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: parsedBody,
      rawBody: body,
      captureIndex: captureCount
    };

    // 如果是Claude Code的消息请求 (可能包含query参数)
    const urlPath = req.url.split('?')[0];
    if (urlPath === '/v1/messages' && req.method === 'POST' && parsedBody) {
      console.log('🎯 Claude Code消息请求!');
      console.log(`   Model: ${parsedBody.model || 'N/A'}`);
      console.log(`   Stream: ${parsedBody.stream || false}`);
      console.log(`   Messages: ${parsedBody.messages ? parsedBody.messages.length : 0}`);
      
      if (parsedBody.messages && parsedBody.messages[0]) {
        const content = parsedBody.messages[0].content;
        const preview = typeof content === 'string' ? content : JSON.stringify(content);
        console.log(`   Content: ${preview.substring(0, 100)}...`);
      }

      // 保存捕获的请求
      const filename = path.join(TEST_DATA_DIR, `claude-request-${captureCount}.json`);
      fs.writeFileSync(filename, JSON.stringify(capturedRequest, null, 2));
      console.log(`   ✅ 已保存到: ${filename}`);

      // 转发到路由器
      console.log('🔄 转发到路由器...');
      
      const postData = JSON.stringify(parsedBody);
      const options = {
        hostname: '127.0.0.1',
        port: ROUTER_PORT,
        path: req.url, // 保持完整的URL包括query参数
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': req.headers.authorization || 'Bearer test-key'
        }
      };

      const proxyReq = http.request(options, (proxyRes) => {
        console.log(`📤 路由器响应: ${proxyRes.statusCode}`);
        
        // 转发响应头
        Object.keys(proxyRes.headers).forEach(key => {
          res.setHeader(key, proxyRes.headers[key]);
        });
        
        res.statusCode = proxyRes.statusCode;
        
        // 转发响应体
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('❌ 转发错误:', err.message);
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Router forwarding failed',
          message: err.message
        }));
      });

      // 发送请求数据
      proxyReq.write(postData);
      proxyReq.end();

    } else if (req.url === '/health') {
      // 健康检查
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        status: 'intercepting', 
        captureCount,
        timestamp: new Date().toISOString()
      }));
      
    } else if (req.url === '/status') {
      // 状态检查
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        server: 'claude-request-interceptor',
        version: '1.0.0',
        captureCount,
        timestamp: new Date().toISOString()
      }));
      
    } else {
      // 其他请求
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json'); 
      res.end(JSON.stringify({
        error: 'Not found',
        intercepted: true,
        url: req.url
      }));
    }
  });
});

server.listen(CAPTURE_PORT, '127.0.0.1', () => {
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