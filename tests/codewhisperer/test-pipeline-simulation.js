#!/usr/bin/env node

/**
 * CodeWhisperer流水线模拟测试
 * 基于demo3标准验证CodeWhisperer的完整流水线处理
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 测试配置
const PIPELINE_TEST_CONFIG = {
  baseUrl: 'http://localhost:8080',
  testDataDir: path.join(__dirname, '../../data/pipeline-test'),
  logDir: '/tmp/codewhisperer-pipeline-simulation',
  timeout: 30000,
  
  // 流水线阶段配置
  stages: [
    {
      name: 'input-processing',
      endpoint: '/debug/input-processing',
      description: '输入处理阶段 - 验证请求解析和验证'
    },
    {
      name: 'routing-logic',
      endpoint: '/debug/routing-logic', 
      description: '路由逻辑阶段 - 验证模型路由和Provider选择'
    },
    {
      name: 'transformation',
      endpoint: '/debug/transformation',
      description: '格式转换阶段 - 验证请求/响应格式转换'
    },
    {
      name: 'provider-call',
      endpoint: '/debug/provider-call',
      description: 'Provider调用阶段 - 验证实际API调用'
    },
    {
      name: 'response-pipeline',
      endpoint: '/debug/response-pipeline',
      description: '响应流水线阶段 - 验证响应处理流水线'
    },
    {
      name: 'output-formatting',
      endpoint: '/debug/output-formatting',
      description: '输出格式化阶段 - 验证最终响应格式'
    }
  ],
  
  // 测试场景
  scenarios: [
    {
      name: 'basic_text_flow',
      description: '基础文本处理流程',
      input: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: 'Explain quantum computing in simple terms.' }
        ]
      },
      expectedStages: ['input-processing', 'routing-logic', 'provider-call', 'response-pipeline', 'output-formatting']
    },
    {
      name: 'tool_call_flow',
      description: '工具调用处理流程',
      input: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: 'What is the current weather in Tokyo?' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather information',
              parameters: {
                type: 'object',
                properties: {
                  city: { type: 'string', description: 'City name' },
                  units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' }
                },
                required: ['city']
              }
            }
          }
        ]
      },
      expectedStages: ['input-processing', 'routing-logic', 'transformation', 'provider-call', 'response-pipeline', 'output-formatting']
    },
    {
      name: 'streaming_flow',
      description: '流式处理流程',
      input: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        stream: true,
        messages: [
          { role: 'user', content: 'Write a creative story about artificial intelligence.' }
        ]
      },
      expectedStages: ['input-processing', 'routing-logic', 'provider-call', 'response-pipeline', 'output-formatting']
    },
    {
      name: 'error_handling_flow',
      description: '错误处理流程',
      input: {
        model: 'invalid-model-name',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: 'This should trigger an error.' }
        ]
      },
      expectedStages: ['input-processing', 'routing-logic'],
      expectError: true
    }
  ]
};

// 确保必要目录存在
[PIPELINE_TEST_CONFIG.testDataDir, PIPELINE_TEST_CONFIG.logDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * 执行流水线模拟测试
 */
async function executePipelineSimulation(scenario) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(PIPELINE_TEST_CONFIG.logDir, `${scenario.name}-${timestamp}.log`);
  
  console.log(`\n🔄 执行流水线模拟: ${scenario.description}`);
  console.log(`📝 日志文件: ${logFile}`);
  
  const results = {
    scenario: scenario.name,
    description: scenario.description,
    timestamp,
    input: scenario.input,
    stages: {},
    pipeline: {
      totalStages: 0,
      completedStages: 0,
      failedStages: 0,
      skippedStages: 0
    },
    performance: {
      totalDuration: 0,
      stageTimings: {}
    },
    logFile
  };
  
  const overallStartTime = Date.now();
  
  try {
    // 执行每个流水线阶段
    for (const stage of PIPELINE_TEST_CONFIG.stages) {
      const shouldExecute = scenario.expectedStages.includes(stage.name);
      
      if (!shouldExecute) {
        console.log(`  ⏭️  跳过阶段: ${stage.description}`);
        results.stages[stage.name] = { skipped: true, reason: 'Not expected for this scenario' };
        results.pipeline.skippedStages++;
        continue;
      }
      
      console.log(`  🔧 执行阶段: ${stage.description}`);
      
      const stageResult = await executeStage(stage, scenario.input, results);
      results.stages[stage.name] = stageResult;
      results.pipeline.totalStages++;
      
      if (stageResult.success) {
        results.pipeline.completedStages++;
        console.log(`    ✅ 阶段完成 (${stageResult.duration}ms)`);
      } else {
        results.pipeline.failedStages++;
        console.log(`    ❌ 阶段失败: ${stageResult.error}`);
        
        // 如果不是预期的错误，停止执行
        if (!scenario.expectError) {
          break;
        }
      }
      
      results.performance.stageTimings[stage.name] = stageResult.duration;
    }
    
    results.performance.totalDuration = Date.now() - overallStartTime;
    
    // 执行端到端测试
    console.log(`  🌐 执行端到端测试...`);
    const e2eResult = await executeEndToEndTest(scenario.input);
    results.endToEnd = e2eResult;
    
    // 分析流水线完整性
    results.analysis = analyzePipelineCompleteness(results, scenario);
    
    // 写入详细日志
    fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
    
    console.log(`  📊 流水线完成度: ${results.analysis.completenessScore}%`);
    console.log(`  ⏱️  总耗时: ${results.performance.totalDuration}ms`);
    
    return results;
    
  } catch (error) {
    console.error(`  ❌ 流水线模拟失败: ${error.message}`);
    results.error = error.message;
    results.performance.totalDuration = Date.now() - overallStartTime;
    fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
    return results;
  }
}

/**
 * 执行单个流水线阶段
 */
async function executeStage(stage, input, previousResults) {
  const startTime = Date.now();
  
  try {
    // 构建请求数据
    const requestData = {
      stage: stage.name,
      input: input,
      previousStages: Object.keys(previousResults.stages).reduce((acc, stageName) => {
        if (previousResults.stages[stageName].success) {
          acc[stageName] = previousResults.stages[stageName].output;
        }
        return acc;
      }, {})
    };
    
    const response = await axios.post(
      `${PIPELINE_TEST_CONFIG.baseUrl}${stage.endpoint}`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Stage': stage.name,
          'X-Test-Scenario': previousResults.scenario
        },
        timeout: PIPELINE_TEST_CONFIG.timeout
      }
    );
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      duration,
      statusCode: response.status,
      output: response.data,
      metadata: {
        stage: stage.name,
        inputSize: JSON.stringify(input).length,
        outputSize: JSON.stringify(response.data).length,
        processingTime: response.headers['x-processing-time'] || duration
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      duration,
      error: error.message,
      statusCode: error.response?.status,
      output: error.response?.data,
      metadata: {
        stage: stage.name,
        errorType: error.code || 'unknown',
        errorDetails: error.response?.data
      }
    };
  }
}

/**
 * 执行端到端测试
 */
async function executeEndToEndTest(input) {
  const startTime = Date.now();
  
  try {
    const endpoint = input.stream ? '/v1/messages/stream' : '/v1/messages';
    const config = {
      method: 'POST',
      url: `${PIPELINE_TEST_CONFIG.baseUrl}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-Test-Type': 'pipeline-simulation'
      },
      data: input,
      timeout: PIPELINE_TEST_CONFIG.timeout
    };
    
    if (input.stream) {
      config.responseType = 'stream';
    }
    
    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    let responseData;
    if (input.stream) {
      responseData = await processStreamResponse(response.data);
    } else {
      responseData = response.data;
    }
    
    return {
      success: true,
      duration,
      statusCode: response.status,
      data: responseData,
      metadata: {
        streaming: !!input.stream,
        hasToolCalls: hasToolCalls(responseData),
        contentLength: getContentLength(responseData),
        responseHeaders: extractRelevantHeaders(response.headers)
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      duration,
      error: error.message,
      statusCode: error.response?.status,
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
  if (chunk.delta && chunk.delta.text) {
    return chunk.delta.text;
  }
  if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
    return chunk.choices[0].delta.content || '';
  }
  return '';
}

/**
 * 检查响应是否包含工具调用
 */
function hasToolCalls(responseData) {
  if (!responseData) return false;
  
  if (responseData.content) {
    return responseData.content.some(c => c.type === 'tool_use');
  }
  
  if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
    return !!responseData.choices[0].message.tool_calls;
  }
  
  if (responseData.chunks) {
    return responseData.chunks.some(chunk => 
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
 * 提取相关的响应头
 */
function extractRelevantHeaders(headers) {
  const relevantHeaders = {};
  const headerKeys = ['content-type', 'x-request-id', 'x-processing-time', 'x-pipeline-stages'];
  
  for (const key of headerKeys) {
    if (headers[key]) {
      relevantHeaders[key] = headers[key];
    }
  }
  
  return relevantHeaders;
}

/**
 * 分析流水线完整性
 */
function analyzePipelineCompleteness(results, scenario) {
  const analysis = {
    completenessScore: 0,
    issues: [],
    recommendations: [],
    stageAnalysis: {}
  };
  
  // 计算完成度评分
  const expectedStages = scenario.expectedStages.length;
  const completedStages = results.pipeline.completedStages;
  analysis.completenessScore = Math.round((completedStages / expectedStages) * 100);
  
  // 分析各阶段性能
  for (const [stageName, stageResult] of Object.entries(results.stages)) {
    if (stageResult.skipped) continue;
    
    const stageAnalysis = {
      success: stageResult.success,
      duration: stageResult.duration,
      performance: 'normal'
    };
    
    // 性能分析
    if (stageResult.duration > 5000) {
      stageAnalysis.performance = 'slow';
      analysis.issues.push(`${stageName}阶段响应时间过长 (${stageResult.duration}ms)`);
    } else if (stageResult.duration > 2000) {
      stageAnalysis.performance = 'moderate';
    } else {
      stageAnalysis.performance = 'fast';
    }
    
    // 错误分析
    if (!stageResult.success) {
      analysis.issues.push(`${stageName}阶段执行失败: ${stageResult.error}`);
      
      if (stageResult.statusCode === 404) {
        analysis.recommendations.push(`实现${stageName}阶段的调试端点`);
      } else if (stageResult.statusCode >= 500) {
        analysis.recommendations.push(`检查${stageName}阶段的服务器错误`);
      }
    }
    
    analysis.stageAnalysis[stageName] = stageAnalysis;
  }
  
  // 端到端测试分析
  if (results.endToEnd) {
    if (!results.endToEnd.success) {
      analysis.issues.push(`端到端测试失败: ${results.endToEnd.error}`);
    } else {
      // 检查工具调用处理
      if (scenario.input.tools && !results.endToEnd.metadata.hasToolCalls) {
        analysis.issues.push('工具调用未被正确处理');
        analysis.recommendations.push('检查工具调用检测和处理逻辑');
      }
      
      // 检查流式处理
      if (scenario.input.stream && results.endToEnd.metadata.streaming !== true) {
        analysis.issues.push('流式处理未正确工作');
        analysis.recommendations.push('检查流式响应处理逻辑');
      }
    }
  }
  
  // 总体建议
  if (analysis.completenessScore < 80) {
    analysis.recommendations.push('流水线完整性不足，需要实现缺失的阶段');
  }
  
  if (results.performance.totalDuration > 10000) {
    analysis.recommendations.push('整体响应时间过长，需要优化性能');
  }
  
  return analysis;
}

/**
 * 生成流水线测试报告
 */
function generatePipelineReport(results) {
  const timestamp = new Date().toISOString();
  const reportFile = path.join(PIPELINE_TEST_CONFIG.logDir, `pipeline-report-${timestamp.replace(/[:.]/g, '-')}.md`);
  
  let report = `# CodeWhisperer流水线模拟测试报告\n\n`;
  report += `**测试时间**: ${timestamp}\n`;
  report += `**测试场景数**: ${results.length}\n\n`;
  
  // 总体统计
  const successfulTests = results.filter(r => !r.error && r.analysis?.completenessScore >= 80).length;
  const averageCompleteness = results.reduce((sum, r) => sum + (r.analysis?.completenessScore || 0), 0) / results.length;
  const averageDuration = results.reduce((sum, r) => sum + (r.performance?.totalDuration || 0), 0) / results.length;
  
  report += `## 📊 总体统计\n\n`;
  report += `- **成功测试**: ${successfulTests}/${results.length}\n`;
  report += `- **平均完整性评分**: ${averageCompleteness.toFixed(1)}%\n`;
  report += `- **平均响应时间**: ${averageDuration.toFixed(0)}ms\n`;
  report += `- **测试通过率**: ${(successfulTests / results.length * 100).toFixed(1)}%\n\n`;
  
  // 流水线阶段统计
  const stageStats = {};
  for (const result of results) {
    for (const [stageName, stageResult] of Object.entries(result.stages || {})) {
      if (!stageStats[stageName]) {
        stageStats[stageName] = { total: 0, success: 0, failed: 0, skipped: 0 };
      }
      stageStats[stageName].total++;
      if (stageResult.skipped) {
        stageStats[stageName].skipped++;
      } else if (stageResult.success) {
        stageStats[stageName].success++;
      } else {
        stageStats[stageName].failed++;
      }
    }
  }
  
  report += `## 🔧 流水线阶段统计\n\n`;
  report += `| 阶段 | 总数 | 成功 | 失败 | 跳过 | 成功率 |\n`;
  report += `|------|------|------|------|------|--------|\n`;
  
  for (const [stageName, stats] of Object.entries(stageStats)) {
    const successRate = stats.total > 0 ? (stats.success / (stats.total - stats.skipped) * 100).toFixed(1) : '0.0';
    report += `| ${stageName} | ${stats.total} | ${stats.success} | ${stats.failed} | ${stats.skipped} | ${successRate}% |\n`;
  }
  
  report += `\n`;
  
  // 详细结果
  report += `## 📋 详细测试结果\n\n`;
  
  for (const result of results) {
    report += `### ${result.description}\n\n`;
    
    if (result.error) {
      report += `❌ **测试失败**: ${result.error}\n\n`;
      continue;
    }
    
    report += `- **完整性评分**: ${result.analysis?.completenessScore || 0}%\n`;
    report += `- **总耗时**: ${result.performance?.totalDuration || 0}ms\n`;
    report += `- **完成阶段**: ${result.pipeline?.completedStages || 0}/${result.pipeline?.totalStages || 0}\n`;
    
    if (result.endToEnd) {
      report += `- **端到端测试**: ${result.endToEnd.success ? '✅ 成功' : '❌ 失败'}\n`;
    }
    
    if (result.analysis?.issues.length > 0) {
      report += `- **发现问题**:\n`;
      for (const issue of result.analysis.issues) {
        report += `  - ${issue}\n`;
      }
    }
    
    report += `- **日志文件**: \`${result.logFile}\`\n\n`;
  }
  
  // 改进建议
  report += `## 🔧 改进建议\n\n`;
  
  const allRecommendations = results.flatMap(r => r.analysis?.recommendations || []);
  const uniqueRecommendations = [...new Set(allRecommendations)];
  
  if (uniqueRecommendations.length > 0) {
    report += `基于流水线测试结果，建议进行以下改进：\n\n`;
    for (const recommendation of uniqueRecommendations) {
      report += `- ${recommendation}\n`;
    }
  } else {
    report += `🎉 所有流水线阶段都正常工作！\n`;
  }
  
  report += `\n---\n`;
  report += `**报告生成时间**: ${timestamp}\n`;
  report += `**测试工具**: CodeWhisperer Pipeline Simulation Test v1.0\n`;
  
  fs.writeFileSync(reportFile, report);
  console.log(`\n📄 流水线测试报告已生成: ${reportFile}`);
  
  return reportFile;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始CodeWhisperer流水线模拟测试');
  console.log(`📁 日志目录: ${PIPELINE_TEST_CONFIG.logDir}`);
  
  const results = [];
  
  for (const scenario of PIPELINE_TEST_CONFIG.scenarios) {
    const result = await executePipelineSimulation(scenario);
    results.push(result);
  }
  
  // 生成测试报告
  const reportFile = generatePipelineReport(results);
  
  // 输出总结
  console.log('\n🎯 流水线测试总结:');
  const successCount = results.filter(r => !r.error && r.analysis?.completenessScore >= 80).length;
  const averageCompleteness = results.reduce((sum, r) => sum + (r.analysis?.completenessScore || 0), 0) / results.length;
  
  console.log(`  ✅ 成功测试: ${successCount}/${results.length}`);
  console.log(`  📊 平均完整性评分: ${averageCompleteness.toFixed(1)}%`);
  console.log(`  📄 详细报告: ${reportFile}`);
  
  // 根据结果设置退出码
  const overallSuccess = successCount === results.length && averageCompleteness >= 80;
  process.exit(overallSuccess ? 0 : 1);
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 流水线测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  executePipelineSimulation,
  executeStage,
  executeEndToEndTest,
  analyzePipelineCompleteness,
  generatePipelineReport
};