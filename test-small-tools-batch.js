#!/usr/bin/env node

/**
 * 测试少量工具定义，包含malformed的一个
 */

const http = require('http');

console.log('🔧 测试少量工具定义处理...');
console.log('=' + '='.repeat(50));

const smallBatchRequest = {
  model: 'claude-4-sonnet',
  messages: [{ role: 'user', content: 'Test with small tools batch' }],
  max_tokens: 1000,
  tools: [
    // 正常工具 1
    {
      name: "LS",
      description: "Lists files and directories",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path" }
        },
        required: ["path"]
      }
    },
    // 正常工具 2
    {
      name: "Read", 
      description: "Reads a file",
      input_schema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "File path" }
        },
        required: ["file_path"]
      }
    },
    // Malformed工具 (这是问题工具)
    {
      name: "ProblematicTool",
      description: "This tool has malformed input_schema",
      input_schema: {
        type: "object",
        properties: {
          test: "invalid_format"  // 错误：应该是对象格式
        }
      }
    }
  ]
};

async function testSmallBatch() {
  console.log('\n📤 发送包含3个工具的请求...');
  console.log(`工具数量: ${smallBatchRequest.tools.length}`);
  console.log(`Malformed工具: ${smallBatchRequest.tools[2].name}`);
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(smallBatchRequest);
    
    const req = http.request({
      hostname: 'localhost',
      port: 3456,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer test-key'
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n📊 响应状态: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.log('❌ 请求失败');
            if (response.error) {
              console.log('🔍 错误详情:');
              console.log(`- 消息: ${response.error.message}`);
              console.log(`- 代码: ${response.error.code}`);
              console.log(`- Provider: ${response.error.provider}`);
              console.log(`- Stage: ${response.error.stage}`);
            }
          } else {
            console.log('✅ 请求成功!');
          }
          
          resolve({ success: res.statusCode === 200, response });
          
        } catch (err) {
          console.log('❌ 响应解析失败:', err.message);
          console.log('原始响应预览:', data.substring(0, 300));
          resolve({ success: false, parseError: err.message });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ 请求错误:', err.message);
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log('❌ 请求超时');
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const result = await testSmallBatch();
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 小批量测试总结:');
    
    if (result.success) {
      console.log('✅ 少量工具定义处理成功');
      console.log('✅ 包含malformed工具的请求被正确修复和处理');
    } else if (result.parseError) {
      console.log('❌ 响应解析错误，可能是网络问题');
    } else {
      console.log('⚠️  少量工具请求仍然失败，工具定义修复可能不完整');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

main();