#!/usr/bin/env node

/**
 * 负载均衡和429拉黑机制测试
 * 验证longcontext路由的Gemini多provider负载均衡和429错误处理
 * Owner: Jason Zhang
 */

const axios = require('axios');

const ROUTER_URL = 'http://0.0.0.0:3456';

// 触发longcontext路由的大内容请求
const LONGCONTEXT_REQUEST = {
  model: 'claude-sonnet-4-20250514',
  messages: [
    { 
      role: 'user', 
      content: `请详细分析以下长文本内容，这是一个非常详细的技术文档，需要深入理解和分析。
      
${Array(2000).fill('这是一个用于测试长上下文路由的详细技术文档。').join(' ')}

请提供详细的分析和总结。`
    }
  ],
  max_tokens: 2000
};

async function makeRequest(requestName, customRequest = null) {
  const request = customRequest || LONGCONTEXT_REQUEST;
  const startTime = Date.now();
  
  try {
    console.log(`📋 执行请求: ${requestName}`);
    
    const response = await axios.post(`${ROUTER_URL}/v1/messages`, request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 120000 // 2分钟超时
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${requestName} 成功`);
    console.log(`  ⏱️  耗时: ${duration}ms`);
    console.log(`  🔧 使用模型: ${response.data?.model}`);
    console.log(`  📊 响应大小: ${JSON.stringify(response.data).length} bytes`);
    console.log(`  🎯 内容块数: ${response.data?.content?.length || 0}`);
    
    return {
      success: true,
      duration,
      model: response.data?.model,
      provider: response.data?.metadata?.targetProvider,
      hasContent: response.data?.content && response.data.content.length > 0
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.log(`❌ ${requestName} 失败`);
    console.log(`  错误: ${error.message}`);
    console.log(`  耗时: ${duration}ms`);
    console.log(`  状态码: ${error.response?.status}`);
    
    return {
      success: false,
      duration,
      error: error.message,
      status: error.response?.status,
      is429: error.response?.status === 429
    };
  }
}

async function testLoadBalancing() {
  console.log('🚀 测试负载均衡和429拉黑机制');
  console.log('=' * 60);
  
  const results = [];
  const providerCounts = {};
  
  // 执行多个请求来测试负载均衡
  for (let i = 1; i <= 8; i++) {
    console.log(`\\n🔄 第${i}轮测试:`);
    
    const result = await makeRequest(`longcontext-test-${i}`);
    results.push(result);
    
    if (result.success && result.provider) {
      providerCounts[result.provider] = (providerCounts[result.provider] || 0) + 1;
    }
    
    // 间隔时间避免过快请求
    if (i < 8) {
      console.log(`  ⏳ 等待2秒后继续...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\\n' + '=' * 60);
  console.log('📊 负载均衡测试报告');
  console.log('=' * 60);
  
  const successfulRequests = results.filter(r => r.success);
  const failedRequests = results.filter(r => !r.success);
  const rateLimitedRequests = results.filter(r => r.is429);
  
  console.log(`\\n📈 请求统计:`);
  console.log(`  总请求数: ${results.length}`);
  console.log(`  成功请求: ${successfulRequests.length}`);
  console.log(`  失败请求: ${failedRequests.length}`);
  console.log(`  429错误: ${rateLimitedRequests.length}`);
  
  if (Object.keys(providerCounts).length > 0) {
    console.log(`\\n🎯 Provider分布:`);
    Object.entries(providerCounts).forEach(([provider, count]) => {
      const percentage = ((count / successfulRequests.length) * 100).toFixed(1);
      console.log(`  ${provider}: ${count}次 (${percentage}%)`);
    });
    
    console.log(`\\n📊 负载均衡效果:`);
    const uniqueProviders = Object.keys(providerCounts).length;
    if (uniqueProviders > 1) {
      console.log(`  ✅ 负载均衡正常工作，使用了${uniqueProviders}个不同的provider`);
    } else if (uniqueProviders === 1) {
      console.log(`  ⚠️  所有请求都使用了同一个provider，可能其他provider被拉黑`);
    } else {
      console.log(`  ❌ 无法检测到provider分布`);
    }
  }
  
  if (rateLimitedRequests.length > 0) {
    console.log(`\\n🚫 429错误分析:`);
    console.log(`  429错误数量: ${rateLimitedRequests.length}`);
    console.log(`  💡 这表明某些provider遇到了配额限制`);
    console.log(`  🔄 系统应该自动拉黑这些provider并使用其他provider`);
  }
  
  console.log(`\\n⏱️  性能数据:`);
  if (successfulRequests.length > 0) {
    const avgDuration = successfulRequests.reduce((sum, r) => sum + r.duration, 0) / successfulRequests.length;
    const minDuration = Math.min(...successfulRequests.map(r => r.duration));
    const maxDuration = Math.max(...successfulRequests.map(r => r.duration));
    
    console.log(`  平均响应时间: ${Math.round(avgDuration)}ms`);
    console.log(`  最快响应: ${minDuration}ms`);
    console.log(`  最慢响应: ${maxDuration}ms`);
  }
  
  console.log(`\\n💡 测试建议:`);
  if (rateLimitedRequests.length > 0) {
    console.log(`  - 429错误出现表明拉黑机制应该被触发`);
    console.log(`  - 检查日志确认provider是否被临时拉黑`);
    console.log(`  - 验证剩余provider是否正常承接请求`);
  }
  
  if (Object.keys(providerCounts).length > 1) {
    console.log(`  - 负载均衡工作正常，请求分散到多个provider`);
  }
  
  // 保存详细结果
  const fs = require('fs');
  const resultFile = `/tmp/load-balancing-test-${Date.now()}.json`;
  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    testType: 'load-balancing-blacklist',
    results,
    providerCounts,
    summary: {
      totalRequests: results.length,
      successful: successfulRequests.length,
      failed: failedRequests.length,
      rateLimited: rateLimitedRequests.length
    }
  }, null, 2));
  
  console.log(`\\n📁 详细结果已保存: ${resultFile}`);
  
  return results;
}

// 执行测试
if (require.main === module) {
  testLoadBalancing()
    .then(() => {
      console.log('\\n✅ 负载均衡测试完成，程序退出');
      process.exit(0);
    })
    .catch(error => {
      console.error('\\n❌ 测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testLoadBalancing };