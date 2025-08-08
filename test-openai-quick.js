#!/usr/bin/env node
/**
 * OpenAI Provider快速测试 - 测试可用服务的工具解析
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

// 配置数据库路径
const DATABASE_DIR = path.join(process.env.HOME, '.route-claude-code', 'config', 'database');
const TEST_DIR = path.join(DATABASE_DIR, 'quick-openai-test');

// 确保数据库目录存在
function ensureDatabaseExists() {
  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
}

// 测试配置
const TEST_PROVIDERS = [
  {
    id: 'gemini-5502',
    name: 'Gemini (5502)', 
    port: 5502,
    endpoint: 'http://localhost:5502/v1/messages'
  },
  {
    id: 'shuaihong-5508',
    name: 'ShuaiHong (5508)',
    port: 5508, 
    endpoint: 'http://localhost:5508/v1/messages'
  }
];

// 简化的测试场景
const QUICK_TESTS = [
  {
    id: 'simple',
    name: '简单文本',
    request: {
      model: 'claude-3-sonnet-20240229',
      messages: [{ role: 'user', content: 'Hello! How are you today?' }],
      max_tokens: 100
    }
  },
  {
    id: 'tool-call',
    name: '工具调用',
    request: {
      model: 'claude-3-sonnet-20240229', 
      messages: [{ 
        role: 'user', 
        content: 'What is the weather like in Beijing? Use the weather tool.' 
      }],
      tools: [{
        name: 'get_weather',
        description: 'Get current weather',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' }
          },
          required: ['location']
        }
      }],
      max_tokens: 200
    }
  }
];

// 保存数据
function saveData(providerId, testId, type, data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${providerId}-${testId}-${type}-${timestamp}.json`;
  const filepath = path.join(TEST_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 保存: ${filename}`);
    return filepath;
  } catch (error) {
    console.error(`❌ 保存失败: ${error.message}`);
    return null;
  }
}

// HTTP请求
async function makeRequest(url, body) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      data,
      duration,
      error: response.ok ? null : data.error?.message || `HTTP ${response.status}`
    };
    
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

// 检查服务健康
async function checkHealth(provider) {
  try {
    const healthUrl = `http://localhost:${provider.port}/health`;
    const response = await fetch(healthUrl);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// 分析工具调用
function analyzeToolCall(response) {
  const analysis = {
    hasToolCall: false,
    toolCallCount: 0,
    toolDetails: [],
    issues: []
  };

  if (!response || !response.content) {
    analysis.issues.push('No content in response');
    return analysis;
  }

  // 检查Anthropic格式的工具调用
  if (Array.isArray(response.content)) {
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        analysis.hasToolCall = true;
        analysis.toolCallCount++;
        analysis.toolDetails.push({
          id: block.id,
          name: block.name,
          input: block.input
        });
      }
    }
  }

  return analysis;
}

// 执行单个测试
async function runTest(provider, test) {
  console.log(`\n🔧 测试 ${provider.name} - ${test.name}`);
  
  // 检查服务健康
  const isHealthy = await checkHealth(provider);
  if (!isHealthy) {
    console.log(`❌ 服务 ${provider.name} 不可用`);
    return null;
  }

  // 保存请求
  saveData(provider.id, test.id, 'request', test.request);

  // 发送请求
  const response = await makeRequest(provider.endpoint, test.request);
  
  // 保存响应
  saveData(provider.id, test.id, 'response', response);

  // 分析结果
  const analysis = analyzeToolCall(response.data);
  
  console.log(`   📊 状态: ${response.success ? '✅' : '❌'} (${response.status})`);
  console.log(`   ⏱️  耗时: ${response.duration}ms`);
  
  if (test.request.tools) {
    console.log(`   🔧 工具调用: ${analysis.hasToolCall ? `✅ ${analysis.toolCallCount}个` : '❌ 无'}`);
    if (analysis.toolDetails.length > 0) {
      for (const tool of analysis.toolDetails) {
        console.log(`      - ${tool.name}: ${JSON.stringify(tool.input)}`);
      }
    }
  }
  
  if (response.error) {
    console.log(`   ❌ 错误: ${response.error}`);
  }
  
  if (analysis.issues.length > 0) {
    console.log(`   ⚠️  问题: ${analysis.issues.join(', ')}`);
  }

  return {
    provider: provider.id,
    test: test.id,
    success: response.success,
    duration: response.duration,
    analysis,
    hasIssues: !response.success || analysis.issues.length > 0
  };
}

// 主测试函数
async function runQuickTest() {
  console.log('🚀 OpenAI Provider 快速测试');
  console.log(`📁 数据目录: ${TEST_DIR}`);
  
  ensureDatabaseExists();

  const results = [];
  
  for (const provider of TEST_PROVIDERS) {
    console.log(`\n🏢 测试 ${provider.name}`);
    
    for (const test of QUICK_TESTS) {
      const result = await runTest(provider, test);
      if (result) {
        results.push(result);
      }
      
      // 间隔1秒
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 生成报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 快速测试报告');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const withIssues = results.filter(r => r.hasIssues);

  console.log(`\n📈 统计:`);
  console.log(`   总测试: ${results.length}`);
  console.log(`   成功: ${successful.length}`);
  console.log(`   有问题: ${withIssues.length}`);

  if (withIssues.length > 0) {
    console.log(`\n⚠️  问题详情:`);
    for (const issue of withIssues) {
      console.log(`   ❌ ${issue.provider}/${issue.test}`);
    }
  }

  // 保存完整报告
  const reportData = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      successful: successful.length,
      withIssues: withIssues.length
    }
  };
  
  saveData('quick-test', 'summary', 'report', reportData);
  
  console.log(`\n✅ 测试完成！数据已保存到 ${TEST_DIR}`);
  
  return reportData;
}

// 启动其他服务
async function startService(configFile, port) {
  console.log(`🚀 启动服务: ${configFile} (端口 ${port})`);
  
  try {
    // 这里应该调用启动脚本或命令
    // 由于用户说要用 --config 接收配置，我们需要相应的启动命令
    console.log(`需要启动命令: rcc start --config ${configFile}`);
    return true;
  } catch (error) {
    console.log(`❌ 启动失败: ${error.message}`);
    return false;
  }
}

if (require.main === module) {
  runQuickTest().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
}

module.exports = { runQuickTest, startService };