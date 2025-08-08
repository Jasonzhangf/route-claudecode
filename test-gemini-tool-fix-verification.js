/**
 * Gemini工具调用问题综合修复脚本
 * 项目所有者: Jason Zhang
 * 
 * 修复目标：
 * 1. 修复OpenAI格式工具调用的500错误
 * 2. 修复Anthropic格式工具调用不被触发的问题
 * 3. 确保工具格式转换和API调用参数正确传递
 * 4. 验证修复效果
 */

const axios = require('axios');
const fs = require('fs');

const GEMINI_PORT = 5502;
const BASE_URL = `http://localhost:${GEMINI_PORT}`;

/**
 * 测试工具调用是否实际被触发的高概率场景
 */
const HIGH_PROBABILITY_TOOL_TESTS = [
  {
    name: 'Mathematical_Calculation_OpenAI',
    format: 'openai',
    request: {
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: "Use the math calculator tool to calculate 157 * 234. Don't calculate manually."
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "calculator",
            description: "Perform mathematical calculations",
            parameters: {
              type: "object",
              properties: {
                expression: {
                  type: "string",
                  description: "Mathematical expression to calculate"
                }
              },
              required: ["expression"]
            }
          }
        }
      ]
    }
  },
  {
    name: 'Mathematical_Calculation_Anthropic',
    format: 'anthropic',
    request: {
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: "Use the math calculator tool to compute 157 * 234. Don't calculate manually."
        }
      ],
      tools: [
        {
          name: "calculator",
          description: "Perform mathematical calculations",
          input_schema: {
            type: "object",
            properties: {
              expression: {
                type: "string",
                description: "Mathematical expression to calculate"
              }
            },
            required: ["expression"]
          }
        }
      ]
    }
  },
  {
    name: 'Current_Time_OpenAI',
    format: 'openai',
    request: {
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: "What is the current time? Use the get_current_time tool to check."
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "get_current_time",
            description: "Get the current date and time",
            parameters: {
              type: "object",
              properties: {
                timezone: {
                  type: "string",
                  description: "Timezone (optional)",
                  default: "UTC"
                }
              }
            }
          }
        }
      ]
    }
  },
  {
    name: 'Current_Time_Anthropic',
    format: 'anthropic',
    request: {
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: "What is the current time? Use the get_current_time tool to check."
        }
      ],
      tools: [
        {
          name: "get_current_time",
          description: "Get the current date and time",
          input_schema: {
            type: "object",
            properties: {
              timezone: {
                type: "string",
                description: "Timezone (optional)",
                default: "UTC"
              }
            }
          }
        }
      ]
    }
  }
];

/**
 * 执行单个测试案例
 */
async function executeTest(testCase) {
  const requestId = `${testCase.name.toLowerCase()}-${Date.now()}`;
  console.log(`\n🧪 测试: ${testCase.name} (${testCase.format}格式)`);
  console.log(`Request ID: ${requestId}`);
  
  try {
    console.log('📤 发送请求...');
    const response = await axios.post(`${BASE_URL}/v1/messages`, testCase.request, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      timeout: 30000
    });
    
    console.log('📥 收到响应');
    
    // 分析响应
    const hasToolCalls = response.data.content?.some(c => c.type === 'tool_use') || false;
    const stopReason = response.data.stop_reason;
    const contentTypes = response.data.content?.map(c => c.type) || [];
    
    console.log('📊 响应分析:');
    console.log(`  状态: 成功 (HTTP 200)`);
    console.log(`  内容类型: [${contentTypes.join(', ')}]`);
    console.log(`  工具调用: ${hasToolCalls ? '✅ 检测到' : '❌ 未检测到'}`);
    console.log(`  停止原因: ${stopReason}`);
    console.log(`  停止原因正确: ${hasToolCalls ? (stopReason === 'tool_use' ? '✅' : '❌') : (stopReason === 'end_turn' ? '✅' : '❌')}`);
    
    // 保存详细日志
    const logEntry = {
      testCase: testCase.name,
      format: testCase.format,
      requestId,
      timestamp: new Date().toISOString(),
      request: testCase.request,
      response: response.data,
      analysis: {
        hasToolCalls,
        stopReason,
        contentTypes,
        success: true,
        httpStatus: 200
      }
    };
    
    fs.writeFileSync(`/tmp/gemini-fix-test-${requestId}.json`, JSON.stringify(logEntry, null, 2));
    
    return {
      testName: testCase.name,
      format: testCase.format,
      success: true,
      hasToolCalls,
      stopReason,
      stopReasonCorrect: hasToolCalls ? (stopReason === 'tool_use') : (stopReason === 'end_turn'),
      httpStatus: 200,
      error: null
    };
    
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      responseData: error.response?.data
    };
    
    console.log('🔍 错误详情:');
    if (error.response?.status) {
      console.log(`  HTTP状态: ${error.response.status}`);
    }
    if (error.response?.data) {
      console.log(`  错误信息: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    // 保存错误日志
    const errorLogEntry = {
      testCase: testCase.name,
      format: testCase.format,
      requestId,
      timestamp: new Date().toISOString(),
      request: testCase.request,
      error: errorDetails,
      analysis: {
        hasToolCalls: false,
        stopReason: null,
        success: false,
        httpStatus: error.response?.status || 'network_error'
      }
    };
    
    fs.writeFileSync(`/tmp/gemini-fix-test-error-${requestId}.json`, JSON.stringify(errorLogEntry, null, 2));
    
    return {
      testName: testCase.name,
      format: testCase.format,
      success: false,
      hasToolCalls: false,
      stopReason: null,
      stopReasonCorrect: false,
      httpStatus: error.response?.status || 0,
      error: error.message
    };
  }
}

/**
 * 生成修复建议报告
 */
function generateFixRecommendations(results) {
  console.log('\n📋 修复分析报告');
  console.log('='.repeat(60));
  
  const openaiResults = results.filter(r => r.format === 'openai');
  const anthropicResults = results.filter(r => r.format === 'anthropic');
  
  const openaiSuccess = openaiResults.filter(r => r.success);
  const anthropicSuccess = anthropicResults.filter(r => r.success);
  
  const openaiToolCalls = openaiResults.filter(r => r.hasToolCalls);
  const anthropicToolCalls = anthropicResults.filter(r => r.hasToolCalls);
  
  console.log(`\n📊 测试结果统计:`);
  console.log(`OpenAI格式: ${openaiSuccess.length}/${openaiResults.length} 成功, ${openaiToolCalls.length} 工具调用`);
  console.log(`Anthropic格式: ${anthropicSuccess.length}/${anthropicResults.length} 成功, ${anthropicToolCalls.length} 工具调用`);
  
  const recommendations = [];
  
  // OpenAI格式问题分析
  if (openaiResults.length > 0 && openaiSuccess.length === 0) {
    recommendations.push({
      priority: 'CRITICAL',
      issue: 'OpenAI格式工具调用完全失效',
      details: 'OpenAI格式请求返回500错误，无法被正确处理',
      fixLocation: 'src/providers/gemini/modules/request-converter.ts',
      suggestedFix: '检查convertTools方法中OpenAI格式的tools.function结构转换'
    });
  }
  
  // Anthropic格式工具调用问题分析
  if (anthropicSuccess.length > 0 && anthropicToolCalls.length === 0) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Anthropic格式工具调用不被触发',
      details: 'Anthropic格式请求成功但AI不调用工具，返回文本响应',
      fixLocation: 'src/providers/gemini/modules/request-converter.ts',
      suggestedFix: '检查tools转换和functionCallingConfig配置是否正确传递给Gemini API'
    });
  }
  
  // stop_reason判断问题分析
  const incorrectStopReasons = results.filter(r => r.success && !r.stopReasonCorrect);
  if (incorrectStopReasons.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'Stop_reason判断逻辑不准确',
      details: `${incorrectStopReasons.length}个响应的stop_reason映射不正确`,
      fixLocation: 'src/providers/gemini/modules/response-converter.ts',
      suggestedFix: '检查内容驱动的stop_reason判断逻辑是否正确实现'
    });
  }
  
  console.log(`\n💡 修复建议 (${recommendations.length}个问题):`);
  recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. [${rec.priority}] ${rec.issue}`);
    console.log(`   位置: ${rec.fixLocation}`);
    console.log(`   建议: ${rec.suggestedFix}`);
    console.log(`   详情: ${rec.details}\n`);
  });
  
  return recommendations;
}

/**
 * 主执行函数
 */
async function main() {
  console.log('🚀 Gemini工具调用问题综合修复验证');
  console.log('目标：验证当前问题状态，生成精确修复建议');
  console.log('='.repeat(60));
  
  // 检查服务状态
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Gemini服务运行正常 (端口5502)');
  } catch (error) {
    console.log('❌ Gemini服务未运行，请启动服务:');
    console.log('rcc start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug');
    process.exit(1);
  }
  
  // 清理旧的测试文件
  const tmpFiles = fs.readdirSync('/tmp').filter(f => f.startsWith('gemini-fix-test'));
  tmpFiles.forEach(file => {
    fs.unlinkSync(`/tmp/${file}`);
  });
  
  console.log('\n开始执行高概率工具调用测试...');
  
  const results = [];
  
  // 执行所有测试案例
  for (const testCase of HIGH_PROBABILITY_TOOL_TESTS) {
    const result = await executeTest(testCase);
    results.push(result);
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 生成修复建议
  const recommendations = generateFixRecommendations(results);
  
  // 保存完整报告
  const report = {
    title: 'Gemini工具调用修复验证报告',
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.length,
      successfulRequests: results.filter(r => r.success).length,
      toolCallsDetected: results.filter(r => r.hasToolCalls).length,
      correctStopReasons: results.filter(r => r.stopReasonCorrect).length
    },
    testResults: results,
    recommendations,
    nextSteps: [
      '1. 基于修复建议更新相关模块代码',
      '2. 重新运行此脚本验证修复效果', 
      '3. 确认工具调用功能完全恢复后进行生产部署'
    ]
  };
  
  const reportFile = `/tmp/gemini-fix-verification-report-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`\n📋 完整报告已保存: ${reportFile}`);
  console.log('\n🔍 测试日志文件:');
  const testFiles = fs.readdirSync('/tmp').filter(f => f.startsWith('gemini-fix-test'));
  testFiles.forEach(file => {
    console.log(`  /tmp/${file}`);
  });
  
  console.log('\n🎯 下一步行动:');
  if (recommendations.length > 0) {
    console.log('❌ 发现问题，需要代码修复');
    console.log('👉 请根据修复建议更新相关代码，然后重新运行此脚本');
  } else {
    console.log('✅ 所有测试通过，工具调用功能正常');
    console.log('👉 可以继续正常使用Gemini provider的工具调用功能');
  }
}

// 运行测试
main().catch(error => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});