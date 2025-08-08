#!/usr/bin/env node

/**
 * Gemini 429模型降级实现验证测试
 * 验证gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.0-flash-lite-001降级链实际运行
 * Project owner: Jason Zhang
 */

const axios = require('axios');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:5502';

console.log('🧪 Gemini 429模型降级实现验证测试');
console.log('======================================\n');

async function testHealthCheck() {
  console.log('📡 Step 1: 健康检查和配置验证...');
  
  try {
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ 健康检查通过:', healthResponse.data.status);
    
    // 验证配置加载
    const configCheck = await axios.post(`${BASE_URL}/v1/messages`, {
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 10
    });
    
    console.log('✅ 基础API连接正常');
    return true;
    
  } catch (error) {
    console.error('❌ 健康检查失败:', error.response?.data || error.message);
    return false;
  }
}

async function simulateRateLimitExhaustion() {
  console.log('\n🔥 Step 2: 模拟触发429错误...');
  
  const results = [];
  const targetModel = 'gemini-2.5-flash';
  
  console.log(`🎯 目标: 耗尽 ${targetModel} 的所有Key配额`);
  console.log('📊 快速发送连续请求以触发429...');
  
  for (let i = 0; i < 15; i++) {
    try {
      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/v1/messages`, {
        model: targetModel,
        messages: [{ role: "user", content: `Rate limit test ${i + 1}` }],
        max_tokens: 50
      }, {
        timeout: 10000
      });
      
      results.push({
        request: i + 1,
        success: true,
        model: response.data.model,
        responseTime: Date.now() - startTime,
        contentLength: response.data.content?.[0]?.text?.length || 0
      });
      
      console.log(`✅ 请求${i + 1}: 成功 (${response.data.model}, ${Date.now() - startTime}ms)`);
      
    } catch (error) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      
      const responseTime = Date.now() - startTime;
      results.push({
        request: i + 1,
        success: false,
        status,
        error: errorData?.error?.message || error.message,
        responseTime
      });
      
      if (status === 429) {
        console.log(`🚨 请求${i + 1}: 429 Rate Limit - ${errorData?.error?.message || 'Quota exhausted'}`);
      } else {
        console.log(`❌ 请求${i + 1}: ${status || 'Error'} - ${error.message}`);
      }
    }
    
    // 快速连续请求，增加429触发概率
    if (i < 14) await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

async function testModelFallbackTrigger() {
  console.log('\n🔄 Step 3: 测试模型降级触发...');
  
  const fallbackResults = [];
  
  // 连续请求相同模型，观察是否触发降级
  for (let i = 0; i < 8; i++) {
    try {
      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/v1/messages`, {
        model: 'gemini-2.5-flash', // 请求原始模型
        messages: [{ role: "user", content: `Fallback test ${i + 1}` }],
        max_tokens: 30
      }, {
        timeout: 8000
      });
      
      const actualModel = response.data.model;
      const fallbackDetected = actualModel !== 'gemini-2.5-flash';
      
      fallbackResults.push({
        request: i + 1,
        success: true,
        requestedModel: 'gemini-2.5-flash',
        actualModel,
        fallbackDetected,
        responseTime: Date.now() - startTime,
        content: response.data.content?.[0]?.text?.substring(0, 50) + '...'
      });
      
      if (fallbackDetected) {
        console.log(`🔄 请求${i + 1}: 降级触发! gemini-2.5-flash → ${actualModel} (${Date.now() - startTime}ms)`);
      } else {
        console.log(`✅ 请求${i + 1}: 原模型成功 (${Date.now() - startTime}ms)`);
      }
      
    } catch (error) {
      const status = error.response?.status;
      
      fallbackResults.push({
        request: i + 1,
        success: false,
        requestedModel: 'gemini-2.5-flash',
        status,
        error: error.response?.data?.error?.message || error.message
      });
      
      console.log(`❌ 请求${i + 1}: ${status || 'Error'} - ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return fallbackResults;
}

async function testSpecificFallbackModels() {
  console.log('\n🎯 Step 4: 直接测试降级模型...');
  
  const models = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite-001'
  ];
  
  const modelResults = {};
  
  for (const model of models) {
    console.log(`\n🧪 测试模型: ${model}`);
    
    try {
      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/v1/messages`, {
        model,
        messages: [{ role: "user", content: `Test ${model}` }],
        max_tokens: 20
      }, {
        timeout: 10000
      });
      
      modelResults[model] = {
        success: true,
        responseTime: Date.now() - startTime,
        actualModel: response.data.model,
        contentLength: response.data.content?.[0]?.text?.length || 0
      };
      
      console.log(`  ✅ 成功: ${response.data.model} (${Date.now() - startTime}ms)`);
      
    } catch (error) {
      modelResults[model] = {
        success: false,
        status: error.response?.status,
        error: error.response?.data?.error?.message || error.message
      };
      
      console.log(`  ❌ 失败: ${error.response?.status || 'Error'} - ${error.message}`);
    }
  }
  
  return modelResults;
}

function analyzeResults(rateLimitResults, fallbackResults, modelResults) {
  console.log('\n📊 Step 5: 结果分析...');
  
  // 分析429触发情况
  const rateLimited = rateLimitResults.filter(r => r.status === 429);
  const successful = rateLimitResults.filter(r => r.success);
  
  console.log('🚨 Rate Limit分析:');
  console.log(`   总请求: ${rateLimitResults.length}`);
  console.log(`   成功: ${successful.length}`);
  console.log(`   429错误: ${rateLimited.length}`);
  
  if (rateLimited.length > 0) {
    console.log('   ✅ 成功触发429错误，Key配额耗尽机制工作正常');
  } else {
    console.log('   ⚠️  未触发429错误，可能需要更多请求或Key配额未达到限制');
  }
  
  // 分析模型降级情况
  const fallbackTriggered = fallbackResults.filter(r => r.fallbackDetected);
  
  console.log('\n🔄 模型降级分析:');
  console.log(`   总请求: ${fallbackResults.length}`);
  console.log(`   降级触发: ${fallbackTriggered.length}`);
  console.log(`   降级成功率: ${((fallbackTriggered.length / fallbackResults.length) * 100).toFixed(1)}%`);
  
  if (fallbackTriggered.length > 0) {
    console.log('   ✅ 模型降级机制工作正常');
    fallbackTriggered.forEach(r => {
      console.log(`     ${r.requestedModel} → ${r.actualModel}`);
    });
  } else {
    console.log('   ⚠️  未检测到模型降级，可能需要更多429错误触发条件');
  }
  
  // 分析模型可用性
  console.log('\n🎯 模型可用性分析:');
  Object.entries(modelResults).forEach(([model, result]) => {
    if (result.success) {
      console.log(`   ✅ ${model}: 可用 (${result.responseTime}ms)`);
    } else {
      console.log(`   ❌ ${model}: ${result.status} - ${result.error}`);
    }
  });
}

function generateTestSummary(rateLimitResults, fallbackResults, modelResults) {
  console.log('\n🎯 测试总结');
  console.log('===========');
  
  const overall = {
    rateLimitWorking: rateLimitResults.some(r => r.status === 429),
    fallbackWorking: fallbackResults.some(r => r.fallbackDetected),
    modelsAccessible: Object.values(modelResults).filter(r => r.success).length
  };
  
  console.log('📋 功能验证状态:');
  console.log(`   🚨 429错误触发: ${overall.rateLimitWorking ? '✅ 工作正常' : '❌ 未触发'}`);
  console.log(`   🔄 模型降级机制: ${overall.fallbackWorking ? '✅ 工作正常' : '❌ 未检测到'}`);
  console.log(`   🎯 模型可访问性: ${overall.modelsAccessible}/3 模型可用`);
  
  if (overall.rateLimitWorking && overall.fallbackWorking && overall.modelsAccessible >= 2) {
    console.log('\n🎉 测试结果: 429模型降级功能基本工作正常!');
    console.log('✅ 系统能够在Rate Limit时自动降级到备用模型');
    console.log('✅ 降级链配置有效，多层模型备用机制运行良好');
    return true;
  } else {
    console.log('\n⚠️  测试结果: 部分功能需要进一步优化');
    console.log('📝 建议检查配置和实现细节');
    return false;
  }
}

async function checkServerLogs() {
  console.log('\n📋 Step 6: 检查服务器日志...');
  
  try {
    // 检查最新的错误日志
    const logPath = execSync('ls -t ~/.route-claude-code/logs/port-5502/ | head -1', { encoding: 'utf-8' }).trim();
    const fullLogPath = `~/.route-claude-code/logs/port-5502/${logPath}/error.log`;
    
    console.log(`📂 检查日志文件: ${fullLogPath}`);
    
    // 查看最近的模型降级日志
    try {
      const fallbackLogs = execSync(`grep -i "fallback" ${fullLogPath.replace('~', process.env.HOME)} | tail -10`, { encoding: 'utf-8' });
      if (fallbackLogs.trim()) {
        console.log('🔄 发现模型降级日志:');
        console.log(fallbackLogs);
      } else {
        console.log('ℹ️  未发现模型降级日志记录');
      }
    } catch (error) {
      console.log('ℹ️  日志中暂无降级记录');
    }
    
    // 查看最近的429错误
    try {
      const rateLimitLogs = execSync(`grep -i "429" ${fullLogPath.replace('~', process.env.HOME)} | tail -5`, { encoding: 'utf-8' });
      if (rateLimitLogs.trim()) {
        console.log('\n🚨 发现429错误日志:');
        console.log(rateLimitLogs);
      }
    } catch (error) {
      console.log('ℹ️  未发现429错误日志');
    }
    
  } catch (error) {
    console.log('⚠️  无法读取服务器日志:', error.message);
  }
}

async function main() {
  try {
    console.log('开始429模型降级实现验证测试...\n');
    
    // 1. 健康检查
    const healthOk = await testHealthCheck();
    if (!healthOk) {
      console.error('❌ 健康检查失败，终止测试');
      process.exit(1);
    }
    
    // 2. 模拟Rate Limit耗尽
    const rateLimitResults = await simulateRateLimitExhaustion();
    
    // 3. 测试模型降级
    const fallbackResults = await testModelFallbackTrigger();
    
    // 4. 测试各个降级模型
    const modelResults = await testSpecificFallbackModels();
    
    // 5. 分析结果
    analyzeResults(rateLimitResults, fallbackResults, modelResults);
    
    // 6. 检查服务器日志
    await checkServerLogs();
    
    // 7. 生成测试总结
    const testPassed = generateTestSummary(rateLimitResults, fallbackResults, modelResults);
    
    if (testPassed) {
      console.log('\n🚀 下一步: 可以提交GitHub和继续Gemini工具调用问题检查');
    } else {
      console.log('\n📝 下一步: 需要调试和完善降级机制实现');
    }
    
  } catch (error) {
    console.error('💥 测试异常:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}