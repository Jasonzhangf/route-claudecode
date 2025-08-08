#!/usr/bin/env node

/**
 * 429错误Key分析脚本
 * 深度分析429错误是否来自同一个Key，验证Key轮换机制
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:5502';
const LOG_DIR = '~/.route-claude-code/logs/port-5502';

console.log('🔍 429错误Key分析 - 深度调试');
console.log('============================\n');

async function getLatestLogFiles() {
  console.log('📂 Step 1: 查找最新日志文件...');
  
  try {
    const { execSync } = require('child_process');
    const logPath = execSync('ls -la ~/.route-claude-code/logs/port-5502/ | tail -5', { encoding: 'utf-8' });
    console.log('最新日志目录:');
    console.log(logPath);
    
    // 获取最新的日志目录
    const latestDir = execSync('ls -t ~/.route-claude-code/logs/port-5502/ | head -1', { encoding: 'utf-8' }).trim();
    const fullLogPath = `~/.route-claude-code/logs/port-5502/${latestDir}`;
    
    console.log(`✅ 使用日志目录: ${fullLogPath}`);
    return fullLogPath;
    
  } catch (error) {
    console.error('❌ 获取日志路径失败:', error.message);
    return null;
  }
}

async function analyze429Errors(logPath) {
  console.log('\n🔍 Step 2: 分析429错误...');
  
  try {
    const { execSync } = require('child_process');
    
    // 搜索429相关错误
    console.log('搜索429错误...');
    const grep429 = execSync(`grep -i "429\\|rate.*limit\\|quota.*exhausted" ${logPath.replace('~', process.env.HOME)}/error.log | tail -20`, { encoding: 'utf-8' });
    
    console.log('📊 最近20条429相关错误:');
    console.log('================================');
    console.log(grep429);
    
    // 分析Key使用情况
    console.log('\n🔑 分析Key使用情况...');
    const keyAnalysis = execSync(`grep -o "google-gemini-key[1-3]" ${logPath.replace('~', process.env.HOME)}/error.log | sort | uniq -c`, { encoding: 'utf-8' });
    
    console.log('Key错误分布:');
    console.log(keyAnalysis);
    
    // 分析时间模式
    console.log('\n⏰ 分析时间模式...');
    const timePattern = execSync(`grep "429" ${logPath.replace('~', process.env.HOME)}/error.log | grep -o "2025-08-08T[0-9:]*" | tail -10`, { encoding: 'utf-8' });
    
    console.log('最近10次429错误时间:');
    console.log(timePattern);
    
    return true;
    
  } catch (error) {
    console.error('❌ 日志分析失败:', error.message);
    return false;
  }
}

async function testKeyRotationDetails() {
  console.log('\n🔄 Step 3: 详细测试Key轮换机制...');
  
  const results = [];
  
  // 连续发送20个请求，记录详细信息
  for (let i = 0; i < 20; i++) {
    const startTime = Date.now();
    
    try {
      const response = await axios.post(`${BASE_URL}/v1/messages`, {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: `Quick test ${i + 1}` }],
        max_tokens: 10
      }, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      results.push({
        index: i + 1,
        success: true,
        status: response.status,
        responseTime: Date.now() - startTime,
        provider: response.headers['x-provider'] || 'unknown',
        keyUsed: response.headers['x-key-used'] || 'unknown'
      });
      
    } catch (error) {
      results.push({
        index: i + 1,
        success: false,
        status: error.response?.status || 'unknown',
        responseTime: Date.now() - startTime,
        error: error.response?.data?.error?.message || error.message,
        provider: error.response?.headers?.['x-provider'] || 'unknown'
      });
    }
    
    // 短暂延迟避免太快
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

async function analyzeResults(results) {
  console.log('\n📊 Step 4: 结果分析...');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const rateLimited = results.filter(r => r.status === 429);
  
  console.log('\n📈 基础统计:');
  console.log(`总请求数: ${results.length}`);
  console.log(`成功请求: ${successful.length}`);
  console.log(`失败请求: ${failed.length}`);
  console.log(`429错误: ${rateLimited.length}`);
  
  console.log('\n🔑 Key使用分析:');
  const keyUsage = {};
  results.forEach(r => {
    const key = r.provider || 'unknown';
    if (!keyUsage[key]) keyUsage[key] = { total: 0, success: 0, failed: 0 };
    keyUsage[key].total++;
    if (r.success) keyUsage[key].success++;
    else keyUsage[key].failed++;
  });
  
  console.log(JSON.stringify(keyUsage, null, 2));
  
  console.log('\n⏱️ 性能分析:');
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  console.log(`平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
  
  if (rateLimited.length > 0) {
    console.log('\n🚨 429错误详情:');
    rateLimited.forEach(r => {
      console.log(`请求${r.index}: ${r.error} (Provider: ${r.provider})`);
    });
  }
  
  // 判断Key轮换是否正常工作
  const uniqueProviders = new Set(results.map(r => r.provider)).size;
  console.log(`\n🎯 Key轮换分析:`);
  console.log(`使用的不同Provider数: ${uniqueProviders}`);
  
  if (uniqueProviders > 1) {
    console.log('✅ Key轮换机制正在工作');
  } else if (uniqueProviders === 1 && results[0].provider !== 'unknown') {
    console.log('⚠️  所有请求使用同一个Provider - 可能轮换未生效');
  } else {
    console.log('❌ 无法确定Provider信息 - 需要检查响应头设置');
  }
  
  return {
    successRate: (successful.length / results.length) * 100,
    rateLimitRate: (rateLimited.length / results.length) * 100,
    uniqueProviders,
    keyDistribution: keyUsage
  };
}

async function checkGeminiConfig() {
  console.log('\n⚙️ Step 5: 检查Gemini配置...');
  
  try {
    const configPath = '~/.route-claude-code/config/single-provider/config-google-gemini-5502.json';
    const { execSync } = require('child_process');
    const config = execSync(`cat ${configPath.replace('~', process.env.HOME)}`, { encoding: 'utf-8' });
    
    console.log('Gemini配置信息:');
    const configObj = JSON.parse(config);
    
    console.log(`Provider ID: ${configObj.providers?.[0]?.id || 'unknown'}`);
    console.log(`API Keys数量: ${configObj.providers?.[0]?.authentication?.credentials?.apiKey?.length || 0}`);
    console.log(`配置类型: ${configObj.providers?.[0]?.type || 'unknown'}`);
    
    return configObj;
    
  } catch (error) {
    console.error('❌ 配置检查失败:', error.message);
    return null;
  }
}

async function main() {
  try {
    console.log('开始429错误深度分析...\n');
    
    // 1. 获取日志文件
    const logPath = await getLatestLogFiles();
    
    // 2. 分析历史429错误
    if (logPath) {
      await analyze429Errors(logPath);
    }
    
    // 3. 检查配置
    const config = await checkGeminiConfig();
    
    // 4. 实时测试Key轮换
    console.log('\n🧪 开始实时Key轮换测试...');
    const results = await testKeyRotationDetails();
    
    // 5. 分析结果
    const analysis = await analyzeResults(results);
    
    // 6. 最终诊断
    console.log('\n🎯 最终诊断结论');
    console.log('================');
    
    if (analysis.rateLimitRate > 50 && analysis.uniqueProviders <= 1) {
      console.log('🚨 问题确认: Key轮换机制未正常工作');
      console.log('🔧 建议检查:');
      console.log('  1. 多Key配置是否正确');
      console.log('  2. Provider扩展逻辑是否正常');
      console.log('  3. Rate limit管理器是否正确轮换');
    } else if (analysis.successRate > 80) {
      console.log('✅ Key轮换机制工作正常');
      console.log(`📊 成功率: ${analysis.successRate.toFixed(1)}%`);
      console.log(`🔑 使用了 ${analysis.uniqueProviders} 个不同的Provider`);
    } else {
      console.log('⚠️  系统可能存在其他问题');
      console.log(`📊 成功率: ${analysis.successRate.toFixed(1)}%`);
      console.log(`🚨 Rate limit率: ${analysis.rateLimitRate.toFixed(1)}%`);
    }
    
  } catch (error) {
    console.error('💥 分析异常:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}