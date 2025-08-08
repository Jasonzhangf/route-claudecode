#!/usr/bin/env node
/**
 * CodeWhisperer全面工具解析和响应测试
 * 测试所有兼容供应商的工具调用能力和大文本解析
 * 项目所有者: Jason Zhang
 */

const fs = require('fs').promises;
const path = require('path');

// 确保数据库目录存在
async function ensureDatabaseDir() {
  const dbDir = path.join(process.env.HOME || '/tmp', '.route-claude-code/config/database');
  await fs.mkdir(dbDir, { recursive: true });
  return dbDir;
}

// 保存原始数据
async function saveRawData(filename, data) {
  const dbDir = await ensureDatabaseDir();
  const filepath = path.join(dbDir, filename);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  console.log(`📁 原始数据已保存: ${filepath}`);
  return filepath;
}

// CodeWhisperer供应商配置
const CODEWHISPERER_PROVIDERS = {
  '5501': {
    name: 'Primary Account',
    endpoint: 'http://localhost:5501',
    models: ['CLAUDE_SONNET_4_20250514_V1_0'],
    authMethod: 'oauth'
  },
  '5503': {
    name: 'Kiro-GitHub', 
    endpoint: 'http://localhost:5503',
    models: ['CLAUDE_SONNET_4_20250514_V1_0'],
    authMethod: 'oauth'
  },
  '5504': {
    name: 'Kiro-Gmail',
    endpoint: 'http://localhost:5504', 
    models: ['CLAUDE_SONNET_4', 'CLAUDE_3_7_SONNET'],
    authMethod: 'social'
  },
  '5505': {
    name: 'Kiro-Zcam',
    endpoint: 'http://localhost:5505',
    models: ['CLAUDE_SONNET_4', 'CLAUDE_3_7_SONNET'], 
    authMethod: 'oauth'
  }
};

// 测试用例定义
const TEST_CASES = {
  // 基础工具调用
  basic_tool: {
    name: '基础工具调用',
    messages: [
      {
        role: 'user', 
        content: 'Please list the files in the current directory using the bash tool.'
      }
    ],
    tools: [
      {
        name: 'bash',
        description: 'Execute bash command',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' }
          },
          required: ['command']
        }
      }
    ]
  },

  // 大文本中嵌套工具调用
  large_text_tool: {
    name: '大文本中嵌套工具解析',
    messages: [
      {
        role: 'user',
        content: `I need you to analyze this large project structure and then create a summary file.

Here's the project structure:
${Array.from({length: 50}, (_, i) => 
  `src/module${i}/
├── index.js
├── components/
│   ├── Component${i}A.js
│   ├── Component${i}B.js
│   └── styles.css
├── utils/
│   ├── helper${i}.js
│   └── constants${i}.js
└── tests/
    ├── ${i}.test.js
    └── integration${i}.test.js`
).join('\n\n')}

After reviewing this structure, please use the Write tool to create a project summary file called 'project-analysis.md' with your analysis.`
      }
    ],
    tools: [
      {
        name: 'Write',
        description: 'Write content to a file',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to write file' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['file_path', 'content']
        }
      }
    ]
  },

  // 多轮工具调用序列
  multi_turn_tools: {
    name: '多轮工具调用序列',
    messages: [
      {
        role: 'user',
        content: 'First, check the current directory, then create a test file, then read it back.'
      }
    ],
    tools: [
      {
        name: 'bash',
        description: 'Execute bash command',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' }
          },
          required: ['command']
        }
      },
      {
        name: 'Write',
        description: 'Write content to a file',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to write file' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['file_path', 'content']
        }
      },
      {
        name: 'Read',
        description: 'Read content from a file',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to read file' }
          },
          required: ['file_path']
        }
      }
    ]
  }
};

// HTTP请求工具
async function makeRequest(endpoint, payload) {
  const url = `${endpoint}/v1/chat/completions`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      responseData = { raw_response: responseText, parse_error: parseError.message };
    }

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      raw: responseText
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
      data: null,
      raw: null
    };
  }
}

// 工具解析验证
function validateToolCalls(response) {
  const validation = {
    hasToolCalls: false,
    toolCallsCount: 0,
    validFormat: false,
    errors: [],
    toolCalls: []
  };

  try {
    if (response.data && response.data.choices && response.data.choices[0]) {
      const message = response.data.choices[0].message;
      
      if (message.tool_calls && Array.isArray(message.tool_calls)) {
        validation.hasToolCalls = true;
        validation.toolCallsCount = message.tool_calls.length;
        validation.toolCalls = message.tool_calls;
        
        // 验证每个工具调用的格式
        let allValid = true;
        message.tool_calls.forEach((tool, index) => {
          if (!tool.id || !tool.type || !tool.function) {
            validation.errors.push(`工具调用 ${index} 格式不完整`);
            allValid = false;
          } else if (!tool.function.name || !tool.function.arguments) {
            validation.errors.push(`工具调用 ${index} function格式不完整`);
            allValid = false;
          } else {
            try {
              JSON.parse(tool.function.arguments);
            } catch (e) {
              validation.errors.push(`工具调用 ${index} arguments不是有效JSON`);
              allValid = false;
            }
          }
        });
        
        validation.validFormat = allValid;
      }
    }
  } catch (error) {
    validation.errors.push(`解析错误: ${error.message}`);
  }

  return validation;
}

// 测试单个供应商
async function testProvider(port, providerInfo) {
  console.log(`\n🧪 测试 ${providerInfo.name} (端口${port})`);
  console.log(`   endpoint: ${providerInfo.endpoint}`);
  console.log(`   models: ${providerInfo.models.join(', ')}`);
  
  const results = {
    provider: providerInfo.name,
    port: port,
    endpoint: providerInfo.endpoint,
    models: providerInfo.models,
    timestamp: new Date().toISOString(),
    tests: {},
    summary: { total: 0, passed: 0, failed: 0 },
    issues: []
  };

  // 测试每个模型
  for (const model of providerInfo.models) {
    console.log(`\n   🔍 测试模型: ${model}`);
    results.tests[model] = {};

    // 测试每个测试用例
    for (const [testKey, testCase] of Object.entries(TEST_CASES)) {
      console.log(`     📝 ${testCase.name}`);
      
      const payload = {
        model: model,
        messages: testCase.messages,
        tools: testCase.tools,
        max_tokens: 2000,
        temperature: 0.1
      };

      const startTime = Date.now();
      const response = await makeRequest(providerInfo.endpoint, payload);
      const duration = Date.now() - startTime;

      // 验证工具解析
      const validation = validateToolCalls(response);
      
      const testResult = {
        status: response.status,
        duration: duration,
        validation: validation,
        hasError: response.status !== 200 || validation.errors.length > 0
      };

      results.tests[model][testKey] = testResult;
      results.summary.total++;

      if (testResult.hasError) {
        results.summary.failed++;
        results.issues.push({
          model: model,
          test: testCase.name,
          error: response.error || validation.errors.join('; '),
          status: response.status
        });
        
        // 保存有问题的原始数据
        if (response.data || response.raw) {
          const filename = `error-${port}-${model}-${testKey}-${Date.now()}.json`;
          await saveRawData(filename, {
            provider: providerInfo.name,
            model: model,
            test: testCase.name,
            request: payload,
            response: response,
            validation: validation,
            timestamp: new Date().toISOString()
          });
        }
        
        console.log(`       ❌ 失败 (${response.status}) - ${response.error || validation.errors.join('; ')}`);
      } else {
        results.summary.passed++;
        console.log(`       ✅ 成功 (${duration}ms) - ${validation.toolCallsCount}个工具调用`);
      }
    }
  }

  // 计算成功率
  results.summary.successRate = results.summary.total > 0 
    ? `${Math.round((results.summary.passed / results.summary.total) * 100)}%`
    : '0%';

  return results;
}

// 生成综合报告
function generateComprehensiveReport(allResults) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 CodeWhisperer 工具解析综合测试报告');
  console.log('='.repeat(80));

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  const providerStatus = {};

  allResults.forEach(result => {
    totalTests += result.summary.total;
    totalPassed += result.summary.passed;
    totalFailed += result.summary.failed;
    
    providerStatus[result.provider] = {
      port: result.port,
      successRate: result.summary.successRate,
      status: result.summary.passed > 0 ? (result.summary.failed === 0 ? 'PASS' : 'PARTIAL') : 'FAIL',
      issues: result.issues.length
    };
  });

  console.log('\n📈 总体统计:');
  console.log(`   总测试数: ${totalTests}`);
  console.log(`   通过测试: ${totalPassed}`);
  console.log(`   失败测试: ${totalFailed}`);
  console.log(`   总成功率: ${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%`);

  console.log('\n🏢 供应商状态:');
  Object.entries(providerStatus).forEach(([provider, status]) => {
    const statusIcon = status.status === 'PASS' ? '✅' : status.status === 'PARTIAL' ? '⚠️' : '❌';
    console.log(`   ${statusIcon} ${provider} (端口${status.port}): ${status.successRate} - ${status.issues}个问题`);
  });

  console.log('\n🔍 测试用例结果:');
  Object.keys(TEST_CASES).forEach(testKey => {
    const testResults = allResults.map(r => 
      Object.values(r.tests).map(modelTests => modelTests[testKey]?.hasError === false ? 1 : 0)
        .reduce((sum, val) => sum + val, 0)
    ).reduce((sum, val) => sum + val, 0);
    
    const totalModels = allResults.reduce((sum, r) => sum + Object.keys(r.tests).length, 0);
    const successRate = totalModels > 0 ? Math.round((testResults / totalModels) * 100) : 0;
    
    console.log(`   ${TEST_CASES[testKey].name}: ${successRate}% (${testResults}/${totalModels})`);
  });

  // 问题汇总
  const allIssues = allResults.flatMap(r => r.issues);
  if (allIssues.length > 0) {
    console.log('\n❌ 问题详情:');
    allIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue.model} - ${issue.test}:`);
      console.log(`      错误: ${issue.error}`);
      console.log(`      状态: ${issue.status}`);
    });

    console.log('\n💡 优化建议:');
    const errorTypes = {};
    allIssues.forEach(issue => {
      const errorType = issue.status === 0 ? '连接错误' : 
                       issue.status === 401 ? '认证错误' : 
                       issue.status === 500 ? '服务器错误' : '其他错误';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`   • ${type}: ${count}次 - 需要检查相关配置`);
    });
  }

  return {
    totalTests,
    totalPassed, 
    totalFailed,
    overallSuccessRate: totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0,
    providerStatus,
    issueCount: allIssues.length
  };
}

// 主测试函数
async function runComprehensiveTest() {
  console.log('🚀 开始CodeWhisperer全面工具解析测试');
  console.log('测试范围: 所有兼容供应商的工具调用和大文本解析能力');
  
  const allResults = [];
  
  // 检查哪些端口可用
  console.log('\n🔍 检查可用的CodeWhisperer服务...');
  const availablePorts = [];
  
  for (const [port, providerInfo] of Object.entries(CODEWHISPERER_PROVIDERS)) {
    try {
      const healthCheck = await fetch(`${providerInfo.endpoint}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      if (healthCheck.ok) {
        availablePorts.push(port);
        console.log(`   ✅ 端口${port} (${providerInfo.name}) 可用`);
      }
    } catch (error) {
      console.log(`   ❌ 端口${port} (${providerInfo.name}) 不可用: ${error.message}`);
    }
  }

  if (availablePorts.length === 0) {
    console.log('\n⚠️  没有发现可用的CodeWhisperer服务');
    console.log('请先启动至少一个CodeWhisperer服务:');
    Object.entries(CODEWHISPERER_PROVIDERS).forEach(([port, info]) => {
      console.log(`   rcc start ~/.route-claude-code/config/single-provider/config-codewhisperer-*-${port}.json --debug`);
    });
    return;
  }

  console.log(`\n📋 将测试 ${availablePorts.length} 个可用服务`);
  
  // 并行测试所有可用供应商 (根据用户要求，一个成功就够了)
  let hasSuccess = false;
  
  for (const port of availablePorts) {
    const providerInfo = CODEWHISPERER_PROVIDERS[port];
    
    try {
      const result = await testProvider(port, providerInfo);
      allResults.push(result);
      
      // 检查是否有成功的测试
      if (result.summary.passed > 0) {
        hasSuccess = true;
        console.log(`\n✅ ${providerInfo.name} 测试通过，继续测试其他供应商...`);
      }
      
    } catch (error) {
      console.error(`\n❌ ${providerInfo.name} 测试异常:`, error.message);
      allResults.push({
        provider: providerInfo.name,
        port: port,
        endpoint: providerInfo.endpoint,
        error: error.message,
        summary: { total: 0, passed: 0, failed: 1 },
        issues: [{ error: error.message }]
      });
    }
  }

  // 生成最终报告
  const finalReport = generateComprehensiveReport(allResults);
  
  // 保存完整测试结果
  const reportFilename = `codewhisperer-comprehensive-test-${Date.now()}.json`;
  await saveRawData(reportFilename, {
    testType: 'CodeWhisperer Comprehensive Tool Parsing Test',
    timestamp: new Date().toISOString(),
    summary: finalReport,
    detailResults: allResults,
    testCases: Object.keys(TEST_CASES),
    testedProviders: availablePorts.map(port => CODEWHISPERER_PROVIDERS[port].name)
  });

  console.log('\n' + '='.repeat(80));
  if (hasSuccess) {
    console.log('🎉 CodeWhisperer工具解析测试完成！至少一个供应商测试成功');
    console.log(`📊 总体成功率: ${finalReport.overallSuccessRate}%`);
  } else {
    console.log('⚠️  所有CodeWhisperer供应商都存在问题，需要进一步调试');
  }
  console.log(`📁 详细报告已保存到数据库目录`);
  console.log('='.repeat(80));

  return finalReport;
}

// 运行测试
if (require.main === module) {
  runComprehensiveTest().catch(error => {
    console.error('❌ 测试执行失败:', error);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  });
}

module.exports = { 
  runComprehensiveTest,
  TEST_CASES,
  CODEWHISPERER_PROVIDERS,
  validateToolCalls,
  saveRawData
};