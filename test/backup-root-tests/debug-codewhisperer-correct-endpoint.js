#!/usr/bin/env node

/**
 * CodeWhisperer 正确端点连接测试
 * 使用实际的 /generateAssistantResponse 端点
 */

const https = require('https');
const fs = require('fs');

console.log('🔍 CodeWhisperer 正确端点连接测试开始...\n');

// 读取 token
const tokenPath = '/Users/fanzhang/.aws/sso/cache/kiro-auth-token_zcam.json';
let token = null;
let profileArn = null;

try {
  const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  token = tokenData.accessToken;
  profileArn = tokenData.profileArn;
  console.log('✅ Token 读取成功');
  console.log(`🔑 Token 长度: ${token.length}`);
  console.log(`👤 Profile ARN: ${profileArn}`);
  console.log(`⏰ 最后刷新: ${tokenData.lastRefreshTime}\n`);
} catch (error) {
  console.error('❌ Token 读取失败:', error.message);
  process.exit(1);
}

// 使用正确的端点和请求格式
const testPayload = JSON.stringify({
  "maxTokens": 100,
  "profileArn": profileArn,
  "stream": false,
  "conversationState": {
    "conversationId": "test-connection-" + Date.now(),
    "history": []
  },
  "message": {
    "userInputMessage": {
      "content": "Hello, this is a connection test."
    }
  }
});

const options = {
  hostname: 'codewhisperer.us-east-1.amazonaws.com',
  port: 443,
  path: '/generateAssistantResponse',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(testPayload),
    'User-Agent': 'claude-code-router/2.0.0'
  },
  timeout: 15000
};

console.log('🌐 开始连接测试...');
console.log(`📡 端点: ${options.hostname}:${options.port}`);
console.log(`🛤️  路径: ${options.path}`);
console.log(`📦 载荷大小: ${Buffer.byteLength(testPayload)} bytes\n`);

const req = https.request(options, (res) => {
  console.log('✅ 连接成功!');
  console.log(`📊 状态码: ${res.statusCode}`);
  console.log(`📋 状态消息: ${res.statusMessage}`);
  console.log('📤 响应头:');
  Object.entries(res.headers).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📨 响应内容:');
    if (data.length > 500) {
      console.log(data.substring(0, 500) + '...(truncated)');
    } else {
      console.log(data);
    }
    
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('\n🎉 CodeWhisperer API 连接测试成功!');
    } else if (res.statusCode === 400) {
      console.log('\n⚠️  请求格式问题，但连接正常');
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      console.log('\n⚠️  认证问题，但连接正常');
    } else {
      console.log(`\n⚠️  服务器返回错误 ${res.statusCode}，但连接正常`);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ 连接错误:');
  console.error(`   错误类型: ${error.code}`);
  console.error(`   错误消息: ${error.message}`);
  
  if (error.code === 'ECONNRESET') {
    console.error('   🔍 连接被重置 - 可能是请求格式或认证问题');
  } else if (error.code === 'ENOTFOUND') {
    console.error('   🔍 DNS 解析失败');
  } else if (error.code === 'ECONNREFUSED') {
    console.error('   🔍 连接被拒绝');
  } else if (error.code === 'CERT_HAS_EXPIRED') {
    console.error('   🔍 SSL 证书过期');
  }
});

req.on('timeout', () => {
  console.error('\n⏰ 请求超时');
  req.destroy();
});

console.log('⏳ 发送请求...');
req.write(testPayload);
req.end();