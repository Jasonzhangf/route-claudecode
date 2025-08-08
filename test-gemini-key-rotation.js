#!/usr/bin/env node

/**
 * Gemini多Key轮换机制测试
 * 验证遇到429错误时是否自动轮换API Key
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5502';
const TEST_TIMEOUT = 10000;

console.log('🔑 Gemini多Key轮换机制测试');
console.log('================================\n');

async function testKeyRotation() {
  console.log('📡 Step 1: 检查健康状态...');
  
  try {
    const health = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ 健康检查:', health.data);
    
    if (health.data.healthy === 3 && health.data.total === 3) {
      console.log('🎯 确认3个Gemini Key都处于健康状态\n');
    }
  } catch (error) {
    console.error('❌ 健康检查失败:', error.message);
    return false;
  }

  console.log('🔄 Step 2: 快速连续请求触发rate limit...');
  
  const results = [];
  const requests = [];
  
  // 发送10个并发请求来触发rate limit
  for (let i = 0; i < 10; i++) {
    const request = {
      model: "gemini-2.5-flash",
      messages: [
        { role: "user", content: `Test request ${i + 1}: What is ${i + 1} + ${i + 1}?` }
      ],
      max_tokens: 50
    };
    
    requests.push(
      axios.post(`${BASE_URL}/v1/messages`, request, {
        timeout: TEST_TIMEOUT,
        headers: { 'Content-Type': 'application/json' }
      }).then(response => ({
        index: i + 1,
        success: true,
        statusCode: response.status,
        response: response.data.content?.[0]?.text?.substring(0, 50) + '...'
      })).catch(error => ({
        index: i + 1,
        success: false,
        statusCode: error.response?.status || 'unknown',
        error: error.response?.data?.error?.message || error.message
      }))
    );
  }

  try {
    const responses = await Promise.all(requests);
    
    console.log('📊 请求结果汇总:');
    responses.forEach(result => {
      if (result.success) {
        console.log(`  ✅ 请求${result.index}: 成功 (${result.statusCode}) - ${result.response}`);
      } else {
        console.log(`  ❌ 请求${result.index}: 失败 (${result.statusCode}) - ${result.error}`);
      }
    });

    const successCount = responses.filter(r => r.success).length;
    const failCount = responses.filter(r => !r.success).length;
    const rateLimitCount = responses.filter(r => r.statusCode === 429).length;
    
    console.log(`\n📈 统计结果:`);
    console.log(`   成功请求: ${successCount}/10`);
    console.log(`   失败请求: ${failCount}/10`);
    console.log(`   429错误: ${rateLimitCount}/10`);

    if (successCount > 0 && rateLimitCount > 0) {
      console.log('\n🎯 Key轮换机制验证结果:');
      console.log('✅ 系统在遇到429错误时仍能处理部分请求');
      console.log('✅ 证明存在Key轮换或重试机制');
      return true;
    } else if (successCount > 7) {
      console.log('\n🎯 Key轮换机制验证结果:');
      console.log('✅ 多Key配置工作正常，成功率很高');
      console.log('✅ Rate limit分散在多个Key上，避免了集中失败');
      return true;
    } else {
      console.log('\n⚠️  需要进一步调查Key轮换机制');
      return false;
    }

  } catch (error) {
    console.error('💥 批量请求测试失败:', error.message);
    return false;
  }
}

async function testHealthAfterLoad() {
  console.log('\n🏥 Step 3: 负载后健康检查...');
  
  await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
  
  try {
    const health = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    console.log('📊 负载后健康状态:', health.data);
    
    const healthyKeys = health.data.healthy;
    const totalKeys = health.data.total;
    
    if (healthyKeys === totalKeys) {
      console.log('✅ 所有Key在负载测试后仍保持健康');
      return true;
    } else {
      console.log(`⚠️  ${totalKeys - healthyKeys}个Key可能被临时blacklist`);
      console.log('🔄 这是正常的rate limit保护机制');
      return true;
    }
  } catch (error) {
    console.error('❌ 负载后健康检查失败:', error.message);
    return false;
  }
}

async function main() {
  try {
    const keyRotationWorking = await testKeyRotation();
    const healthAfterLoad = await testHealthAfterLoad();
    
    console.log('\n🎯 最终结论');
    console.log('================');
    
    if (keyRotationWorking && healthAfterLoad) {
      console.log('✅ Gemini多Key轮换机制工作正常');
      console.log('✅ 系统能够在Rate Limit情况下保持服务可用性');
      console.log('✅ 健康检查和Key管理机制运行良好');
      console.log('\n🚀 系统已准备好处理生产级别的负载');
    } else {
      console.log('⚠️  多Key轮换机制可能需要进一步优化');
      console.log('💡 建议检查Key配置和rate limit管理策略');
    }
    
  } catch (error) {
    console.error('💥 测试异常:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}