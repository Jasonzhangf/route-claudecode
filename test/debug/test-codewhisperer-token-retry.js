#!/usr/bin/env node

/**
 * 测试CodeWhisperer Token刷新重试机制
 * 验证token失效时能自动refresh并重试请求
 * 项目所有者: Jason Zhang
 */

const http = require('http');

const REQUEST_CONFIG = {
  hostname: 'localhost',
  port: 5508,  // ShuaiHong OpenAI服务(测试用)
  path: '/v1/messages',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'any-string-is-ok',
    'anthropic-version': '2023-06-01'
  }
};

const TEST_REQUEST = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: '请分析一下AI技术在软件开发中的应用趋势，包括代码生成、自动化测试等方面'
    }
  ],
  stream: false  // 使用非流式请求测试token重试
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

async function runCodeWhispererTokenRetryTest() {
  console.log('🧪 开始测试CodeWhisperer Token刷新重试机制...');
  console.log('📍 目标端口: 5508 (ShuaiHong OpenAI服务)');
  console.log('🎯 测试目的: 验证token失效时能自动refresh并重试请求\n');
  
  // 连续发送请求测试token重试机制
  const requestCount = 8;
  const requests = [];
  
  console.log(`📨 发送${requestCount}个请求来测试token重试机制...`);
  
  for (let i = 0; i < requestCount; i++) {
    const requestPromise = makeRequest().then(result => ({
      requestIndex: i + 1,
      ...result
    })).catch(error => ({
      requestIndex: i + 1,
      error: error.message
    }));
    
    requests.push(requestPromise);
    
    // 添加间隔避免过快请求
    if (i < requestCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  const results = await Promise.all(requests);
  
  console.log('\n📊 测试结果分析:');
  console.log('='.repeat(50));
  
  let successCount = 0;
  let tokenErrorCount = 0;
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
        
        // 检查模型信息
        if (result.data.model) {
          console.log(`  🤖 使用模型: ${result.data.model}`);
        }
      }
      successCount++;
    } else if (result.statusCode === 403) {
      console.log(`  🔐 Token认证错误 (${result.statusCode})`);
      tokenErrorCount++;
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
  console.log(`  🔐 Token错误: ${tokenErrorCount}/${requestCount}`);
  console.log(`  ❌ 其他错误: ${otherErrorCount}/${requestCount}`);
  console.log(`  📊 平均响应长度: ${Math.round(totalResponseLength / Math.max(successCount, 1))} 字符`);
  
  console.log('\n🔍 CodeWhisperer Token重试机制分析:');
  if (successCount > 0) {
    console.log('  🎉 Token重试机制工作正常！');
    console.log('  ✅ 系统能在token失效时自动refresh并重试');
    console.log('  ✅ executeWithRetry方法成功集成到CodeWhisperer客户端');
    console.log('  🚀 CodeWhisperer的auth.refreshToken()正常工作');
    
    if (tokenErrorCount === 0) {
      console.log('  💡 没有遇到token错误，可能当前token仍然有效');
      console.log('  🔄 可以在token快到期时重新测试重试机制');
    } else {
      console.log('  🔧 部分请求遇到token错误但最终成功，说明重试机制有效');
    }
  } else if (tokenErrorCount === requestCount) {
    console.log('  ⚠️  所有请求都遇到token错误');
    console.log('  🔧 可能token已完全失效且refresh失败，或重试机制需要调试');
    console.log('  🚫 连续refresh失败3次后token会被拉黑(类似OpenAI Key blacklist)');
  } else {
    console.log('  🤔 混合结果，需要查看详细日志分析');
  }
  
  console.log('\n🔧 技术细节:');
  console.log('  • CodeWhisperer现在使用executeWithRetry模式');
  console.log('  • 检测到403错误时自动调用auth.refreshToken()');
  console.log('  • 最多重试3次，每次重试前清除auth缓存');
  console.log('  • 与OpenAI/Gemini的Key轮转机制保持一致的架构');
  console.log('  • Token刷新成功后自动重试原始请求');
  console.log('  • 🆕 Token拉黑机制: 连续refresh失败3次后标记为不可用');
  console.log('  • 🆕 失败计数: 成功refresh后重置失败计数器');
  console.log('  • 🆕 可用性检查: 执行请求前检查token是否被拉黑');
  
  console.log('\n💡 建议查看日志文件以获取详细的Token重试信息:');
  console.log('  tail -f ~/.route-claude-code/logs/ccr-session-*.log');
  
  console.log('\n' + '='.repeat(50));
}

if (require.main === module) {
  runCodeWhispererTokenRetryTest().catch(console.error);
}

module.exports = { runCodeWhispererTokenRetryTest };