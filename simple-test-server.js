#!/usr/bin/env node

/**
 * 简单的测试服务器 - 验证HTTP绑定问题
 */

const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }
  
  if (req.url === '/v1/messages' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      console.log(`📦 Request body: ${body}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: 'test-model',
        content: [
          {
            type: 'text',
            text: 'Test response from simple server'
          }
        ],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 8
        }
      }));
    });
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const PORT = 5506;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Simple test server running on http://${HOST}:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Anthropic API: http://localhost:${PORT}/v1/messages`);
});

server.on('error', (error) => {
  console.error(`❌ Server error:`, error);
});