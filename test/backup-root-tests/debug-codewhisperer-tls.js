#!/usr/bin/env node

/**
 * CodeWhisperer TLS 配置诊断工具
 * 尝试不同的 TLS 配置来连接 CodeWhisperer
 */

const https = require('https');
const tls = require('tls');
const fs = require('fs');

console.log('🔍 CodeWhisperer TLS 诊断开始...\n');

// 读取 token
const tokenPath = '/Users/fanzhang/.aws/sso/cache/kiro-auth-token_zcam.json';
let token = null;

try {
  const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  token = tokenData.accessToken;
  console.log('✅ Token 读取成功\n');
} catch (error) {
  console.error('❌ Token 读取失败:', error.message);
  process.exit(1);
}

// 测试不同的 TLS 配置
const testConfigurations = [
  {
    name: '默认配置',
    options: {}
  },
  {
    name: '宽松 TLS 配置',
    options: {
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method'
    }
  },
  {
    name: '兼容性配置',
    options: {
      secureProtocol: 'TLS_method',
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384'
    }
  },
  {
    name: 'Keep-Alive 配置',
    options: {
      keepAlive: true,
      keepAliveMsecs: 1000,
      timeout: 15000
    }
  }
];

async function testConfiguration(config) {
  return new Promise((resolve, reject) => {
    console.log(`🧪 测试配置: ${config.name}`);
    
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
      timeout: 8000,
      ...config.options
    };

    const req = https.request(options, (res) => {
      console.log(`   ✅ 成功连接! 状态: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          success: true,
          statusCode: res.statusCode,
          data: data.substring(0, 200)
        });
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ 连接失败: ${error.code} - ${error.message}`);
      resolve({
        success: false,
        error: error.code,
        message: error.message
      });
    });

    req.on('timeout', () => {
      console.log(`   ⏰ 连接超时`);
      req.destroy();
      resolve({
        success: false,
        error: 'TIMEOUT',
        message: 'Connection timeout'
      });
    });

    const testPayload = JSON.stringify({
      maxTokens: 100,
      stream: false
    });

    req.write(testPayload);
    req.end();
  });
}

async function runAllTests() {
  const results = [];
  
  for (const config of testConfigurations) {
    const result = await testConfiguration(config);
    results.push({ config: config.name, ...result });
    
    // 等待一秒再进行下一个测试
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('');
  }
  
  console.log('📊 测试结果摘要:');
  console.log('================================');
  
  const successfulConfigs = results.filter(r => r.success);
  const failedConfigs = results.filter(r => !r.success);
  
  if (successfulConfigs.length > 0) {
    console.log('✅ 成功的配置:');
    successfulConfigs.forEach(r => {
      console.log(`   - ${r.config}: HTTP ${r.statusCode}`);
    });
  }
  
  if (failedConfigs.length > 0) {
    console.log('\n❌ 失败的配置:');
    failedConfigs.forEach(r => {
      console.log(`   - ${r.config}: ${r.error} (${r.message})`);
    });
  }
  
  console.log(`\n📈 成功率: ${successfulConfigs.length}/${results.length}`);
  
  if (successfulConfigs.length > 0) {
    console.log('\n💡 建议使用成功的配置更新 CodeWhisperer client');
  } else {
    console.log('\n🚨 所有配置都失败，可能是网络环境或认证问题');
    console.log('建议检查:');
    console.log('   - AWS SSO token 是否有效');
    console.log('   - 是否有网络代理或防火墙');
    console.log('   - 是否在支持的地理区域');
  }
}

runAllTests().catch(console.error);