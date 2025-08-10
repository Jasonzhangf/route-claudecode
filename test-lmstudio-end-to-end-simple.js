#!/usr/bin/env node

/**
 * LMStudio端到端简单验证测试
 * 验证跨节点耦合约束重构后的系统功能
 */

const axios = require('axios');

const PORT = 5506;
const BASE_URL = `http://localhost:${PORT}`;

async function testLMStudioEndToEnd() {
  console.log('🧪 LMStudio端到端验证测试开始...\n');
  
  const testResults = {
    server_health: false,
    basic_request: false,
    tool_call_request: false,
    preprocessing_working: false
  };

  try {
    // 测试1: 健康检查
    console.log('🧪 测试1: 服务健康检查...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      testResults.server_health = healthResponse.status === 200;
      console.log('✅ 服务健康检查通过');
    } catch (error) {
      console.log('❌ 服务健康检查失败:', error.message);
    }

    // 测试2: 基础文本请求
    console.log('\n🧪 测试2: 基础文本请求...');
    try {
      const basicRequest = {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: '说出 hello world' }]
      };

      const basicResponse = await axios.post(
        `${BASE_URL}/v1/messages`, 
        basicRequest,
        { 
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      testResults.basic_request = basicResponse.status === 200;
      console.log('✅ 基础文本请求成功');
      console.log('📊 响应状态:', basicResponse.status);
      
      if (basicResponse.data && basicResponse.data.content) {
        console.log('📄 响应长度:', JSON.stringify(basicResponse.data).length);
      }
    } catch (error) {
      console.log('❌ 基础文本请求失败:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('📄 错误详情:', JSON.stringify(error.response.data, null, 2));
      }
    }

    // 测试3: 工具调用请求  
    console.log('\n🧪 测试3: 工具调用请求...');
    try {
      const toolRequest = {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: '创建一个名为test.txt的文件，内容是Hello World' }],
        tools: [
          {
            name: 'create_file',
            description: '创建文件',
            input_schema: {
              type: 'object',
              properties: {
                filename: { type: 'string', description: '文件名' },
                content: { type: 'string', description: '文件内容' }
              },
              required: ['filename', 'content']
            }
          }
        ]
      };

      const toolResponse = await axios.post(
        `${BASE_URL}/v1/messages`,
        toolRequest,
        { 
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      testResults.tool_call_request = toolResponse.status === 200;
      console.log('✅ 工具调用请求成功');
      console.log('📊 响应状态:', toolResponse.status);
      
      if (toolResponse.data) {
        const responseStr = JSON.stringify(toolResponse.data);
        console.log('📄 响应长度:', responseStr.length);
        
        // 检查是否包含工具调用
        const hasToolUse = responseStr.includes('tool_use') || responseStr.includes('function_call');
        testResults.preprocessing_working = hasToolUse;
        console.log('🔧 包含工具调用:', hasToolUse);
        
        if (hasToolUse) {
          console.log('✅ 预处理系统正确处理了工具调用');
        } else {
          console.log('⚠️  预处理系统可能需要检查工具调用处理');
        }
      }
      
    } catch (error) {
      console.log('❌ 工具调用请求失败:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('📄 错误详情:', JSON.stringify(error.response.data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ 测试执行异常:', error.message);
  }

  return testResults;
}

async function main() {
  const results = await testLMStudioEndToEnd();
  
  console.log('\n📊 LMStudio端到端验证报告');
  console.log('========================================');
  console.log('服务健康状态:', results.server_health ? '✅ 正常' : '❌ 异常');
  console.log('基础请求功能:', results.basic_request ? '✅ 正常' : '❌ 异常');
  console.log('工具调用功能:', results.tool_call_request ? '✅ 正常' : '❌ 异常');
  console.log('预处理系统状态:', results.preprocessing_working ? '✅ 正常' : '⚠️  需要检查');
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 测试通过率: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (results.server_health && results.basic_request) {
    console.log('✅ 基础功能正常，跨节点耦合约束重构成功');
  } else {
    console.log('❌ 发现问题，需要进一步调试');
  }
  
  console.log('\n🏁 测试完成');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testLMStudioEndToEnd };