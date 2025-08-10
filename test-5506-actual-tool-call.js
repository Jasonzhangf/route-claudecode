#!/usr/bin/env node

/**
 * 测试5506端口实际工具调用功能
 * 直接测试是否真的能正常工作
 */

const http = require('http');

// 实际的工具调用测试
async function testActualToolCall() {
  console.log('🧪 测试5506端口实际工具调用...');
  
  const request = {
    messages: [
      { role: 'user', content: '使用grep搜索当前目录中包含"character"的文件' }
    ],
    tools: [
      {
        name: 'grep',
        description: 'Search for patterns in files',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern' },
            path: { type: 'string', description: 'File or directory path' },
            output_mode: { type: 'string', description: 'Output mode' }
          },
          required: ['pattern']
        }
      }
    ],
    max_tokens: 1024
  };

  try {
    const response = await makeRequest('POST', '/v1/messages', request);
    
    console.log('📊 响应结果:');
    console.log('- Status:', response.status || 'unknown');
    console.log('- Stop reason:', response.stop_reason);
    console.log('- Has content:', !!response.content);
    
    if (response.content) {
      console.log('- Content blocks:', response.content.length);
      response.content.forEach((block, i) => {
        console.log(`  Block ${i+1}: ${block.type}`);
        if (block.type === 'tool_use') {
          console.log(`    Tool: ${block.name}`);
          console.log(`    Input:`, JSON.stringify(block.input, null, 2));
        }
      });
    }

    if (response.error) {
      console.error('❌ 错误响应:', response.error);
    }

    // 判断成功失败
    const hasToolUse = response.content && response.content.some(c => c.type === 'tool_use');
    const isToolCall = response.stop_reason === 'tool_use';
    
    if (hasToolUse && isToolCall) {
      console.log('✅ 工具调用测试成功！');
      return true;
    } else {
      console.log('❌ 工具调用测试失败！');
      console.log('完整响应:', JSON.stringify(response, null, 2));
      return false;
    }

  } catch (error) {
    console.error('❌ 请求错误:', error.message);
    return false;
  }
}

// HTTP请求函数
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          resolve({ error: 'Invalid JSON response', raw: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// 运行测试
testActualToolCall();