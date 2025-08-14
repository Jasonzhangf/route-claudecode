#!/usr/bin/env node
/**
 * OpenAI统一客户端功能验证测试
 * 项目所有者: Jason Zhang
 * 
 * 验证重构后的统一客户端功能是否完整
 */

const axios = require('axios');
const { spawn } = require('child_process');

const TEST_CONFIG = {
  port: 5508,  // ShuaiHong OpenAI服务端口
  baseURL: 'http://localhost:5508',
  timeout: 30000,
  testCases: [
    {
      name: '基础文本对话',
      request: {
        model: 'claude-4-sonnet',
        messages: [{ role: 'user', content: '你好，请用一句话回复' }],
        max_tokens: 100
      }
    },
    {
      name: '工具调用测试',
      request: {
        model: 'claude-4-sonnet',
        messages: [{ role: 'user', content: '帮我搜索今天的天气信息' }],
        tools: [{
          type: 'function',
          function: {
            name: 'search_weather',
            description: '搜索天气信息',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: '位置' }
              }
            }
          }
        }],
        max_tokens: 200
      }
    },
    {
      name: '流式响应测试',
      request: {
        model: 'claude-4-sonnet',
        messages: [{ role: 'user', content: '请写一首关于代码重构的短诗' }],
        stream: true,
        max_tokens: 150
      }
    }
  ]
};

/**
 * 测试结果统计
 */
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

/**
 * 等待服务启动
 */
async function waitForService(port, maxAttempts = 30, interval = 2000) {
  console.log(`⏳ 等待端口 ${port} 上的服务启动...`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(`http://localhost:${port}/health`, { timeout: 5000 });
      console.log(`✅ 服务已启动在端口 ${port}`);
      return true;
    } catch (error) {
      if (i === maxAttempts - 1) {
        console.log(`❌ 服务启动超时，端口 ${port}`);
        return false;
      }
      console.log(`⏳ 等待服务启动... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

/**
 * 执行单个测试用例
 */
async function runTestCase(testCase) {
  const { name, request } = testCase;
  console.log(`\n🧪 执行测试: ${name}`);
  
  const startTime = Date.now();
  const result = {
    name,
    status: 'unknown',
    duration: 0,
    error: null,
    details: {}
  };

  try {
    if (request.stream) {
      // 流式请求测试
      const response = await axios.post(`${TEST_CONFIG.baseURL}/v1/chat/completions`, request, {
        responseType: 'stream',
        timeout: TEST_CONFIG.timeout,
        headers: { 'Content-Type': 'application/json' }
      });

      let chunks = [];
      let hasContent = false;

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\\n').filter(line => line.trim());
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = JSON.parse(line.slice(6));
                chunks.push(data);
                if (data.choices?.[0]?.delta?.content) {
                  hasContent = true;
                }
              } catch (e) {
                // 忽略解析错误的chunk
              }
            }
          }
        });

        response.data.on('end', () => {
          result.duration = Date.now() - startTime;
          result.details = {
            chunks: chunks.length,
            hasContent,
            lastChunk: chunks[chunks.length - 1]
          };
          
          if (hasContent) {
            result.status = 'passed';
            console.log(`✅ ${name} - 流式响应正常 (${chunks.length} chunks)`);
          } else {
            result.status = 'failed';
            result.error = '流式响应无内容';
            console.log(`❌ ${name} - 流式响应无内容`);
          }
          
          resolve(result);
        });

        response.data.on('error', (error) => {
          result.duration = Date.now() - startTime;
          result.status = 'failed';
          result.error = error.message;
          console.log(`❌ ${name} - 流式请求失败: ${error.message}`);
          resolve(result);
        });
      });

    } else {
      // 非流式请求测试
      const response = await axios.post(`${TEST_CONFIG.baseURL}/v1/chat/completions`, request, {
        timeout: TEST_CONFIG.timeout,
        headers: { 'Content-Type': 'application/json' }
      });

      result.duration = Date.now() - startTime;
      
      if (response.status === 200 && response.data?.choices?.[0]) {
        const choice = response.data.choices[0];
        result.status = 'passed';
        result.details = {
          hasContent: !!choice.message?.content,
          hasToolCalls: !!(choice.message?.tool_calls && choice.message.tool_calls.length > 0),
          finishReason: choice.finish_reason,
          responseId: response.data.id
        };
        
        console.log(`✅ ${name} - 响应正常`, {
          finishReason: choice.finish_reason,
          hasContent: result.details.hasContent,
          hasToolCalls: result.details.hasToolCalls
        });
      } else {
        result.status = 'failed';
        result.error = '响应格式不正确';
        console.log(`❌ ${name} - 响应格式错误`);
      }
    }

  } catch (error) {
    result.duration = Date.now() - startTime;
    result.status = 'failed';
    result.error = error.message;
    console.log(`❌ ${name} - 请求失败: ${error.message}`);
  }

  return result;
}

/**
 * 生成测试报告
 */
function generateReport() {
  console.log(`\n📊 测试报告`);
  console.log(`==========================================`);
  console.log(`总测试数: ${testResults.total}`);
  console.log(`通过: ${testResults.passed} ✅`);
  console.log(`失败: ${testResults.failed} ❌`);
  console.log(`成功率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  console.log(`\n📋 详细结果:`);
  testResults.details.forEach((result, index) => {
    const status = result.status === 'passed' ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
    if (result.details) {
      console.log(`   详情: ${JSON.stringify(result.details, null, 2)}`);
    }
  });
  
  if (testResults.failed > 0) {
    console.log(`\n⚠️  发现 ${testResults.failed} 个测试失败，请检查重构实现！`);
    process.exit(1);
  } else {
    console.log(`\n🎉 所有测试通过！OpenAI统一客户端重构成功！`);
    process.exit(0);
  }
}

/**
 * 主测试流程
 */
async function main() {
  console.log(`🚀 开始OpenAI统一客户端功能验证`);
  console.log(`测试端口: ${TEST_CONFIG.port}`);
  console.log(`测试用例: ${TEST_CONFIG.testCases.length}个`);
  
  // 检查服务是否运行
  const serviceReady = await waitForService(TEST_CONFIG.port);
  if (!serviceReady) {
    console.log(`❌ 无法连接到端口 ${TEST_CONFIG.port} 的服务`);
    console.log(`请先启动OpenAI兼容服务:`);
    console.log(`rcc start --config ~/.route-claude-code/config/single-provider/config-openai-shuaihong-${TEST_CONFIG.port}.json --debug`);
    process.exit(1);
  }

  // 执行测试用例
  testResults.total = TEST_CONFIG.testCases.length;
  
  for (const testCase of TEST_CONFIG.testCases) {
    const result = await runTestCase(testCase);
    testResults.details.push(result);
    
    if (result.status === 'passed') {
      testResults.passed++;
    } else {
      testResults.failed++;
    }
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 生成测试报告
  generateReport();
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 运行测试
main().catch((error) => {
  console.error('测试执行失败:', error);
  process.exit(1);
});