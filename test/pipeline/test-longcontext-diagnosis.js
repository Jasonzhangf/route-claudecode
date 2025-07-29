#!/usr/bin/env node

/**
 * Longcontext诊断测试 - 专门诊断longcontext路由问题
 * 测试用例：验证longcontext请求是否能正确路由到shuaihong-openai provider
 * Author: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Longcontext诊断测试');
console.log('=========================\n');

// 加载release配置
const releaseConfigPath = path.join(process.env.HOME, '.claude-code-router', 'config.release.json');
const releaseConfig = JSON.parse(fs.readFileSync(releaseConfigPath, 'utf8'));

console.log('📋 Release配置中的longcontext路由:');
console.log('===================================');
console.log(`Provider: ${releaseConfig.routing.longcontext.provider}`);
console.log(`Model: ${releaseConfig.routing.longcontext.model}`);
console.log(`Port: ${releaseConfig.server.port}`);

// 验证shuaihong-openai provider配置
const shuaihongProvider = releaseConfig.providers['shuaihong-openai'];
console.log('\n📋 Shuaihong-OpenAI Provider配置:');
console.log('==================================');
console.log(`Type: ${shuaihongProvider.type}`);
console.log(`Endpoint: ${shuaihongProvider.endpoint}`);
console.log(`Models: ${shuaihongProvider.models.join(', ')}`);
console.log(`Default Model: ${shuaihongProvider.defaultModel}`);
console.log(`Gemini-2.5-pro Max Tokens: ${shuaihongProvider.maxTokens['gemini-2.5-pro']}`);

// 创建longcontext测试用例
const longContextTestCase = {
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    {
      role: 'user',
      content: 'A'.repeat(70000) + '\n\n请分析这个长文档的内容。' // 超过60K字符触发longcontext
    }
  ],
  max_tokens: 1000
};

console.log('\n🔍 Longcontext测试用例:');
console.log('========================');
console.log(`输入模型: ${longContextTestCase.model}`);
console.log(`内容长度: ${longContextTestCase.messages[0].content.length} 字符`);
console.log(`预期类别: longcontext`);
console.log(`预期Provider: ${releaseConfig.routing.longcontext.provider}`);
console.log(`预期目标模型: ${releaseConfig.routing.longcontext.model}`);

// 模拟路由决策
function determineCategory(request) {
  const content = request.messages[0].content;
  const contentLength = content.length;
  
  if (contentLength > 60000) {
    return 'longcontext';
  }
  
  return 'default';
}

const actualCategory = determineCategory(longContextTestCase);
const routingRule = releaseConfig.routing[actualCategory];

console.log('\n📊 路由决策结果:');
console.log('================');
console.log(`实际类别: ${actualCategory}`);
console.log(`路由到Provider: ${routingRule.provider}`);
console.log(`目标模型: ${routingRule.model}`);

// 验证结果
const isCorrectCategory = actualCategory === 'longcontext';
const isCorrectProvider = routingRule.provider === 'shuaihong-openai';
const isCorrectModel = routingRule.model === 'gemini-2.5-pro';

console.log(`\n✅ 类别判断正确: ${isCorrectCategory}`);
console.log(`✅ Provider选择正确: ${isCorrectProvider}`);
console.log(`✅ 模型映射正确: ${isCorrectModel}`);

const overallSuccess = isCorrectCategory && isCorrectProvider && isCorrectModel;
console.log(`\n🎯 整体测试结果: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);

// 检查provider端点可达性
console.log('\n🌐 Provider端点验证:');
console.log('=====================');

const https = require('https');
const url = require('url');

function testEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(endpoint);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path || '/',
      method: 'HEAD',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      resolve({
        status: res.statusCode,
        accessible: res.statusCode < 500
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 'ERROR',
        accessible: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'TIMEOUT',
        accessible: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

// 测试端点可达性
testEndpoint(shuaihongProvider.endpoint).then(result => {
  console.log(`端点: ${shuaihongProvider.endpoint}`);
  console.log(`状态: ${result.status}`);
  console.log(`可达性: ${result.accessible ? '✅ 可达' : '❌ 不可达'}`);
  if (result.error) {
    console.log(`错误: ${result.error}`);
  }

  // 保存诊断结果
  const diagnosticResult = {
    timestamp: new Date().toISOString(),
    test: 'longcontext-diagnosis',
    config: {
      configFile: 'config.release.json',
      port: releaseConfig.server.port,
      longcontextRouting: releaseConfig.routing.longcontext
    },
    testCase: {
      model: longContextTestCase.model,
      contentLength: longContextTestCase.messages[0].content.length,
      expectedCategory: 'longcontext',
      actualCategory: actualCategory
    },
    routing: {
      categoryCorrect: isCorrectCategory,
      providerCorrect: isCorrectProvider,
      modelCorrect: isCorrectModel,
      overallSuccess: overallSuccess
    },
    endpoint: {
      url: shuaihongProvider.endpoint,
      status: result.status,
      accessible: result.accessible,
      error: result.error || null
    }
  };

  fs.writeFileSync('longcontext-diagnosis.json', JSON.stringify(diagnosticResult, null, 2));
  console.log('\n💾 诊断结果已保存到: longcontext-diagnosis.json');

  // 综合结论
  console.log('\n🔍 诊断结论:');
  console.log('=============');
  
  if (!overallSuccess) {
    console.log('❌ 路由配置存在问题');
    if (!isCorrectCategory) console.log('  - 类别判断错误');
    if (!isCorrectProvider) console.log('  - Provider选择错误');
    if (!isCorrectModel) console.log('  - 模型映射错误');
  } else {
    console.log('✅ 路由配置正确');
  }

  if (!result.accessible) {
    console.log('❌ Provider端点不可达');
    console.log('  - 可能原因: 网络问题、服务器故障、认证问题');
  } else {
    console.log('✅ Provider端点可达');
  }

  // 下一步建议
  console.log('\n📋 建议下一步:');
  console.log('===============');
  if (overallSuccess && result.accessible) {
    console.log('1. 运行完整API测试验证longcontext处理能力');
    console.log('2. 测试实际的长文档处理性能');
  } else {
    if (!overallSuccess) {
      console.log('1. 修复路由配置问题');
    }
    if (!result.accessible) {
      console.log('2. 检查网络连接和Provider服务状态');
      console.log('3. 验证API密钥和认证配置');
    }
  }
});