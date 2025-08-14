#!/usr/bin/env node

/**
 * 诊断3456端口工具定义处理问题
 * 检查统一兼容性预处理器的工具定义标准化功能
 */

const http = require('http');

console.log('🔍 诊断3456端口工具定义处理问题...');
console.log('=' + '='.repeat(70));

// 构造有问题的请求来复现错误
const testRequest = {
  model: 'claude-4-sonnet',
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: '请帮我分析一下当前项目的文件结构' }]
    }
  ],
  max_tokens: 2000,
  // 模拟15个工具，包含可能有问题的工具定义
  tools: [
    {
      name: "LS",
      description: "Lists files and directories in a given path",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "The absolute path to the directory to list" }
        },
        required: ["path"]
      }
    },
    {
      name: "Read",
      description: "Reads a file from the local filesystem",
      input_schema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "The absolute path to the file to read" }
        },
        required: ["file_path"]
      }
    },
    // 添加多个工具来复现 tools.14 错误
    ...Array.from({ length: 13 }, (_, i) => ({
      name: `TestTool${i + 3}`,
      description: `Test tool ${i + 3}`,
      input_schema: {
        type: "object",
        properties: {
          param: { type: "string", description: "Test parameter" }
        },
        required: ["param"]
      }
    })),
    // 第15个工具（tools.14），可能有问题的工具定义
    {
      name: "ProblematicTool",
      description: "This tool might have format issues",
      // 故意缺少一些字段或格式不正确
      input_schema: {
        type: "object",
        properties: {
          test: "invalid_format"  // 这可能导致问题
        }
      }
    }
  ]
};

async function testToolDefinitionIssue() {
  console.log('\n📤 发送包含多个工具定义的测试请求...');
  console.log(`工具数量: ${testRequest.tools.length}`);
  console.log(`第15个工具: ${testRequest.tools[14].name}`);
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testRequest);
    
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
      timeout: 30000
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
              console.log('🔍 错误分析:');
              console.log(`- 错误类型: ${response.error.type}`);
              console.log(`- 错误消息: ${response.error.message}`);
              console.log(`- 错误代码: ${response.error.code}`);
              console.log(`- Provider: ${response.error.provider || 'N/A'}`);
              console.log(`- Stage: ${response.error.stage || 'N/A'}`);
              
              // 分析工具定义相关错误
              if (response.error.message.includes('tools.14')) {
                console.log('\n🚨 确认发现tools.14错误！');
                console.log('问题工具定义:');
                console.log(JSON.stringify(testRequest.tools[14], null, 2));
                
                console.log('\n🔧 可能的问题：');
                console.log('1. 工具定义缺少type="function"字段');
                console.log('2. input_schema格式不正确');
                console.log('3. 预处理器的standardizeToolDefinitions函数有问题');
                console.log('4. 工具定义被错误转换或损坏');
              }
            }
            
            resolve({ 
              success: false, 
              error: response.error,
              statusCode: res.statusCode,
              hasToolsError: response.error?.message?.includes('tools.14')
            });
            return;
          }
          
          console.log('✅ 请求成功 - 没有复现工具定义问题');
          resolve({ 
            success: true, 
            response: response 
          });
          
        } catch (err) {
          console.log('❌ 响应解析失败:', err.message);
          console.log('原始响应预览:', data.substring(0, 500));
          resolve({ 
            success: false, 
            parseError: err.message, 
            rawData: data 
          });
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

async function testMinimalRequest() {
  console.log('\n🧪 测试简化请求（无工具）...');
  
  const minimalRequest = {
    model: 'claude-4-sonnet',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 100
  };
  
  return new Promise((resolve) => {
    const postData = JSON.stringify(minimalRequest);
    
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
        try {
          const response = JSON.parse(data);
          const success = res.statusCode === 200;
          console.log(`📊 简化请求结果: ${success ? '✅ 成功' : '❌ 失败'} (${res.statusCode})`);
          if (!success && response.error) {
            console.log(`错误消息: ${response.error.message}`);
          }
          resolve({ success, statusCode: res.statusCode, error: response.error });
        } catch (err) {
          console.log('❌ 简化请求解析失败:', err.message);
          resolve({ success: false, parseError: err.message });
        }
      });
    });
    
    req.on('error', () => resolve({ success: false }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false }); });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    // 先测试简化请求
    const minimalResult = await testMinimalRequest();
    
    if (!minimalResult.success) {
      console.log('\n🚨 基础请求都失败了，问题不仅仅是工具定义！');
      console.log('可能是预处理器的其他部分有问题。');
      return;
    }
    
    // 再测试工具定义问题
    const result = await testToolDefinitionIssue();
    
    console.log('\n' + '='.repeat(70));
    console.log('🏁 诊断总结:');
    
    if (result.hasToolsError) {
      console.log('🚨 确认复现了工具定义问题！');
      console.log('📍 问题位置: 统一兼容性预处理器的工具定义处理');
      console.log('🔧 需要检查: src/preprocessing/unified-compatibility-preprocessor.ts');
      console.log('🎯 重点检查: standardizeToolDefinitions 函数');
      console.log('\n建议修复步骤:');
      console.log('1. 检查工具定义标准化函数');
      console.log('2. 确保所有工具都有type="function"字段');
      console.log('3. 验证input_schema转换为parameters格式');
      console.log('4. 测试各种工具定义格式的兼容性');
    } else if (result.success) {
      console.log('🤔 未能复现工具定义问题');
      console.log('可能是特定的工具定义格式或数据导致的');
      console.log('建议检查实际失败请求的工具定义内容');
    } else {
      console.log('❌ 测试过程中出现其他错误');
      if (result.error) {
        console.log(`错误详情: ${result.error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 诊断过程失败:', error.message);
  }
}

main();