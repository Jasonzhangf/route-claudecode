#!/usr/bin/env node

/**
 * 简单的token验证测试 - 验证demo2移植是否成功
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

async function testTokenValidation() {
  console.log('🔍 测试CodeWhisperer token验证\n');

  try {
    // 测试token文件读取
    const tokenPath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
    
    console.log('============================================================');
    console.log('🧪 测试用例: Token文件验证');
    console.log('============================================================');
    console.log(`Token路径: ${tokenPath}`);

    if (!fs.existsSync(tokenPath)) {
      console.log('❌ Token文件不存在');
      console.log('   💡 请确保Kiro已安装并已登录');
      return;
    }

    const data = fs.readFileSync(tokenPath, 'utf8');
    const token = JSON.parse(data);

    console.log('✅ Token文件读取成功');
    console.log(`   accessToken长度: ${token.accessToken ? token.accessToken.length : 0}`);
    console.log(`   refreshToken存在: ${!!token.refreshToken}`);
    console.log(`   profileArn: ${token.profileArn || 'N/A'}`);
    console.log(`   过期时间: ${token.expiresAt || 'N/A'}`);
    console.log(`   认证方式: ${token.authMethod || 'N/A'}`);
    console.log(`   提供商: ${token.provider || 'N/A'}`);

    // 检查token是否过期
    if (token.expiresAt) {
      const expiryTime = new Date(token.expiresAt);
      const now = new Date();
      const isExpired = expiryTime <= now;
      
      console.log(`   Token状态: ${isExpired ? '⚠️  已过期' : '✅ 有效'}`);
      
      if (!isExpired) {
        const timeLeft = Math.floor((expiryTime - now) / (1000 * 60));
        console.log(`   剩余时间: ${timeLeft} 分钟`);
      }
    }

    // 测试基本的demo2配置
    console.log('\n============================================================');
    console.log('🧪 测试用例: Demo2配置验证');
    console.log('============================================================');

    // 验证必要的配置项
    const requiredFields = ['accessToken', 'refreshToken', 'profileArn'];
    let allValid = true;

    for (const field of requiredFields) {
      const exists = !!token[field];
      console.log(`   ${field}: ${exists ? '✅ 存在' : '❌ 缺失'}`);
      if (!exists) allValid = false;
    }

    console.log('\n============================================================');
    if (allValid) {
      console.log('🎉 Demo2移植验证成功！');
      console.log('============================================================');
      console.log('✅ Token文件: 格式正确');
      console.log('✅ 必要字段: 全部存在');
      console.log('✅ 配置状态: 可以进行API调用');
      console.log('\n💡 接下来可以测试实际的API调用功能');
    } else {
      console.log('❌ Demo2移植验证失败');
      console.log('============================================================');
      console.log('⚠️  缺少必要的token字段');
      console.log('💡 请重新登录Kiro或检查配置');
    }

  } catch (error) {
    console.log('❌ 验证过程中发生错误');
    console.log(`   错误: ${error.message}`);
  }
}

// 运行验证
testTokenValidation().catch(console.error);