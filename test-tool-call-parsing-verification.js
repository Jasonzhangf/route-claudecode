#!/usr/bin/env node

/**
 * 工具调用解析修复验证测试
 * 验证 GeminiTransformer 的工具调用格式转换是否修复
 * Project owner: Jason Zhang
 */

const http = require('http');

// 测试配置
const TEST_CONFIG = {
  port: 5502,
  timeout: 30000,
  logFile: `/tmp/test-tool-call-parsing-${Date.now()}.log`
};

// 日志函数
function log(message, data = '') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}`;
  console.log(logLine);
  require('fs').appendFileSync(TEST_CONFIG.logFile, logLine + '\n');
}

// 创建HTTP请求
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: TEST_CONFIG.port,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'anthropic-version': '2023-06-01'
      },
      timeout: TEST_CONFIG.timeout
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonResponse
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// 工具调用测试 - 使用OpenAI格式（导致之前解析错误的格式）
async function testToolCallParsing() {
  log('=== 工具调用解析修复验证 ===');
  
  const testRequest = {
    model: 'gemini-2.5-flash',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: 'What time is it now? Use the get_current_time tool.'
      }
    ],
    tools: [
      {
        function: {  // OpenAI格式 - 之前导致 "missing function" 错误
          name: 'get_current_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {
              timezone: {
                type: 'string',
                description: 'The timezone to get time for'
              }
            }
          }
        }
      }
    ]
  };

  try {
    log('发送工具调用测试请求', {
      model: testRequest.model,
      toolName: testRequest.tools[0].function.name,
      toolFormat: 'OpenAI (nested function property)'
    });

    const response = await makeRequest(testRequest);
    
    log('收到响应', {
      statusCode: response.statusCode,
      hasBody: !!response.body,
      parseError: response.parseError
    });

    if (response.statusCode !== 200) {
      log('❌ 请求失败', {
        statusCode: response.statusCode,
        body: response.body
      });
      return false;
    }

    if (response.parseError) {
      log('❌ 响应解析失败', {
        parseError: response.parseError,
        rawBody: response.body
      });
      return false;
    }

    const body = response.body;
    
    // 验证响应格式
    if (!body.content || !Array.isArray(body.content)) {
      log('❌ 响应格式错误: 缺少content数组', body);
      return false;
    }

    // 检查是否包含工具调用
    const hasToolUse = body.content.some(block => block.type === 'tool_use');
    
    if (hasToolUse) {
      log('✅ 工具调用解析成功', {
        contentBlocks: body.content.length,
        stopReason: body.stop_reason,
        toolCalls: body.content.filter(block => block.type === 'tool_use').map(block => ({
          name: block.name,
          hasInput: !!block.input
        }))
      });
      
      // 验证stop_reason是否正确设置为tool_use
      if (body.stop_reason === 'tool_use') {
        log('✅ stop_reason正确设置为tool_use (关键修复验证)');
        return true;
      } else {
        log('⚠️ stop_reason设置错误', {
          expected: 'tool_use',
          actual: body.stop_reason
        });
        return false;
      }
      
    } else {
      log('❌ 未检测到工具调用', {
        contentBlocks: body.content.length,
        stopReason: body.stop_reason,
        content: body.content
      });
      return false;
    }

  } catch (error) {
    log('❌ 工具调用测试异常', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

// Anthropic格式工具调用测试
async function testAnthropicToolFormat() {
  log('\n=== Anthropic格式工具调用测试 ===');
  
  const testRequest = {
    model: 'gemini-2.5-flash',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: 'Calculate 15 * 23 using the calculator tool.'
      }
    ],
    tools: [
      {  // Anthropic格式 - 直接属性
        name: 'calculator',
        description: 'Perform mathematical calculations',
        input_schema: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to calculate'
            }
          },
          required: ['expression']
        }
      }
    ]
  };

  try {
    log('发送Anthropic格式工具调用请求', {
      model: testRequest.model,
      toolName: testRequest.tools[0].name,
      toolFormat: 'Anthropic (direct properties)'
    });

    const response = await makeRequest(testRequest);
    
    if (response.statusCode !== 200 || response.parseError) {
      log('❌ Anthropic格式测试失败', {
        statusCode: response.statusCode,
        parseError: response.parseError
      });
      return false;
    }

    const body = response.body;
    const hasToolUse = body.content?.some(block => block.type === 'tool_use');
    
    if (hasToolUse && body.stop_reason === 'tool_use') {
      log('✅ Anthropic格式工具调用解析成功');
      return true;
    } else {
      log('❌ Anthropic格式工具调用解析失败', {
        hasToolUse,
        stopReason: body.stop_reason
      });
      return false;
    }

  } catch (error) {
    log('❌ Anthropic格式测试异常', error.message);
    return false;
  }
}

// 主测试函数
async function main() {
  log('启动工具调用解析修复验证测试');
  log('配置', TEST_CONFIG);

  try {
    // 检查服务状态
    log('检查Gemini服务状态 (端口 5502)');
    
    const results = {
      openaiFormat: false,
      anthropicFormat: false
    };

    // 测试OpenAI格式工具调用（之前失败的格式）
    results.openaiFormat = await testToolCallParsing();
    
    // 等待1秒避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试Anthropic格式工具调用
    results.anthropicFormat = await testAnthropicToolFormat();

    // 生成测试结果
    log('\n=== 测试结果总结 ===');
    log('OpenAI格式工具调用', results.openaiFormat ? '✅ 通过' : '❌ 失败');
    log('Anthropic格式工具调用', results.anthropicFormat ? '✅ 通过' : '❌ 失败');
    
    const overallSuccess = results.openaiFormat && results.anthropicFormat;
    
    if (overallSuccess) {
      log('🎉 工具调用解析修复验证成功！');
      log('关键修复确认: GeminiTransformer现在正确支持OpenAI和Anthropic两种工具定义格式');
      console.log('\n✅ 修复验证通过 - 工具调用解析问题已解决');
    } else {
      log('❌ 工具调用解析仍有问题');
      console.log('\n❌ 修复验证失败 - 仍需进一步调试');
    }

    log(`测试日志已保存到: ${TEST_CONFIG.logFile}`);
    
    process.exit(overallSuccess ? 0 : 1);

  } catch (error) {
    log('❌ 测试过程异常', {
      error: error.message,
      stack: error.stack
    });
    console.log('\n❌ 测试执行异常:', error.message);
    process.exit(1);
  }
}

// 执行测试
if (require.main === module) {
  main();
}