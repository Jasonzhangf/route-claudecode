#!/usr/bin/env node

/**
 * Claude Code Router - Route Failure Analysis Test
 * 
 * 测试用例: 分析Claude Code连接路由失败的具体原因
 * 目标: 通过流水线分析找出fetch failed的根本原因
 */

const http = require('http');
const https = require('https');

console.log('🧪 流水线调试测试：路由失败分析');
console.log('='.repeat(60));

const TEST_CONFIG = {
  routerHost: '127.0.0.1',
  routerPort: 6666,
  lmstudioHost: 'localhost', 
  lmstudioPort: 1234,
  testModel: 'claude-3-haiku-20240307',
  targetModel: 'qwen3-30b-a3b-instruct-2507-mlx'
};

// 测试请求模板
const TEST_REQUESTS = [
  {
    name: 'Claude Code风格请求',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-ant-api-test-key-1234567890abcdef',
      'User-Agent': 'Claude-Code/2.0',
      'Accept': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: {
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi from Claude Code' }]
    }
  },
  {
    name: 'cURL风格请求',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'test'
    },
    body: {
      model: 'claude-3-haiku-20240307', 
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi from cURL' }]
    }
  },
  {
    name: '标准Anthropic请求',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'sk-ant-test-key',
      'anthropic-version': '2023-06-01'
    },
    body: {
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi from Anthropic SDK' }]
    }
  }
];

// 流水线步骤
async function step1_testLMStudioDirect() {
  console.log('\n📋 Step 1: 直接测试LM Studio连接');
  console.log('-'.repeat(40));
  
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: TEST_CONFIG.targetModel,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Direct test' }]
    });

    const options = {
      hostname: TEST_CONFIG.lmstudioHost,
      port: TEST_CONFIG.lmstudioPort,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const success = res.statusCode >= 200 && res.statusCode < 300;
        console.log(`   结果: ${success ? '✅' : '❌'} Status: ${res.statusCode}`);
        if (success) {
          const response = JSON.parse(data);
          console.log(`   响应: ${response.choices?.[0]?.message?.content || '无内容'}`);
        } else {
          console.log(`   错误: ${data.substring(0, 100)}...`);
        }
        resolve({ success, statusCode: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.log(`   错误: ❌ ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.setTimeout(5000, () => {
      console.log('   错误: ❌ 超时');
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.write(postData);
    req.end();
  });
}

async function step2_testRouterStatus() {
  console.log('\n📋 Step 2: 测试路由器状态端点');
  console.log('-'.repeat(40));
  
  return new Promise((resolve) => {
    const options = {
      hostname: TEST_CONFIG.routerHost,
      port: TEST_CONFIG.routerPort,
      path: '/status',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const success = res.statusCode === 200;
        console.log(`   结果: ${success ? '✅' : '❌'} Status: ${res.statusCode}`);
        if (success) {
          const status = JSON.parse(data);
          console.log(`   版本: ${status.version}`);
          console.log(`   提供商: ${status.providers?.join(', ') || '无'}`);
          console.log(`   调试模式: ${status.debug ? '启用' : '禁用'}`);
        }
        resolve({ success, statusCode: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.log(`   错误: ❌ ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.setTimeout(5000, () => {
      console.log('   错误: ❌ 超时');
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.end();
  });
}

async function step3_testDifferentRequestFormats() {
  console.log('\n📋 Step 3: 测试不同请求格式');
  console.log('-'.repeat(40));
  
  const results = [];
  
  for (const testRequest of TEST_REQUESTS) {
    console.log(`\n   测试: ${testRequest.name}`);
    
    const result = await new Promise((resolve) => {
      const postData = JSON.stringify(testRequest.body);
      
      const options = {
        hostname: TEST_CONFIG.routerHost,
        port: TEST_CONFIG.routerPort,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          ...testRequest.headers,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const success = res.statusCode >= 200 && res.statusCode < 300;
          console.log(`   结果: ${success ? '✅' : '❌'} Status: ${res.statusCode}`);
          
          try {
            const response = JSON.parse(data);
            if (success) {
              console.log(`   响应内容: ${response.content?.[0]?.text || '无内容'}`);
              console.log(`   使用模型: ${response.model}`);
            } else {
              console.log(`   错误信息: ${response.error?.message || '未知错误'}`);
            }
          } catch (parseError) {
            console.log(`   响应解析失败: ${data.substring(0, 100)}...`);
          }
          
          resolve({ 
            name: testRequest.name, 
            success, 
            statusCode: res.statusCode, 
            data,
            headers: res.headers
          });
        });
      });

      req.on('error', (error) => {
        console.log(`   网络错误: ❌ ${error.message}`);
        resolve({ 
          name: testRequest.name, 
          success: false, 
          error: error.message 
        });
      });

      req.setTimeout(10000, () => {
        console.log('   超时错误: ❌ 请求超时');
        req.destroy();
        resolve({ 
          name: testRequest.name, 
          success: false, 
          error: 'timeout' 
        });
      });

      req.write(postData);
      req.end();
    });
    
    results.push(result);
  }
  
  return results;
}

async function step4_analyzeRoutingLogic() {
  console.log('\n📋 Step 4: 分析路由逻辑');
  console.log('-'.repeat(40));
  
  // 测试不同模型的路由分类
  const modelTests = [
    { model: 'claude-3-haiku-20240307', expectedCategory: 'background' },
    { model: 'claude-3-5-haiku-20241022', expectedCategory: 'background' },
    { model: 'claude-sonnet-4-20250514', expectedCategory: 'default' },
    { model: 'claude-3-5-sonnet-20241022', expectedCategory: 'default' },
    { model: 'gpt-4', expectedCategory: 'default' }
  ];
  
  console.log('   模型路由分析:');
  modelTests.forEach(test => {
    console.log(`   - ${test.model} → 预期类别: ${test.expectedCategory}`);
  });
  
  return modelTests;
}

async function step5_testCategoryFallback() {
  console.log('\n📋 Step 5: 测试类别fallback机制');
  console.log('-'.repeat(40));
  
  // 测试一个不存在的类别是否会fallback到default
  const testData = JSON.stringify({
    model: 'unknown-model-12345',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Test fallback' }]
  });
  
  return new Promise((resolve) => {
    const options = {
      hostname: TEST_CONFIG.routerHost,
      port: TEST_CONFIG.routerPort,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test',
        'Content-Length': Buffer.byteLength(testData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   结果: Status ${res.statusCode}`);
        try {
          const response = JSON.parse(data);
          if (response.error) {
            console.log(`   错误: ${response.error.message}`);
          } else {
            console.log(`   成功: 使用了模型 ${response.model}`);
          }
        } catch (e) {
          console.log(`   响应解析失败: ${data.substring(0, 100)}`);
        }
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.log(`   网络错误: ${error.message}`);
      resolve({ error: error.message });
    });

    req.write(testData);
    req.end();
  });
}

// 主测试函数
async function runPipelineAnalysis() {
  console.log(`开始时间: ${new Date().toISOString()}`);
  console.log(`测试配置: Router=${TEST_CONFIG.routerHost}:${TEST_CONFIG.routerPort}, LMStudio=${TEST_CONFIG.lmstudioHost}:${TEST_CONFIG.lmstudioPort}`);
  
  const results = {};
  
  try {
    // Step 1: 测试LM Studio直连
    results.lmstudio = await step1_testLMStudioDirect();
    
    // Step 2: 测试路由器状态
    results.routerStatus = await step2_testRouterStatus();
    
    // Step 3: 测试不同请求格式
    results.requestFormats = await step3_testDifferentRequestFormats();
    
    // Step 4: 分析路由逻辑
    results.routingLogic = await step4_analyzeRoutingLogic();
    
    // Step 5: 测试类别fallback
    results.categoryFallback = await step5_testCategoryFallback();
    
    // 总结分析
    console.log('\n📊 分析总结');
    console.log('='.repeat(60));
    
    console.log('\n🔍 关键发现:');
    console.log(`   LM Studio直连: ${results.lmstudio.success ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   路由器状态: ${results.routerStatus.success ? '✅ 正常' : '❌ 失败'}`);
    
    const successfulFormats = results.requestFormats.filter(r => r.success);
    const failedFormats = results.requestFormats.filter(r => !r.success);
    
    console.log(`   成功请求格式: ${successfulFormats.length}/${results.requestFormats.length}`);
    successfulFormats.forEach(r => console.log(`     ✅ ${r.name}`));
    
    if (failedFormats.length > 0) {
      console.log(`   失败请求格式: ${failedFormats.length}`);
      failedFormats.forEach(r => console.log(`     ❌ ${r.name}: ${r.error || '状态码 ' + r.statusCode}`));
    }
    
    // 保存详细结果到文件
    const fs = require('fs');
    const resultsFile = `/tmp/route-analysis-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 详细结果已保存: ${resultsFile}`);
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
  
  console.log(`\n完成时间: ${new Date().toISOString()}`);
}

// 运行测试
if (require.main === module) {
  runPipelineAnalysis().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
}

module.exports = { runPipelineAnalysis, TEST_CONFIG };