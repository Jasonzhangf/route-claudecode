#!/usr/bin/env node

/**
 * 专门测试Token刷新功能
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function testTokenRefresh() {
  console.log('🔍 测试Token刷新功能');
  console.log('====================');
  
  const tokenPath = path.join(require('os').homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  
  if (!fs.existsSync(tokenPath)) {
    console.log('❌ Token文件不存在');
    return;
  }
  
  try {
    const content = fs.readFileSync(tokenPath, 'utf8');
    const tokenData = JSON.parse(content);
    
    console.log('📊 当前Token信息:');
    console.log('accessToken前缀:', tokenData.accessToken.substring(0, 20) + '...');
    console.log('refreshToken前缀:', tokenData.refreshToken.substring(0, 20) + '...');
    console.log('lastRefreshTime:', tokenData.lastRefreshTime);
    
    // 检查30分钟冷却期
    if (tokenData.lastRefreshTime) {
      const lastRefresh = new Date(tokenData.lastRefreshTime);
      const timeSinceRefresh = Date.now() - lastRefresh.getTime();
      const minutesSinceRefresh = Math.floor(timeSinceRefresh / (60 * 1000));
      
      console.log('距离上次刷新:', minutesSinceRefresh, '分钟');
      
      if (minutesSinceRefresh < 30) {
        console.log('⚠️  30分钟冷却期内，无法刷新');
        console.log('剩余冷却时间:', 30 - minutesSinceRefresh, '分钟');
        return;
      }
    }
    
    console.log('\n📤 尝试刷新Token...');
    
    const refreshRequest = {
      refreshToken: tokenData.refreshToken
    };
    
    const authEndpoint = 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken';
    console.log('刷新端点:', authEndpoint);
    
    const response = await axios.post(authEndpoint, refreshRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'route-claudecode/2.1.0'
      },
      timeout: 10000
    });
    
    console.log('✅ Token刷新成功！');
    console.log('新accessToken前缀:', response.data.accessToken.substring(0, 20) + '...');
    console.log('新refreshToken前缀:', response.data.refreshToken.substring(0, 20) + '...');
    console.log('profileArn:', response.data.profileArn);
    
    // 计算过期时间
    const expiresAt = new Date(Date.now() + (12 * 60 * 60 * 1000)); // 12小时后
    
    // 保存新token
    const newTokenData = {
      ...tokenData,
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      expiresAt: expiresAt.toISOString(),
      profileArn: response.data.profileArn || tokenData.profileArn,
      lastRefreshTime: new Date().toISOString(),
      lastRefreshedBy: 'manual-debug-refresh'
    };
    
    const backupPath = tokenPath + '.backup-' + Date.now();
    fs.copyFileSync(tokenPath, backupPath);
    console.log('🔒 创建备份:', backupPath);
    
    fs.writeFileSync(tokenPath, JSON.stringify(newTokenData, null, 2), { mode: 0o600 });
    console.log('💾 新Token已保存');
    
    return true;
    
  } catch (error) {
    console.error('❌ Token刷新失败:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误详情:', error.response.data);
      
      if (error.response.status === 400) {
        console.log('💡 可能原因：');
        console.log('   1. refreshToken已过期');
        console.log('   2. refreshToken格式错误');
        console.log('   3. 需要重新登录kiro');
      }
    }
    return false;
  }
}

async function main() {
  const success = await testTokenRefresh();
  
  console.log('\n📋 刷新测试结果:');
  console.log('=================');
  console.log('Token刷新:', success ? '✅ 成功' : '❌ 失败');
  
  if (success) {
    console.log('\n🎉 Token刷新成功！');
    console.log('✅ 新token已保存到文件');
    console.log('✅ 现在可以重新测试CodeWhisperer API');
    console.log('\n🔧 下一步：重启服务器并重新测试');
  } else {
    console.log('\n💡 建议操作：');
    console.log('1. 检查网络连接');
    console.log('2. 重新登录kiro获取新token');
    console.log('3. 确认refreshToken格式正确');
  }
}

if (require.main === module) {
  main().catch(console.error);
}