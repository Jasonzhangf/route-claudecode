#!/usr/bin/env node

/**
 * CodeWhisperer 连接诊断工具
 * 直接测试 HTTPS 连接到 CodeWhisperer 端点
 */

const https = require('https');
const fs = require('fs');

console.log('🔍 CodeWhisperer 连接诊断开始...\n');

// 读取 token
const tokenPath = '/Users/fanzhang/.aws/sso/cache/kiro-auth-token_zcam.json';
let token = null;

try {
  const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  token = tokenData.accessToken;
  console.log('✅ Token 读取成功');
  console.log(`🔑 Token 长度: ${token.length}`);
  console.log(`⏰ 最后刷新: ${tokenData.lastRefreshTime}\n`);
} catch (error) {
  console.error('❌ Token 读取失败:', error.message);
  process.exit(1);
}

// 测试 HTTPS 连接
const options = {
  hostname: 'codewhisperer.us-east-1.amazonaws.com',
  port: 443,
  path: '/v1/conversation',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': '100'
  },
  timeout: 10000
};

console.log('🌐 开始 HTTPS 连接测试...');
console.log(`📡 端点: ${options.hostname}:${options.port}`);
console.log(`🛤️  路径: ${options.path}\n`);

const req = https.request(options, (res) => {
  console.log('✅ HTTPS 连接成功!');
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
    console.log(data);
    console.log('\n🎉 连接测试完成!');
  });
});

req.on('error', (error) => {
  console.error('\n❌ HTTPS 连接错误:');
  console.error(`   错误类型: ${error.code}`);
  console.error(`   错误消息: ${error.message}`);
  
  if (error.code === 'ECONNRESET') {
    console.error('   🔍 这通常表示连接被远程服务器重置');
  } else if (error.code === 'ENOTFOUND') {
    console.error('   🔍 DNS 解析失败');
  } else if (error.code === 'ECONNREFUSED') {
    console.error('   🔍 连接被拒绝');
  } else if (error.code === 'CERT_HAS_EXPIRED') {
    console.error('   🔍 SSL 证书过期');
  } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    console.error('   🔍 SSL 证书验证失败');
  }
  
  console.error('\n💡 建议检查:');
  console.error('   - 网络连接状态');
  console.error('   - 防火墙设置');
  console.error('   - SSL/TLS 配置');
  console.error('   - Token 有效性');
});

req.on('timeout', () => {
  console.error('\n⏰ 连接超时');
  req.destroy();
});

// 发送最小测试载荷
const testPayload = JSON.stringify({
  maxTokens: 100,
  stream: false
});

req.write(testPayload);
req.end();

console.log('⏳ 等待连接结果...');