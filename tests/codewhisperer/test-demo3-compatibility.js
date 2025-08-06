#!/usr/bin/env node

/**
 * CodeWhisperer与demo3兼容性对比测试
 * 验证CodeWhisperer实现是否完全符合demo3标准
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 测试配置
const TEST_CONFIG = {
  codewhispererEndpoint: 'http://localhost:8080/v1/messages',
  demo3Endpoint: 'http://localhost:3000/v1/chat/completions', // demo3标准端点
  testCases: [
    {
      name: 'basic_text_request',
      description: '基础文本请求对比',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: 'Hello, how are you?' }
        ]
      }
    },
    {
      name: 'tool_call_request',
      description: '工具调用请求对比',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: 'What is the weather like in Beijing?' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information for a city',
              parameters: {
                type: 'object',
                properties: {
                  city: { type: 'string', description: 'City name' }
                },
                required: ['city']
              }
            }
          }
        ]
      }
    },
    {
      name: 'streaming_request',
      description: '流式请求对比',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        stream: true,
        messages: [
          { role: 'user', content: 'Write a short story about a robot.' }
        ]
      }
    }
  ],
  timeout: 30000,
  logDir: '/tmp/codewhisperer-demo3-comparison'
};

// 确保日志目录存在
if (!fs.existsSync(TEST_CONFIG.logDir)) {
  fs.mkdirSync(TEST_CONFIG.logDir, { recursive: true });
}

/**
 * 执行单个测试用例
 */
async function executeTestCase(testCase) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(TEST_CONFIG.logDir, `${testCase.name}-${timestamp}.log`);
  
  console.log(`\n🧪 执行测试: ${testCase.description}`);
  console.log(`📝 日志文件: ${logFile}`);
  
  const results = {
    testCase: testCase.name,
    description: testCase.description,
    timestamp,
    codewhisperer: null,
    demo3: null,
    comparison: null,
    logFile
  };
  
  try {
    // 测试CodeWhisperer实现
    console.log('  📡 测试CodeWhisperer实现...');
    const codewhispererResult = await testCodeWhispererEndpoint(testCase);
    results.codewhisperer = codewhispererResult;
    
    // 测试demo3标准实现（如果可用）
    console.log('  📡 测试demo3标准实现...');
    try {
      const demo3Result = await testDemo3Endpoint(testCase);
      results.demo3 = demo3Result;
    } catch (demo3Error) {
      console.log(`  ⚠️  demo3端点不可用: ${demo3Error.message}`);
      results.demo3 = { error: demo3Error.message, available: false };
    }
    
    // 执行对比分析
    results.comparison = compareResults(results.codewhisperer, results.demo3);
    
    // 写入详细日志
    fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
    
    // 输出结果摘要
    console.log(`  ✅ 测试完成`);
    if (results.comparison) {
      console.log(`  📊 兼容性评分: ${results.comparison.compatibilityScore}%`);
      console.log(`  🔍 主要差异: ${results.comparison.majorDifferences.length}个`);
    }
    
    return results;
    
  } catch (error) {
    console.error(`  ❌ 测试失败: ${error.message}`);
    results.error = error.message;
    fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
    return results;
  }
}

/**
 * 测试CodeWhisperer端点
 */
async function testCodeWhispererEndpoint(testCase) {
  const startTime = Date.now();
  
  try {
    const config = {
      method: 'POST',
      url: TEST_CONFIG.codewhispererEndpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'User-Agent': 'CodeWhisperer-Demo3-Compatibility-Test/1.0'
      },
      data: testCase.request,
      timeout: TEST_CONFIG.timeout
    };
    
    if (testCase.request.stream) {
      config.responseType = 'stream';
    }
    
    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    let responseData;
    if (testCase.request.stream) {
      // 处理流式响应
      responseData = await processStreamResponse(response.data);
    } else {
      responseData = response.data;
    }
    
    return {
      success: true,
      duration,
      statusCode: response.status,
      headers: extractRelevantHeaders(response.headers),
      data: responseData,
      metadata: {
        endpoint: 'codewhisperer',
        streaming: !!testCase.request.stream,
        hasToolCalls: hasToolCalls(responseData),
        contentLength: getContentLength(responseData)
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      error: error.message,
      statusCode: error.response?.status,
      headers: error.response?.headers ? extractRelevantHeaders(error.response.headers) : null,
      data: error.response?.data
    };
  }
}

/**
 * 测试demo3端点
 */
async function testDemo3Endpoint(testCase) {
  const startTime = Date.now();
  
  try {
    const config = {
      method: 'POST',
      url: TEST_CONFIG.demo3Endpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'User-Agent': 'Demo3-Standard-Test/1.0'
      },
      data: testCase.request,
      timeout: TEST_CONFIG.timeout
    };
    
    if (testCase.request.stream) {
      config.responseType = 'stream';
    }
    
    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    let responseData;
    if (testCase.request.stream) {
      responseData = await processStreamResponse(response.data);
    } else {
      responseData = response.data;
    }
    
    return {
      success: true,
      duration,
      statusCode: response.status,
      headers: extractRelevantHeaders(response.headers),
      data: responseData,
      metadata: {
        endpoint: 'demo3',
        streaming: !!testCase.request.stream,
        hasToolCalls: hasToolCalls(responseData),
        contentLength: getContentLength(responseData)
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      error: error.message,
      statusCode: error.response?.status,
      headers: error.response?.headers ? extractRelevantHeaders(error.response.headers) : null,
      data: error.response?.data
    };
  }
}

/**
 * 处理流式响应
 */
async function processStreamResponse(stream) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const chunks = [];
    
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6).trim();
          if (data && data !== '[DONE]') {
            try {
              chunks.push(JSON.parse(data));
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    });
    
    stream.on('end', () => {
      resolve({
        type: 'stream',
        chunks,
        totalChunks: chunks.length,
        combinedContent: chunks.map(c => extractContentFromChunk(c)).join('')
      });
    });
    
    stream.on('error', reject);
  });
}

/**
 * 从chunk中提取内容
 */
function extractContentFromChunk(chunk) {
  if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
    return chunk.choices[0].delta.content || '';
  }
  if (chunk.delta && chunk.delta.text) {
    return chunk.delta.text;
  }
  return '';
}

/**
 * 提取相关的响应头
 */
function extractRelevantHeaders(headers) {
  const relevantHeaders = {};
  const headerKeys = ['content-type', 'content-length', 'x-request-id', 'x-ratelimit-remaining', 'cache-control'];
  
  for (const key of headerKeys) {
    if (headers[key]) {
      relevantHeaders[key] = headers[key];
    }
  }
  
  return relevantHeaders;
}

/**
 * 检查响应是否包含工具调用
 */
function hasToolCalls(responseData) {
  if (!responseData) return false;
  
  // 检查Anthropic格式
  if (responseData.content) {
    return responseData.content.some(c => c.type === 'tool_use');
  }
  
  // 检查OpenAI格式
  if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
    return !!responseData.choices[0].message.tool_calls;
  }
  
  // 检查流式格式
  if (responseData.chunks) {
    return responseData.chunks.some(chunk => 
      (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.tool_calls) ||
      (chunk.type === 'content_block_start' && chunk.content_block && chunk.content_block.type === 'tool_use')
    );
  }
  
  return false;
}

/**
 * 获取内容长度
 */
function getContentLength(responseData) {
  if (!responseData) return 0;
  
  if (responseData.content) {
    return responseData.content.reduce((total, c) => {
      if (c.type === 'text') return total + (c.text || '').length;
      return total;
    }, 0);
  }
  
  if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
    return (responseData.choices[0].message.content || '').length;
  }
  
  if (responseData.combinedContent) {
    return responseData.combinedContent.length;
  }
  
  return 0;
}

/**
 * 对比两个结果
 */
function compareResults(codewhispererResult, demo3Result) {
  if (!codewhispererResult || !demo3Result || !demo3Result.available) {
    return {
      compatibilityScore: 0,
      majorDifferences: ['demo3端点不可用，无法进行对比'],
      detailedComparison: null
    };
  }
  
  const differences = [];
  let score = 100;
  
  // 比较成功状态
  if (codewhispererResult.success !== demo3Result.success) {
    differences.push('请求成功状态不一致');
    score -= 30;
  }
  
  // 比较状态码
  if (codewhispererResult.statusCode !== demo3Result.statusCode) {
    differences.push(`状态码不一致: ${codewhispererResult.statusCode} vs ${demo3Result.statusCode}`);
    score -= 10;
  }
  
  // 比较响应格式
  if (codewhispererResult.success && demo3Result.success) {
    const cwHasToolCalls = codewhispererResult.metadata?.hasToolCalls;
    const d3HasToolCalls = demo3Result.metadata?.hasToolCalls;
    
    if (cwHasToolCalls !== d3HasToolCalls) {
      differences.push(`工具调用检测结果不一致: ${cwHasToolCalls} vs ${d3HasToolCalls}`);
      score -= 20;
    }
    
    // 比较内容长度（允许10%的差异）
    const cwLength = codewhispererResult.metadata?.contentLength || 0;
    const d3Length = demo3Result.metadata?.contentLength || 0;
    
    if (Math.abs(cwLength - d3Length) / Math.max(cwLength, d3Length, 1) > 0.1) {
      differences.push(`内容长度差异较大: ${cwLength} vs ${d3Length}`);
      score -= 15;
    }
    
    // 比较响应时间（允许50%的差异）
    const cwDuration = codewhispererResult.duration || 0;
    const d3Duration = demo3Result.duration || 0;
    
    if (Math.abs(cwDuration - d3Duration) / Math.max(cwDuration, d3Duration, 1) > 0.5) {
      differences.push(`响应时间差异较大: ${cwDuration}ms vs ${d3Duration}ms`);
      score -= 5;
    }
  }
  
  return {
    compatibilityScore: Math.max(0, score),
    majorDifferences: differences,
    detailedComparison: {
      codewhisperer: codewhispererResult.metadata,
      demo3: demo3Result.metadata,
      performanceComparison: {
        codewhispererDuration: codewhispererResult.duration,
        demo3Duration: demo3Result.duration,
        speedRatio: demo3Result.duration ? (codewhispererResult.duration / demo3Result.duration).toFixed(2) : 'N/A'
      }
    }
  };
}

/**
 * 生成测试报告
 */
function generateTestReport(results) {
  const timestamp = new Date().toISOString();
  const reportFile = path.join(TEST_CONFIG.logDir, `compatibility-report-${timestamp.replace(/[:.]/g, '-')}.md`);
  
  let report = `# CodeWhisperer与demo3兼容性测试报告\n\n`;
  report += `**测试时间**: ${timestamp}\n`;
  report += `**测试用例数**: ${results.length}\n\n`;
  
  // 总体统计
  const successfulTests = results.filter(r => r.codewhisperer?.success && !r.error).length;
  const averageScore = results.reduce((sum, r) => sum + (r.comparison?.compatibilityScore || 0), 0) / results.length;
  
  report += `## 📊 总体统计\n\n`;
  report += `- **成功测试**: ${successfulTests}/${results.length}\n`;
  report += `- **平均兼容性评分**: ${averageScore.toFixed(1)}%\n`;
  report += `- **测试通过率**: ${(successfulTests / results.length * 100).toFixed(1)}%\n\n`;
  
  // 详细结果
  report += `## 📋 详细测试结果\n\n`;
  
  for (const result of results) {
    report += `### ${result.description}\n\n`;
    
    if (result.error) {
      report += `❌ **测试失败**: ${result.error}\n\n`;
      continue;
    }
    
    const cw = result.codewhisperer;
    const d3 = result.demo3;
    const comp = result.comparison;
    
    report += `- **CodeWhisperer状态**: ${cw?.success ? '✅ 成功' : '❌ 失败'}\n`;
    report += `- **demo3状态**: ${d3?.available !== false ? (d3?.success ? '✅ 成功' : '❌ 失败') : '⚠️ 不可用'}\n`;
    
    if (comp) {
      report += `- **兼容性评分**: ${comp.compatibilityScore}%\n`;
      if (comp.majorDifferences.length > 0) {
        report += `- **主要差异**:\n`;
        for (const diff of comp.majorDifferences) {
          report += `  - ${diff}\n`;
        }
      }
    }
    
    report += `- **日志文件**: \`${result.logFile}\`\n\n`;
  }
  
  // 改进建议
  report += `## 🔧 改进建议\n\n`;
  
  const allDifferences = results.flatMap(r => r.comparison?.majorDifferences || []);
  const uniqueDifferences = [...new Set(allDifferences)];
  
  if (uniqueDifferences.length > 0) {
    report += `基于测试结果，发现以下需要改进的方面：\n\n`;
    for (const diff of uniqueDifferences) {
      report += `- ${diff}\n`;
    }
  } else {
    report += `🎉 所有测试都通过了兼容性检查！\n`;
  }
  
  report += `\n---\n`;
  report += `**报告生成时间**: ${timestamp}\n`;
  report += `**测试工具**: CodeWhisperer Demo3 Compatibility Test v1.0\n`;
  
  fs.writeFileSync(reportFile, report);
  console.log(`\n📄 测试报告已生成: ${reportFile}`);
  
  return reportFile;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始CodeWhisperer与demo3兼容性对比测试');
  console.log(`📁 日志目录: ${TEST_CONFIG.logDir}`);
  
  const results = [];
  
  for (const testCase of TEST_CONFIG.testCases) {
    const result = await executeTestCase(testCase);
    results.push(result);
  }
  
  // 生成测试报告
  const reportFile = generateTestReport(results);
  
  // 输出总结
  console.log('\n🎯 测试总结:');
  const successCount = results.filter(r => r.codewhisperer?.success && !r.error).length;
  const averageScore = results.reduce((sum, r) => sum + (r.comparison?.compatibilityScore || 0), 0) / results.length;
  
  console.log(`  ✅ 成功测试: ${successCount}/${results.length}`);
  console.log(`  📊 平均兼容性评分: ${averageScore.toFixed(1)}%`);
  console.log(`  📄 详细报告: ${reportFile}`);
  
  // 根据结果设置退出码
  const overallSuccess = successCount === results.length && averageScore >= 80;
  process.exit(overallSuccess ? 0 : 1);
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  executeTestCase,
  testCodeWhispererEndpoint,
  testDemo3Endpoint,
  compareResults,
  generateTestReport
};