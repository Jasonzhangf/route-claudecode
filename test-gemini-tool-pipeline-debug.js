/**
 * Gemini工具传递流水线完整调试脚本
 * 项目所有者: Jason Zhang
 * 
 * 根据项目记忆和零硬编码原则，系统分析工具传递的每个环节：
 * 1. 输入端工具格式分析 (Anthropic → Gemini)  
 * 2. API调用参数验证
 * 3. 响应端工具格式分析 (Gemini → Anthropic)
 * 4. stop_reason内容驱动判断验证
 * 5. 与OpenAI成功模式对比验证
 */

const axios = require('axios');
const fs = require('fs');

const GEMINI_PORT = 5502;
const BASE_URL = `http://localhost:${GEMINI_PORT}`;
const DEBUG_FILE_PREFIX = '/tmp/gemini-tool-pipeline-debug';

/**
 * 捕获完整数据流的日志函数
 */
function captureDataFlow(stage, data, requestId) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    stage,
    requestId,
    data: JSON.stringify(data, null, 2)
  };
  
  console.log(`\n🔍 [${stage}] ${timestamp}`);
  console.log(`Request ID: ${requestId}`);
  console.log('Data:', JSON.stringify(data, null, 2));
  
  // 保存到调试文件
  const debugFile = `${DEBUG_FILE_PREFIX}-${requestId}.jsonl`;
  fs.appendFileSync(debugFile, JSON.stringify(logEntry) + '\n');
}

/**
 * 验证字段映射的准确性
 */
function validateFieldMapping(input, output, mappingType, requestId) {
  console.log(`\n🧪 [字段映射验证: ${mappingType}]`);
  
  const validationResults = {
    mappingType,
    timestamp: new Date().toISOString(),
    input,
    output,
    validations: []
  };
  
  // 根据映射类型进行验证
  if (mappingType === 'tools_anthropic_to_gemini') {
    // Anthropic tools → Gemini functionDeclarations
    if (input.tools && output.tools) {
      input.tools.forEach((tool, index) => {
        const geminiTool = output.tools[0]?.functionDeclarations?.[index];
        const isValid = tool.function?.name === geminiTool?.name;
        
        validationResults.validations.push({
          field: `tools[${index}].function.name`,
          expected: tool.function?.name,
          actual: geminiTool?.name,
          valid: isValid
        });
        
        console.log(`  ✓ ${tool.function?.name} → ${geminiTool?.name} (${isValid ? 'PASS' : 'FAIL'})`);
      });
    }
  } else if (mappingType === 'response_gemini_to_anthropic') {
    // Gemini functionCall → Anthropic tool_use
    const geminiCalls = extractFunctionCalls(input);
    const anthropicCalls = output.content?.filter(c => c.type === 'tool_use') || [];
    
    geminiCalls.forEach((geminiCall, index) => {
      const anthropicCall = anthropicCalls[index];
      const isValid = geminiCall.name === anthropicCall?.name;
      
      validationResults.validations.push({
        field: `functionCall[${index}].name`,
        expected: geminiCall.name,
        actual: anthropicCall?.name,
        valid: isValid
      });
      
      console.log(`  ✓ ${geminiCall.name} → ${anthropicCall?.name} (${isValid ? 'PASS' : 'FAIL'})`);
    });
  }
  
  // 保存验证结果
  fs.writeFileSync(
    `${DEBUG_FILE_PREFIX}-validation-${mappingType}-${requestId}.json`, 
    JSON.stringify(validationResults, null, 2)
  );
  
  return validationResults;
}

/**
 * 提取Gemini响应中的function calls
 */
function extractFunctionCalls(geminiResponse) {
  const calls = [];
  
  if (geminiResponse.candidates) {
    geminiResponse.candidates.forEach(candidate => {
      if (candidate.content?.parts) {
        candidate.content.parts.forEach(part => {
          if (part.functionCall) {
            calls.push(part.functionCall);
          }
        });
      }
    });
  }
  
  return calls;
}

/**
 * 测试案例1: OpenAI格式工具调用  
 */
async function testOpenAIFormatToolCall() {
  const requestId = `openai-tool-${Date.now()}`;
  console.log(`\n🧪 测试案例1: OpenAI格式工具调用 (${requestId})`);
  
  const request = {
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "user", 
        content: "What's the weather like in San Francisco?"
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get current weather information",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "City name"
              },
              unit: {
                type: "string", 
                enum: ["celsius", "fahrenheit"],
                description: "Temperature unit"
              }
            },
            required: ["location"]
          }
        }
      }
    ],
    max_tokens: 500
  };
  
  captureDataFlow('1-INPUT-OPENAI-FORMAT', request, requestId);
  
  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      timeout: 30000
    });
    
    captureDataFlow('6-OUTPUT-ANTHROPIC-FORMAT', response.data, requestId);
    
    // 验证字段映射
    validateFieldMapping(request, response.data, 'tools_anthropic_to_gemini', requestId);
    
    // 验证stop_reason
    const expectedStopReason = response.data.content?.some(c => c.type === 'tool_use') ? 'tool_use' : 'end_turn';
    const actualStopReason = response.data.stop_reason;
    
    console.log(`\n📊 Stop Reason验证:`);
    console.log(`  Expected: ${expectedStopReason}`);
    console.log(`  Actual: ${actualStopReason}`);
    console.log(`  Valid: ${expectedStopReason === actualStopReason ? 'PASS' : 'FAIL'}`);
    
    return {
      success: true,
      stopReasonValid: expectedStopReason === actualStopReason,
      hasToolCalls: response.data.content?.some(c => c.type === 'tool_use') || false,
      responseData: response.data
    };
    
  } catch (error) {
    captureDataFlow('ERROR-OPENAI-FORMAT', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    }, requestId);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 测试案例2: Anthropic格式工具调用
 */
async function testAnthropicFormatToolCall() {
  const requestId = `anthropic-tool-${Date.now()}`;
  console.log(`\n🧪 测试案例2: Anthropic格式工具调用 (${requestId})`);
  
  const request = {
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "user",
        content: "Search for recent news about artificial intelligence"
      }
    ],
    tools: [
      {
        name: "web_search",
        description: "Search the web for information", 
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query"
            },
            num_results: {
              type: "integer",
              description: "Number of results to return",
              default: 5
            }
          },
          required: ["query"]
        }
      }
    ],
    max_tokens: 500
  };
  
  captureDataFlow('1-INPUT-ANTHROPIC-FORMAT', request, requestId);
  
  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      timeout: 30000
    });
    
    captureDataFlow('6-OUTPUT-ANTHROPIC-FORMAT', response.data, requestId);
    
    // 验证stop_reason
    const expectedStopReason = response.data.content?.some(c => c.type === 'tool_use') ? 'tool_use' : 'end_turn';
    const actualStopReason = response.data.stop_reason;
    
    console.log(`\n📊 Stop Reason验证:`);
    console.log(`  Expected: ${expectedStopReason}`);
    console.log(`  Actual: ${actualStopReason}`);
    console.log(`  Valid: ${expectedStopReason === actualStopReason ? 'PASS' : 'FAIL'}`);
    
    return {
      success: true,
      stopReasonValid: expectedStopReason === actualStopReason,
      hasToolCalls: response.data.content?.some(c => c.type === 'tool_use') || false,
      responseData: response.data
    };
    
  } catch (error) {
    captureDataFlow('ERROR-ANTHROPIC-FORMAT', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    }, requestId);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 测试案例3: 基础文本响应（无工具调用）
 */
async function testBasicTextResponse() {
  const requestId = `basic-text-${Date.now()}`;
  console.log(`\n🧪 测试案例3: 基础文本响应 (${requestId})`);
  
  const request = {
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "user",
        content: "Hello! Please respond with a simple greeting."
      }
    ],
    max_tokens: 100
  };
  
  captureDataFlow('1-INPUT-BASIC-TEXT', request, requestId);
  
  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      timeout: 30000
    });
    
    captureDataFlow('6-OUTPUT-BASIC-TEXT', response.data, requestId);
    
    // 验证基础响应格式
    const hasOnlyText = response.data.content?.every(c => c.type === 'text') || false;
    const expectedStopReason = 'end_turn';
    const actualStopReason = response.data.stop_reason;
    
    console.log(`\n📊 基础文本响应验证:`);
    console.log(`  Only Text Content: ${hasOnlyText ? 'PASS' : 'FAIL'}`);
    console.log(`  Expected Stop Reason: ${expectedStopReason}`);
    console.log(`  Actual Stop Reason: ${actualStopReason}`);
    console.log(`  Stop Reason Valid: ${expectedStopReason === actualStopReason ? 'PASS' : 'FAIL'}`);
    
    return {
      success: true,
      hasOnlyText,
      stopReasonValid: expectedStopReason === actualStopReason,
      responseData: response.data
    };
    
  } catch (error) {
    captureDataFlow('ERROR-BASIC-TEXT', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    }, requestId);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 生成综合分析报告
 */
function generateAnalysisReport(results) {
  const timestamp = new Date().toISOString();
  
  const report = {
    title: 'Gemini工具传递流水线完整分析报告',
    timestamp,
    summary: {
      totalTests: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    },
    testResults: results,
    keyFindings: [],
    recommendations: []
  };
  
  // 分析关键发现
  const toolCallResults = results.filter(r => r.hasToolCalls);
  const textOnlyResults = results.filter(r => r.hasOnlyText);
  const stopReasonIssues = results.filter(r => r.success && !r.stopReasonValid);
  
  if (toolCallResults.length > 0) {
    report.keyFindings.push({
      finding: 'Tool Call Detection',
      status: toolCallResults.length > 0 ? 'WORKING' : 'BROKEN',
      details: `${toolCallResults.length} successful tool call responses detected`
    });
  }
  
  if (stopReasonIssues.length > 0) {
    report.keyFindings.push({
      finding: 'Stop Reason Accuracy',
      status: 'ISSUE DETECTED',
      details: `${stopReasonIssues.length} responses with incorrect stop_reason mapping`
    });
  }
  
  if (textOnlyResults.length > 0) {
    report.keyFindings.push({
      finding: 'Basic Text Response',
      status: 'WORKING',
      details: `${textOnlyResults.length} successful text-only responses`
    });
  }
  
  // 生成建议
  if (stopReasonIssues.length > 0) {
    report.recommendations.push({
      priority: 'HIGH',
      recommendation: '修复stop_reason判断逻辑',
      details: '检查response-converter.ts中的内容驱动判断是否正确实现'
    });
  }
  
  if (toolCallResults.length === 0 && results.some(r => r.success)) {
    report.recommendations.push({
      priority: 'CRITICAL',
      recommendation: '工具调用完全失效',
      details: '检查request-converter.ts中的工具格式转换和API调用参数'
    });
  }
  
  const reportFile = `${DEBUG_FILE_PREFIX}-analysis-report-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`\n📋 分析报告已保存: ${reportFile}`);
  return report;
}

/**
 * 主执行函数
 */
async function main() {
  console.log('🚀 Gemini工具传递流水线完整调试分析');
  console.log('=' * 60);
  
  // 清理旧的调试文件
  const fs = require('fs');
  const debugFiles = fs.readdirSync('/tmp').filter(f => f.startsWith('gemini-tool-pipeline-debug'));
  debugFiles.forEach(file => {
    fs.unlinkSync(`/tmp/${file}`);
  });
  
  const results = [];
  
  // 检查服务是否运行
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Gemini服务正在运行 (端口5502)');
  } catch (error) {
    console.log('❌ Gemini服务未运行，请启动:');
    console.log('rcc start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug');
    process.exit(1);
  }
  
  // 执行测试案例
  console.log('\n开始执行测试案例...');
  
  // 测试案例1: OpenAI格式工具调用
  const result1 = await testOpenAIFormatToolCall();
  results.push({ testCase: 'OpenAI格式工具调用', ...result1 });
  
  // 等待间隔
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 测试案例2: Anthropic格式工具调用
  const result2 = await testAnthropicFormatToolCall();
  results.push({ testCase: 'Anthropic格式工具调用', ...result2 });
  
  // 等待间隔
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 测试案例3: 基础文本响应
  const result3 = await testBasicTextResponse();
  results.push({ testCase: '基础文本响应', ...result3 });
  
  // 生成综合分析报告
  const report = generateAnalysisReport(results);
  
  console.log('\n📊 测试结果汇总:');
  console.log(`总测试数: ${report.summary.totalTests}`);
  console.log(`成功: ${report.summary.passed}`);
  console.log(`失败: ${report.summary.failed}`);
  
  if (report.keyFindings.length > 0) {
    console.log('\n🔍 关键发现:');
    report.keyFindings.forEach(finding => {
      console.log(`  - ${finding.finding}: ${finding.status}`);
      console.log(`    ${finding.details}`);
    });
  }
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 修复建议:');
    report.recommendations.forEach(rec => {
      console.log(`  [${rec.priority}] ${rec.recommendation}`);
      console.log(`    ${rec.details}`);
    });
  }
  
  console.log('\n🔍 调试文件位置:');
  const debugFiles2 = fs.readdirSync('/tmp').filter(f => f.startsWith('gemini-tool-pipeline-debug'));
  debugFiles2.forEach(file => {
    console.log(`  /tmp/${file}`);
  });
}

// 运行测试
main().catch(error => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});