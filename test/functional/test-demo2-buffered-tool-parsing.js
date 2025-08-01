#!/usr/bin/env node

/**
 * 测试Demo2风格的缓冲工具解析实现
 * 验证基于Demo2成功经验的修复是否生效
 */

const axios = require('axios');
const fs = require('fs');

const ROUTER_URL = 'http://localhost:3456';
const TEST_LOG_PATH = `/tmp/test-demo2-buffered-tool-parsing-${Date.now()}.log`;

function log(message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n${data ? JSON.stringify(data, null, 2) : ''}\n`;
  console.log(logEntry);
  fs.appendFileSync(TEST_LOG_PATH, logEntry);
}

async function testDemo2BufferedToolParsing() {
  log('🧪 Demo2风格缓冲工具解析测试开始');
  
  try {
    // 测试请求：使用与Demo2相同的工具调用请求
    const testRequest = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: "请查询北京的天气信息"
        }
      ],
      tools: [
        {
          name: "get_weather",
          description: "Get weather information for a city",
          input_schema: {
            type: "object",
            properties: {
              city: {
                type: "string",
                description: "The city to get weather for"
              }
            },
            required: ["city"]
          }
        }
      ]
    };

    log('📤 发送工具调用测试请求', {
      url: `${ROUTER_URL}/v1/messages`,
      modelRequested: testRequest.model,
      toolsCount: testRequest.tools.length,
      strategy: 'demo2_buffered_parsing'
    });

    const startTime = Date.now();
    const response = await axios.post(`${ROUTER_URL}/v1/messages`, testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });

    const responseTime = Date.now() - startTime;

    log('✅ 收到路由器响应', {
      status: response.status,
      responseTime: `${responseTime}ms`,
      contentLength: JSON.stringify(response.data).length
    });

    // 验证响应格式
    const responseData = response.data;
    
    log('🔍 分析响应结构', {
      responseKeys: Object.keys(responseData),
      hasContent: !!responseData.content,
      contentType: Array.isArray(responseData.content) ? 'array' : typeof responseData.content,
      contentLength: responseData.content ? responseData.content.length : 0
    });

    // 检查工具调用
    if (responseData.content && Array.isArray(responseData.content)) {
      const toolUseBlocks = responseData.content.filter(block => block.type === 'tool_use');
      const textBlocks = responseData.content.filter(block => block.type === 'text');
      
      log('🔧 内容块分析', {
        totalBlocks: responseData.content.length,
        toolUseBlocks: toolUseBlocks.length,
        textBlocks: textBlocks.length,
        blockTypes: responseData.content.map(block => block.type)
      });

      if (toolUseBlocks.length > 0) {
        log('🎯 工具调用检测成功', {
          toolCallsFound: toolUseBlocks.length,
          toolDetails: toolUseBlocks.map(tool => ({
            name: tool.name,
            id: tool.id,
            hasInput: !!tool.input,
            inputKeys: tool.input ? Object.keys(tool.input) : [],
            inputValues: tool.input
          }))
        });

        // 验证Demo2风格过滤
        if (textBlocks.length === 0 && toolUseBlocks.length > 0) {
          log('✅ Demo2风格过滤验证成功', {
            strategy: 'tools_only_response',
            textBlocksFiltered: true,
            toolCallsPreserved: true
          });
        } else {
          log('⚠️ Demo2风格过滤可能未生效', {
            textBlocksCount: textBlocks.length,
            toolCallsCount: toolUseBlocks.length,
            expectedBehavior: 'tools_only_when_tools_present'
          });
        }

        // 验证工具输入解析
        const toolWithValidInput = toolUseBlocks.find(tool => 
          tool.input && typeof tool.input === 'object' && Object.keys(tool.input).length > 0
        );

        if (toolWithValidInput) {
          log('✅ 工具输入解析验证成功', {
            toolName: toolWithValidInput.name,
            inputParsed: true,
            inputContent: toolWithValidInput.input,
            jsonParsingWorking: true
          });
        } else {
          log('❌ 工具输入解析可能失败', {
            toolsWithInput: toolUseBlocks.map(tool => ({
              name: tool.name,
              hasInput: !!tool.input,
              inputType: typeof tool.input,
              inputContent: tool.input
            }))
          });
        }

      } else {
        log('❌ 工具调用检测失败', {
          expectedToolCalls: 1,
          actualToolCalls: 0,
          possibleIssue: 'tool_parsing_failed_or_filtered_incorrectly'
        });
      }
    } else {
      log('❌ 响应格式异常', {
        contentExists: !!responseData.content,
        contentType: typeof responseData.content,
        expectedFormat: 'array_of_content_blocks'
      });
    }

    // 保存完整响应用于调试
    const responseLogPath = `/tmp/demo2-buffered-test-response-${Date.now()}.json`;
    fs.writeFileSync(responseLogPath, JSON.stringify(responseData, null, 2));
    log('💾 完整响应已保存', { path: responseLogPath });

    return {
      success: true,
      responseTime,
      toolCallsDetected: responseData.content ? 
        responseData.content.filter(block => block.type === 'tool_use').length : 0,
      totalBlocks: responseData.content ? responseData.content.length : 0
    };

  } catch (error) {
    log('❌ 测试失败', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data ? JSON.stringify(error.response.data, null, 2) : undefined
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  log('🚀 Demo2风格缓冲工具解析测试启动');
  
  const result = await testDemo2BufferedToolParsing();
  
  if (result.success) {
    log('🎉 测试完成 - 成功', {
      toolCallsDetected: result.toolCallsDetected,
      responseTime: result.responseTime,
      totalBlocks: result.totalBlocks,
      testLogPath: TEST_LOG_PATH
    });
  } else {
    log('💥 测试完成 - 失败', {
      error: result.error,
      testLogPath: TEST_LOG_PATH
    });
  }
  
  console.log(`\n📋 详细测试日志: ${TEST_LOG_PATH}`);
}

main().catch(console.error);