#!/usr/bin/env node

/**
 * 紧急大文本解析诊断脚本
 * 获取最新日志数据并测试修复
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚨 紧急大文本解析诊断开始...');

// 1. 获取最新的日志数据
function getLatestLogs() {
  console.log('📋 获取最新日志数据...');
  
  try {
    // 查找所有可能的日志文件
    const logSources = [
      // 进程日志
      'ps aux | grep "rcc start" | grep -v grep',
      // 系统日志
      'log show --predicate "process == \\"node\\"" --last 10m --style compact | grep -E "(3456|rcc|tool_call|finish_reason|length)" | tail -20',
      // 控制台输出
      'lsof -p $(pgrep -f "rcc start.*3456") 2>/dev/null | grep -E "(log|out|err)"'
    ];
    
    const logData = {};
    
    logSources.forEach((cmd, index) => {
      try {
        const output = execSync(cmd, { encoding: 'utf8', timeout: 5000 });
        logData[`source_${index}`] = output;
        console.log(`✅ 日志源 ${index}: ${output.split('\n').length} 行`);
      } catch (error) {
        console.log(`⚠️  日志源 ${index} 失败: ${error.message}`);
      }
    });
    
    return logData;
  } catch (error) {
    console.error('❌ 获取日志失败:', error.message);
    return {};
  }
}

// 2. 从控制台获取实时日志
function captureRealTimeLogs() {
  console.log('🔍 尝试捕获实时日志...');
  
  try {
    // 获取3456端口的进程PID
    const pidOutput = execSync('lsof -ti :3456', { encoding: 'utf8' }).trim();
    const pids = pidOutput.split('\n').filter(pid => pid);
    
    if (pids.length > 0) {
      console.log(`📍 找到进程PID: ${pids.join(', ')}`);
      
      // 尝试获取进程的标准输出
      pids.forEach(pid => {
        try {
          const fdInfo = execSync(`lsof -p ${pid} | grep -E "(1u|2u|log)"`, { encoding: 'utf8' });
          console.log(`📋 进程 ${pid} 文件描述符:`, fdInfo);
        } catch (e) {
          console.log(`⚠️  无法获取进程 ${pid} 的文件描述符`);
        }
      });
    }
  } catch (error) {
    console.log('⚠️  无法获取进程信息:', error.message);
  }
}

// 3. 创建测试用的大文本数据
function createLargeTextTestData() {
  console.log('📝 创建大文本测试数据...');
  
  // 模拟可能导致length finish_reason的大文本
  const largeText = `
这是一个非常长的文本，用于测试大文本解析功能。`.repeat(100) + `

现在我需要使用工具调用来处理这个大文本：

<function_calls>
<invoke name="listDirectory">
<parameter name="path">.