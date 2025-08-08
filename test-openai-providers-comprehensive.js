#!/usr/bin/env node
/**
 * OpenAI Provider全面测试 - 所有兼容供应商工具解析和响应测试
 * 测试端口: 5506 (LMStudio), 5507 (ModelScope), 5508 (ShuaiHong), 5509 (ModelScope GLM)
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

// 配置数据库路径
const DATABASE_DIR = path.join(process.env.HOME, '.route-claude-code', 'config', 'database');
const OPENAI_TEST_DIR = path.join(DATABASE_DIR, 'openai-provider-test');

// 确保数据库目录存在
function ensureDatabaseExists() {
  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }
  if (!fs.existsSync(OPENAI_TEST_DIR)) {
    fs.mkdirSync(OPENAI_TEST_DIR, { recursive: true });
  }
}

// OpenAI Provider测试配置
const OPENAI_PROVIDERS = [
  {
    id: 'lmstudio-5506',
    name: 'LM Studio',
    port: 5506,
    models: ['qwen3-30b', 'glm-4.5-air'],
    endpoint: 'http://localhost:5506/v1/chat/completions',
    configFile: 'config-openai-lmstudio-5506.json'
  },
  {
    id: 'modelscope-5507', 
    name: 'ModelScope',
    port: 5507,
    models: ['Qwen3-Coder-480B'],
    endpoint: 'http://localhost:5507/v1/chat/completions',
    configFile: 'config-openai-modelscope-5507.json'
  },
  {
    id: 'shuaihong-5508',
    name: 'ShuaiHong',
    port: 5508,
    models: ['claude-4-sonnet', 'gemini-2.5-pro'],
    endpoint: 'http://localhost:5508/v1/chat/completions', 
    configFile: 'config-openai-shuaihong-5508.json'
  },
  {
    id: 'modelscope-glm-5509',
    name: 'ModelScope GLM',
    port: 5509,
    models: ['ZhipuAI/GLM-4.5'],
    endpoint: 'http://localhost:5509/v1/chat/completions',
    configFile: 'config-openai-modelscope-glm-5509.json'
  }
];

// 测试场景定义
const TEST_SCENARIOS = [
  {
    id: 'simple-text',
    name: '简单文本请求',
    request: {
      model: 'test-model',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      max_tokens: 100,
      temperature: 0.7
    }
  },
  {
    id: 'tool-call-single', 
    name: '单工具调用',
    request: {
      model: 'test-model',
      messages: [
        { 
          role: 'user', 
          content: 'What is the weather like in Beijing today? Use the weather tool to check.' 
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather information for a location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city and country, e.g. Beijing, China'
                },
                units: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: 'Temperature units'
                }
              },
              required: ['location']
            }
          }
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    }
  },
  {
    id: 'tool-call-multiple',
    name: '多工具调用',
    request: {
      model: 'test-model', 
      messages: [
        { 
          role: 'user', 
          content: 'Check the weather in Beijing and calculate 15 + 27. Use the appropriate tools.' 
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather information for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'The city and country' }
              },
              required: ['location']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'calculate',
            description: 'Perform mathematical calculations',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: 'Math expression to calculate' }
              },
              required: ['expression']
            }
          }
        }
      ],
      max_tokens: 300,
      temperature: 0.3
    }
  },
  {
    id: 'large-text-with-tools',
    name: '大文本工具解析',
    request: {
      model: 'test-model',
      messages: [
        { 
          role: 'user', 
          content: `Please analyze this large text and summarize the key points:

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

Use the text analysis tool to process this content and extract key insights.` 
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'analyze_text',
            description: 'Analyze text content and extract key insights',
            parameters: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'Text content to analyze' },
                analysis_type: { type: 'string', enum: ['summary', 'keywords', 'sentiment'], description: 'Type of analysis' }
              },
              required: ['text', 'analysis_type']
            }
          }
        }
      ],
      max_tokens: 500,
      temperature: 0.5
    }
  },
  {
    id: 'streaming-tool-call',
    name: '流式工具调用',
    request: {
      model: 'test-model',
      messages: [
        { 
          role: 'user', 
          content: 'Get the current time and format it nicely. Use the time tool.' 
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_current_time',
            description: 'Get the current time',
            parameters: {
              type: 'object',
              properties: {
                timezone: { type: 'string', description: 'Timezone (optional)' },
                format: { type: 'string', description: 'Time format (optional)' }
              }
            }
          }
        }
      ],
      stream: true,
      max_tokens: 150,
      temperature: 0.3
    }
  }
];

// 保存原始数据到数据库
function saveRawData(providerId, scenarioId, type, data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${providerId}-${scenarioId}-${type}-${timestamp}.json`;
  const filepath = path.join(OPENAI_TEST_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`📁 保存原始数据: ${filename}`);
    return filepath;
  } catch (error) {
    console.error(`❌ 保存数据失败: ${error.message}`);
    return null;
  }
}

// HTTP请求函数
async function makeHttpRequest(url, options) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
        ...options.headers
      },
      body: JSON.stringify(options.body)
    });

    const duration = Date.now() - startTime;
    const contentType = response.headers.get('content-type');
    
    let responseData;
    if (contentType && contentType.includes('text/event-stream')) {
      // 流式响应处理
      const text = await response.text();
      responseData = { 
        stream: true, 
        events: text.split('\n\n').filter(chunk => chunk.trim()),
        rawText: text
      };
    } else {
      // 普通JSON响应
      responseData = await response.json();
    }

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      duration,
      error: response.ok ? null : responseData.error || `HTTP ${response.status}`
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      status: 0,
      statusText: 'Network Error',
      headers: {},
      data: null,
      duration,
      error: error.message
    };
  }
}

// 检查服务器连通性
async function checkServerHealth(provider) {
  try {
    const healthUrl = `http://localhost:${provider.port}/health`;
    const response = await fetch(healthUrl);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// 分析工具解析结果
function analyzeToolParsing(responseData, scenario) {
  const analysis = {
    hasToolCalls: false,
    toolCallCount: 0,
    toolCallDetails: [],
    parsingIssues: [],
    responseStructure: 'unknown'
  };

  if (!responseData) {
    analysis.parsingIssues.push('No response data');
    return analysis;
  }

  // 检查流式响应中的工具调用
  if (responseData.stream && responseData.events) {
    analysis.responseStructure = 'streaming';
    for (const event of responseData.events) {
      if (event.includes('tool_use') || event.includes('tool_call')) {
        analysis.hasToolCalls = true;
        analysis.toolCallCount++;
        
        try {
          const parsed = JSON.parse(event.split('data: ')[1]);
          if (parsed.data && parsed.data.content_block) {
            analysis.toolCallDetails.push(parsed.data.content_block);
          }
        } catch (e) {
          analysis.parsingIssues.push(`Tool call parsing error: ${e.message}`);
        }
      }
    }
  }
  
  // 检查普通响应中的工具调用
  else if (responseData.choices) {
    analysis.responseStructure = 'json';
    for (const choice of responseData.choices) {
      if (choice.message && choice.message.tool_calls) {
        analysis.hasToolCalls = true;
        analysis.toolCallCount += choice.message.tool_calls.length;
        analysis.toolCallDetails = choice.message.tool_calls;
      }
    }
  }

  // 验证工具调用完整性
  if (scenario.request.tools && scenario.request.tools.length > 0) {
    if (!analysis.hasToolCalls) {
      analysis.parsingIssues.push('Expected tool calls but none found in response');
    } else if (analysis.toolCallCount === 0) {
      analysis.parsingIssues.push('Tool calls detected but count is 0');
    }
  }

  return analysis;
}

// 执行单个测试
async function runSingleTest(provider, scenario) {
  console.log(`\n🔧 测试 ${provider.name} - ${scenario.name}`);
  
  // 检查服务器连通性
  const isHealthy = await checkServerHealth(provider);
  if (!isHealthy) {
    console.log(`❌ 服务器 ${provider.name}:${provider.port} 不可用`);
    return {
      provider: provider.id,
      scenario: scenario.id,
      success: false,
      error: 'Server not available',
      analysis: null
    };
  }

  // 保存请求数据
  const requestPath = saveRawData(provider.id, scenario.id, 'request', scenario.request);

  // 发送请求
  const response = await makeHttpRequest(provider.endpoint, {
    body: scenario.request
  });

  // 保存响应数据
  const responsePath = saveRawData(provider.id, scenario.id, 'response', response);

  // 分析工具解析结果
  const analysis = analyzeToolParsing(response.data, scenario);

  console.log(`   📊 状态: ${response.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`   ⏱️  耗时: ${response.duration}ms`);
  console.log(`   🔧 工具调用: ${analysis.hasToolCalls ? `✅ ${analysis.toolCallCount}个` : '❌ 无'}`);
  
  if (analysis.parsingIssues.length > 0) {
    console.log(`   ⚠️  解析问题: ${analysis.parsingIssues.join(', ')}`);
  }
  
  if (response.error) {
    console.log(`   ❌ 错误: ${response.error}`);
  }

  return {
    provider: provider.id,
    scenario: scenario.id,
    success: response.success,
    duration: response.duration,
    status: response.status,
    error: response.error,
    analysis,
    dataFiles: {
      request: requestPath,
      response: responsePath
    }
  };
}

// 生成综合报告
function generateReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 OpenAI Provider 综合测试报告');
  console.log('='.repeat(80));

  // 按Provider分组统计
  const providerStats = {};
  const scenarioStats = {};
  
  for (const result of results) {
    // Provider统计
    if (!providerStats[result.provider]) {
      providerStats[result.provider] = {
        total: 0,
        success: 0,
        failed: 0,
        toolCallSuccess: 0,
        avgDuration: 0,
        totalDuration: 0
      };
    }
    
    const pStats = providerStats[result.provider];
    pStats.total++;
    pStats.totalDuration += result.duration || 0;
    pStats.avgDuration = Math.round(pStats.totalDuration / pStats.total);
    
    if (result.success) {
      pStats.success++;
      if (result.analysis && result.analysis.hasToolCalls) {
        pStats.toolCallSuccess++;
      }
    } else {
      pStats.failed++;
    }

    // 场景统计
    if (!scenarioStats[result.scenario]) {
      scenarioStats[result.scenario] = { total: 0, success: 0 };
    }
    scenarioStats[result.scenario].total++;
    if (result.success) {
      scenarioStats[result.scenario].success++;
    }
  }

  // 打印Provider统计
  console.log('\n🏢 Provider 性能统计:');
  for (const [providerId, stats] of Object.entries(providerStats)) {
    const provider = OPENAI_PROVIDERS.find(p => p.id === providerId);
    const successRate = ((stats.success / stats.total) * 100).toFixed(1);
    const toolCallRate = stats.success > 0 ? ((stats.toolCallSuccess / stats.success) * 100).toFixed(1) : '0';
    
    console.log(`   ${provider?.name || providerId}:`);
    console.log(`     成功率: ${successRate}% (${stats.success}/${stats.total})`);
    console.log(`     工具调用成功率: ${toolCallRate}% (${stats.toolCallSuccess}/${stats.success})`);
    console.log(`     平均响应时间: ${stats.avgDuration}ms`);
  }

  // 打印场景统计  
  console.log('\n🎯 测试场景统计:');
  for (const [scenarioId, stats] of Object.entries(scenarioStats)) {
    const scenario = TEST_SCENARIOS.find(s => s.id === scenarioId);
    const successRate = ((stats.success / stats.total) * 100).toFixed(1);
    console.log(`   ${scenario?.name || scenarioId}: ${successRate}% (${stats.success}/${stats.total})`);
  }

  // 问题汇总
  console.log('\n⚠️ 发现的问题:');
  const issues = results.filter(r => !r.success || (r.analysis && r.analysis.parsingIssues.length > 0));
  
  if (issues.length === 0) {
    console.log('   ✅ 没有发现问题，所有测试都通过了！');
  } else {
    for (const issue of issues) {
      const provider = OPENAI_PROVIDERS.find(p => p.id === issue.provider);
      const scenario = TEST_SCENARIOS.find(s => s.id === issue.scenario);
      console.log(`   ❌ ${provider?.name}/${scenario?.name}:`);
      if (issue.error) {
        console.log(`      - 网络错误: ${issue.error}`);
      }
      if (issue.analysis && issue.analysis.parsingIssues.length > 0) {
        for (const parseIssue of issue.analysis.parsingIssues) {
          console.log(`      - 解析问题: ${parseIssue}`);
        }
      }
    }
  }

  // 保存完整报告
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.length,
      successfulTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length,
      issuesFound: issues.length
    },
    providerStats,
    scenarioStats,
    detailedResults: results,
    issues: issues.map(issue => ({
      provider: issue.provider,
      scenario: issue.scenario,
      error: issue.error,
      parsingIssues: issue.analysis?.parsingIssues || []
    }))
  };
  
  const reportPath = saveRawData('comprehensive', 'all-providers', 'report', reportData);
  console.log(`\n📋 完整报告已保存: ${reportPath}`);
  
  return reportData;
}

// 主测试函数
async function runComprehensiveTest() {
  console.log('🚀 开始 OpenAI Provider 全面测试');
  console.log(`📁 数据保存目录: ${OPENAI_TEST_DIR}`);
  
  // 确保数据库目录存在
  ensureDatabaseExists();

  const results = [];
  let totalTests = 0;
  
  // 遍历所有Provider和测试场景
  for (const provider of OPENAI_PROVIDERS) {
    console.log(`\n🏢 开始测试 ${provider.name} (端口 ${provider.port})`);
    
    for (const scenario of TEST_SCENARIOS) {
      totalTests++;
      const result = await runSingleTest(provider, scenario);
      results.push(result);
      
      // 测试间隔，避免过于频繁的请求
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n✅ 所有测试完成！总计执行了 ${totalTests} 个测试。`);
  
  // 生成并显示报告
  const report = generateReport(results);
  
  // 输出数据库信息
  console.log('\n📂 测试数据已保存到数据库:');
  console.log(`   目录: ${OPENAI_TEST_DIR}`);
  console.log(`   包含原始请求/响应数据用于后续分析`);
  
  return report;
}

// 如果直接运行此脚本
if (require.main === module) {
  runComprehensiveTest().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  runComprehensiveTest,
  OPENAI_PROVIDERS,
  TEST_SCENARIOS,
  analyzeToolParsing
};