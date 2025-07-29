#!/usr/bin/env node

/**
 * 调试CodeWhisperer token问题
 * 检查token状态、刷新机制、硬编码路径
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

function checkTokenFile() {
  console.log('🔍 检查Token文件状态');
  console.log('===================');
  
  const tokenPath = path.join(require('os').homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  console.log('Token路径:', tokenPath);
  
  if (!fs.existsSync(tokenPath)) {
    console.log('❌ Token文件不存在');
    return null;
  }
  
  const stats = fs.statSync(tokenPath);
  console.log('文件修改时间:', stats.mtime.toISOString());
  console.log('文件大小:', stats.size, '字节');
  
  // 检查是否太旧
  const now = new Date();
  const fileAge = now.getTime() - stats.mtime.getTime();
  const ageHours = Math.floor(fileAge / (1000 * 60 * 60));
  const ageMinutes = Math.floor((fileAge % (1000 * 60 * 60)) / (1000 * 60));
  
  console.log('文件年龄:', `${ageHours}小时${ageMinutes}分钟`);
  
  if (ageHours > 24) {
    console.log('⚠️  Token文件超过24小时，可能已过期');
  }
  
  try {
    const content = fs.readFileSync(tokenPath, 'utf8');
    const tokenData = JSON.parse(content);
    
    console.log('\n📊 Token内容分析:');
    console.log('有accessToken:', !!tokenData.accessToken);
    console.log('有refreshToken:', !!tokenData.refreshToken);
    console.log('accessToken前缀:', tokenData.accessToken ? tokenData.accessToken.substring(0, 20) + '...' : 'N/A');
    console.log('refreshToken前缀:', tokenData.refreshToken ? tokenData.refreshToken.substring(0, 20) + '...' : 'N/A');
    console.log('expiresAt:', tokenData.expiresAt || '未设置');
    console.log('profileArn:', tokenData.profileArn || '未设置');
    console.log('lastRefreshTime:', tokenData.lastRefreshTime || '从未刷新');
    console.log('lastRefreshedBy:', tokenData.lastRefreshedBy || '未知');
    
    // 检查过期时间
    if (tokenData.expiresAt) {
      const expiresAt = new Date(tokenData.expiresAt);
      const timeToExpiry = expiresAt.getTime() - now.getTime();
      
      if (timeToExpiry > 0) {
        const hoursToExpiry = Math.floor(timeToExpiry / (1000 * 60 * 60));
        console.log('⏳ Token过期时间:', `${hoursToExpiry}小时后`);
      } else {
        console.log('❌ Token已过期');
      }
    }
    
    return tokenData;
  } catch (error) {
    console.error('❌ 解析Token文件失败:', error.message);
    return null;
  }
}

function checkConfiguredTokenPath() {
  console.log('\n🔍 检查配置文件中的Token路径');
  console.log('===============================');
  
  const configPath = path.join(require('os').homedir(), '.route-claude-code', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    console.log('❌ 配置文件不存在:', configPath);
    return;
  }
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    const codewhispererProvider = config.providers['codewhisperer-primary'];
    if (codewhispererProvider) {
      const tokenPath = codewhispererProvider.authentication?.credentials?.tokenPath;
      console.log('配置的tokenPath:', tokenPath);
      
      // 展开路径
      const expandedPath = tokenPath?.startsWith('~') 
        ? path.join(require('os').homedir(), tokenPath.slice(2))
        : tokenPath;
      
      console.log('展开后的完整路径:', expandedPath);
      
      // 检查是否与默认路径匹配
      const defaultPath = path.join(require('os').homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
      const pathsMatch = expandedPath === defaultPath;
      
      console.log('与默认路径匹配:', pathsMatch ? '✅' : '❌');
      
      if (!pathsMatch) {
        console.log('默认路径:', defaultPath);
        console.log('配置路径:', expandedPath);
      }
      
      // 检查配置的路径是否存在
      if (expandedPath && fs.existsSync(expandedPath)) {
        const stats = fs.statSync(expandedPath);
        console.log('配置路径文件存在: ✅');
        console.log('配置文件修改时间:', stats.mtime.toISOString());
      } else {
        console.log('配置路径文件存在: ❌');
      }
    } else {
      console.log('❌ 未找到codewhisperer-primary配置');
    }
  } catch (error) {
    console.error('❌ 解析配置文件失败:', error.message);
  }
}

function checkHardcodedPaths() {
  console.log('\n🔍 检查硬编码Token路径');
  console.log('=======================');
  
  // 检查构建后的代码中是否有硬编码路径
  const distAuthPath = path.join(__dirname, 'dist', 'providers', 'codewhisperer', 'auth.js');
  const distSafeManagerPath = path.join(__dirname, 'dist', 'providers', 'codewhisperer', 'safe-token-manager.js');
  
  const filesToCheck = [
    { name: 'auth.js', path: distAuthPath },
    { name: 'safe-token-manager.js', path: distSafeManagerPath }
  ];
  
  for (const file of filesToCheck) {
    console.log(`\n📄 检查 ${file.name}:`);
    
    if (!fs.existsSync(file.path)) {
      console.log('❌ 文件不存在:', file.path);
      continue;
    }
    
    try {
      const content = fs.readFileSync(file.path, 'utf8');
      
      // 查找硬编码的kiro-auth-token路径
      const hardcodedMatches = content.match(/kiro-auth-token\.json/g);
      if (hardcodedMatches) {
        console.log('❌ 发现硬编码路径:', hardcodedMatches.length, '处');
        
        // 找到具体位置
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('kiro-auth-token.json')) {
            console.log(`   第${index + 1}行: ${line.trim()}`);
          }
        });
      } else {
        console.log('✅ 未发现硬编码路径');
      }
    } catch (error) {
      console.error('❌ 读取文件失败:', error.message);
    }
  }
}

async function testTokenRefresh(tokenData) {
  console.log('\n🔍 测试Token刷新机制');
  console.log('=====================');
  
  if (!tokenData || !tokenData.refreshToken) {
    console.log('❌ 无法测试 - 缺少refreshToken');
    return;
  }
  
  try {
    console.log('📤 尝试刷新Token...');
    
    const refreshRequest = {
      refreshToken: tokenData.refreshToken
    };
    
    const authEndpoint = process.env.CODEWHISPERER_AUTH_ENDPOINT || 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken';
    console.log('刷新端点:', authEndpoint);
    
    const response = await axios.post(authEndpoint, refreshRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'route-claudecode/2.1.0'
      },
      timeout: 10000
    });
    
    console.log('✅ Token刷新成功');
    console.log('新accessToken前缀:', response.data.accessToken ? response.data.accessToken.substring(0, 20) + '...' : 'N/A');
    console.log('新refreshToken前缀:', response.data.refreshToken ? response.data.refreshToken.substring(0, 20) + '...' : 'N/A');
    console.log('新profileArn:', response.data.profileArn);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Token刷新失败:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误详情:', error.response.data);
    }
    return null;
  }
}

async function testCodeWhispererAPI(tokenData) {
  console.log('\n🔍 测试CodeWhisperer API');
  console.log('========================');
  
  if (!tokenData || !tokenData.accessToken) {
    console.log('❌ 无法测试 - 缺少accessToken');
    return;
  }
  
  try {
    console.log('📤 发送测试请求到CodeWhisperer...');
    
    const testRequest = {
      conversationId: 'test-' + Date.now(),
      message: {
        userInputMessage: {
          content: '写一个Python hello world',
          userInputMessageContext: {
            editorState: {
              document: { relativeFilePath: 'test.py' }
            }
          }
        }
      },
      workspaceState: {},
      includeCodewhispererSuggestion: true,
      maxConversationTurns: 1
    };
    
    const response = await axios.post(
      'https://codewhisperer.us-east-1.amazonaws.com/v1/conversations',
      testRequest,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'route-claudecode/2.1.0'
        },
        timeout: 15000
      }
    );
    
    console.log('✅ CodeWhisperer API调用成功');
    console.log('响应状态:', response.status);
    console.log('有conversationId:', !!response.data.conversationId);
    
    return true;
    
  } catch (error) {
    console.error('❌ CodeWhisperer API调用失败:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误详情:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('💡 认证失败 - Token可能已过期，需要刷新');
        return 'needs_refresh';
      }
    }
    return false;
  }
}

async function main() {
  console.log('🚀 CodeWhisperer Token 调试工具');
  console.log('=================================\n');
  
  // 1. 检查token文件
  const tokenData = checkTokenFile();
  
  // 2. 检查配置路径
  checkConfiguredTokenPath();
  
  // 3. 检查硬编码路径
  checkHardcodedPaths();
  
  if (tokenData) {
    // 4. 测试API调用
    const apiResult = await testCodeWhispererAPI(tokenData);
    
    // 5. 如果API失败且需要刷新，测试刷新
    if (apiResult === 'needs_refresh') {
      console.log('\n💡 Token需要刷新，尝试刷新...');
      const newTokenData = await testTokenRefresh(tokenData);
      
      if (newTokenData) {
        console.log('\n✅ Token刷新成功，重新测试API...');
        await testCodeWhispererAPI(newTokenData);
      }
    }
  }
  
  console.log('\n📋 调试总结');
  console.log('============');
  console.log('1. 检查Token文件是否存在且未过期');
  console.log('2. 确认配置文件中的tokenPath正确');
  console.log('3. 验证代码中没有硬编码路径');
  console.log('4. 测试Token是否能正常刷新');
  console.log('5. 验证CodeWhisperer API调用');
  console.log('\n如果发现问题，请检查相关配置和实现');
}

if (require.main === module) {
  main().catch(console.error);
}