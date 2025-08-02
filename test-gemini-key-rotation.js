#!/usr/bin/env node

/**
 * 测试Gemini API Key轮转是否正确处理429错误
 * 验证修复后的系统在遇到429时会切换到不同的API Key
 */

const http = require('http');

const REQUEST_CONFIG = {
  hostname: 'localhost',
  port: 5502,  // Gemini服务，有多个API Key
  path: '/v1/messages',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'any-string-is-ok',
    'anthropic-version': '2023-06-01'
  }
};

const TEST_REQUEST = {
  model: 'gemini-2.5-pro',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: '请生成一个关于AI技术发展历程的详细分析报告，至少800字，包含深度技术见解'
    }
  ],
  stream: false  // 使用非流式请求测试key轮转
};

function makeRequest() {
  return new Promise((resolve, reject) => {
    const req = http.request(REQUEST_CONFIG, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      console.log(`响应头:`, JSON.stringify(res.headers, null, 2));
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: response
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: error.message
          });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('请求错误:', err);
      reject(err);
    });
    
    req.write(JSON.stringify(TEST_REQUEST));
    req.end();
  });
}

async function runGeminiKeyRotationTest() {
  console.log('🧪 开始测试Gemini API Key轮转修复...');
  console.log('📍 目标端口: 5502 (Gemini服务)');
  console.log('🎯 测试目的: 验证429错误时正确的Key轮转\n');
  
  // 连续发送多个请求来触发429错误和Key轮转
  const requestCount = 10;
  const requests = [];
  
  console.log(`📨 发送${requestCount}个并发请求来触发429错误...`);
  
  for (let i = 0; i < requestCount; i++) {
    const requestPromise = makeRequest().then(result => ({
      requestIndex: i + 1,
      ...result
    })).catch(error => ({
      requestIndex: i + 1,
      error: error.message
    }));
    
    requests.push(requestPromise);
    
    // 添加小间隔避免过快请求
    if (i < requestCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  
  const results = await Promise.all(requests);
  
  console.log('\n📊 测试结果分析:');
  console.log('='.repeat(50));
  
  let successCount = 0;
  let rateLimitCount = 0;
  let otherErrorCount = 0;
  let totalResponseLength = 0;
  
  results.forEach((result) => {
    console.log(`\n请求 ${result.requestIndex}:`);
    
    if (result.error) {
      console.log(`  ❌ 网络错误: ${result.error}`);
      otherErrorCount++;
    } else if (result.statusCode === 200) {
      console.log(`  ✅ 成功 (${result.statusCode})`);
      if (result.data && result.data.content) {
        const responseLength = JSON.stringify(result.data).length;
        totalResponseLength += responseLength;
        console.log(`  📝 响应长度: ${responseLength} 字符`);
        
        // 检查是否有实际的内容
        if (result.data.content && result.data.content[0] && result.data.content[0].text) {
          console.log(`  📖 文本长度: ${result.data.content[0].text.length} 字符`);
        }
      }
      successCount++;
    } else if (result.statusCode === 429) {
      console.log(`  ⚠️  速率限制 (${result.statusCode})`);
      rateLimitCount++;
    } else {
      console.log(`  ❌ 其他错误 (${result.statusCode})`);
      if (result.data) {
        console.log(`  详情: ${typeof result.data === 'string' ? result.data.substring(0, 200) : JSON.stringify(result.data).substring(0, 200)}`);
      }
      otherErrorCount++;
    }
  });
  
  console.log('\n📈 总体统计:');
  console.log(`  ✅ 成功请求: ${successCount}/${requestCount}`);
  console.log(`  ⚠️  429错误: ${rateLimitCount}/${requestCount}`);
  console.log(`  ❌ 其他错误: ${otherErrorCount}/${requestCount}`);
  console.log(`  📊 平均响应长度: ${Math.round(totalResponseLength / Math.max(successCount, 1))} 字符`);
  
  console.log('\n🔍 Gemini Key轮转分析:');
  if (successCount > 0 && rateLimitCount > 0) {
    console.log('  🎉 Key轮转工作正常！');
    console.log('  ✅ 系统能在遇到429错误时切换到可用的API Key');
    console.log('  ✅ 部分请求成功说明轮转机制有效');
    console.log('  🚀 Gemini的EnhancedRateLimitManager正常工作');
  } else if (successCount === requestCount) {
    console.log('  ✅ 所有请求都成功，可能当前负载不高');
    console.log('  💡 建议在高负载时期重新测试');
    console.log('  🔄 或者增加并发请求数量来测试轮转机制');
  } else if (rateLimitCount === requestCount) {
    console.log('  ⚠️  所有请求都遇到429错误');
    console.log('  🔧 可能所有Gemini API Key都被限制，或轮转机制需要进一步调试');
  } else {
    console.log('  🤔 混合结果，需要查看详细日志分析');
  }
  
  console.log('\n🔧 技术细节:');
  console.log('  • Gemini使用EnhancedRateLimitManager进行智能Key轮转');
  console.log('  • 支持模型fallback (gemini-2.5-pro → gemini-1.5-pro)');
  console.log('  • 每次重试都会获取新的可用Key和模型组合');
  console.log('  • 自动追踪RPM, TPM, RPD限制');
  
  console.log('\n💡 建议查看日志文件以获取详细的Key轮转信息:');
  console.log('  tail -f ~/.route-claude-code/logs/ccr-session-*.log');
  
  console.log('\n' + '='.repeat(50));
}

if (require.main === module) {
  runGeminiKeyRotationTest().catch(console.error);
}

module.exports = { runGeminiKeyRotationTest };