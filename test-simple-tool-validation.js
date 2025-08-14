#!/usr/bin/env node

/**
 * 简化的工具定义验证测试
 * 专注于复现和修复tools.15格式问题
 */

const http = require('http');

console.log('🔧 测试工具定义格式验证问题...');
console.log('=' + '='.repeat(50));

// 创建最小化的有问题的工具定义
const problematicRequest = {
  model: 'claude-4-sonnet',
  messages: [{ role: 'user', content: 'Test message' }],
  max_tokens: 1000,
  tools: [
    // 正常的工具定义
    {
      name: "ValidTool",
      description: "A valid tool",
      input_schema: {
        type: "object",
        properties: {
          param: { type: "string", description: "Valid parameter" }
        },
        required: ["param"]
      }
    },
    // 有问题的工具定义 - tools.1 (索引1)
    {
      name: "ProblematicTool", 
      description: "This tool has malformed input_schema",
      input_schema: {
        type: "object",
        properties: {
          test: "invalid_format"  // 这个格式是错误的
        }
      }
    }
  ]
};

async function testSimpleToolValidation() {
  console.log('\n📤 发送包含有问题工具定义的请求...');
  console.log(`工具数量: ${problematicRequest.tools.length}`);
  console.log(`有问题的工具: ${problematicRequest.tools[1].name}`);
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(problematicRequest);
    
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
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n📊 响应状态: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.log('❌ 请求失败 - 这是预期的！');
            if (response.error) {
              console.log('🔍 错误详情:');
              console.log(`- 消息: ${response.error.message}`);
              console.log(`- 代码: ${response.error.code}`);
              console.log(`- Provider: ${response.error.provider}`);
              console.log(`- Stage: ${response.error.stage}`);
              
              // 分析错误类型
              if (response.error.message.includes('tools.')) {
                console.log('\n✅ 复现了工具定义格式错误!');
                const match = response.error.message.match(/tools\.(\d+)/);
                if (match) {
                  const toolIndex = parseInt(match[1]);
                  console.log(`❌ 有问题的工具索引: ${toolIndex}`);
                  if (toolIndex < problematicRequest.tools.length) {
                    console.log(`🔍 有问题的工具:`);
                    console.log(JSON.stringify(problematicRequest.tools[toolIndex], null, 2));
                  }
                }
              }
            }
          } else {
            console.log('✅ 请求成功 - 工具定义被正确处理');
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
    const result = await testSimpleToolValidation();
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 测试总结:');
    
    if (result.success) {
      console.log('✅ 工具定义处理正常，没有发现格式问题');
      console.log('说明预处理器成功修复了malformed的input_schema');
    } else if (result.parseError) {
      console.log('❌ 响应解析错误，可能是网络问题');
    } else {
      console.log('⚠️  发现工具定义格式问题，需要改进预处理器的修复逻辑');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

main();