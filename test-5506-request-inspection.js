#!/usr/bin/env node

/**
 * 检查发送到5506端口LMStudio的实际请求格式
 * 重点检查工具定义中是否有type="function"字段
 */

const http = require('http');

// 简单的工具调用请求 - Anthropic格式
const anthropicRequest = {
  model: 'qwen3-30b',
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: '请列出当前目录的文件' }]
    }
  ],
  max_tokens: 500,
  tools: [
    {
      name: "LS",
      description: "Lists files and directories in a given path",
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The absolute path to the directory to list"
          }
        },
        required: ["path"]
      }
    }
  ]
};

console.log('🔍 检查发送到LMStudio的请求格式...');
console.log('=' + '='.repeat(70));

async function inspectRequest() {
  // 1. 先检查发送的Anthropic格式请求
  console.log('\n📤 发送的Anthropic格式请求:');
  console.log('工具定义格式:', JSON.stringify(anthropicRequest.tools[0], null, 2));
  
  // 2. 发送请求并捕获错误详情
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(anthropicRequest);
    
    const req = http.request({
      hostname: 'localhost',
      port: 5506,
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
          
          if (res.statusCode !== 200 && response.error) {
            console.log('\n🚨 错误响应详情:');
            console.log('错误类型:', response.error.type);
            console.log('错误消息:', response.error.message);
            
            // 检查是否包含详细的验证错误
            if (response.error.message && typeof response.error.message === 'string') {
              const errorMsg = response.error.message;
              
              // 解析验证错误中的具体字段信息
              if (errorMsg.includes('Invalid discriminator value')) {
                console.log('\n🎯 工具定义验证错误分析:');
                console.log('- 错误类型: 工具定义缺少type字段');
                console.log('- 预期值: "function"');
                
                // 尝试从错误消息中提取路径信息
                const pathMatches = errorMsg.match(/path":\[([^\]]+)\]/g);
                if (pathMatches) {
                  console.log('- 受影响的字段路径:');
                  pathMatches.forEach(match => {
                    console.log(`  ${match}`);
                  });
                }
                
                console.log('\n🔧 问题诊断:');
                console.log('1. Anthropic格式工具定义没有type字段（正常）');
                console.log('2. OpenAI Transformer应该添加type: "function"字段');
                console.log('3. 检查Transformer是否正确应用到5506端口请求');
                console.log('4. 可能是路由层没有正确调用Transformer');
                
                resolve({
                  issue: 'missing_type_field',
                  anthropicFormat: anthropicRequest.tools[0],
                  errorDetails: response.error
                });
                return;
              }
            }
          } else {
            console.log('✅ 请求成功处理');
          }
          
          resolve({
            success: res.statusCode === 200,
            response
          });
          
        } catch (err) {
          console.log('❌ 响应解析失败:', err.message);
          console.log('原始响应:', data);
          resolve({
            parseError: err.message,
            rawData: data
          });
        }
      });
    });
    
    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        console.log('❌ 连接被拒绝 - 5506端口服务未运行');
        console.log('请先启动服务: rcc start --config ~/.route-claude-code/config/single-provider/config-openai-lmstudio-5506.json --debug');
      } else {
        console.log('❌ 请求错误:', err.message);
      }
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
    const result = await inspectRequest();
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 诊断总结:');
    
    if (result.issue === 'missing_type_field') {
      console.log('🚨 确认问题: 工具定义缺少type="function"字段');
      console.log('\n🔍 Root Cause Analysis:');
      console.log('1. Anthropic格式 → OpenAI格式转换过程中type字段丢失');
      console.log('2. 六层架构中的Transformer层没有正确应用');
      console.log('3. 需要检查server.ts中的applyRequestTransformation方法');
      
      console.log('\n🔧 修复建议:');
      console.log('1. 验证server.ts第512行的transformer调用');
      console.log('2. 检查Provider类型匹配逻辑（lmstudio vs openai）');
      console.log('3. 确保lmstudio provider被正确识别为openai类型');
      
    } else if (result.success) {
      console.log('✅ 请求处理成功 - 工具定义格式正确');
    } else {
      console.log('❌ 其他错误 - 需要进一步调查');
    }
    
  } catch (error) {
    console.error('❌ 诊断执行失败:', error.message);
  }
}

main();