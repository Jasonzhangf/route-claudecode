#!/usr/bin/env node

/**
 * 测试日志系统和Patch系统问题
 * 1. 验证日志记录是否正常工作
 * 2. 验证Patch系统是否生效
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

const LOGS_DIR = path.join(os.homedir(), '.route-claude-code', 'logs');

async function testLoggingSystem() {
  console.log('🧪 测试日志系统问题...\n');
  
  // 检查最新的日志目录
  const portDirs = fs.readdirSync(LOGS_DIR).filter(d => d.startsWith('port-'));
  
  for (const portDir of portDirs) {
    const portPath = path.join(LOGS_DIR, portDir);
    const timeDirs = fs.readdirSync(portPath)
      .filter(d => d.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/))
      .sort();
    
    if (timeDirs.length === 0) continue;
    
    const latestTimeDir = timeDirs[timeDirs.length - 1];
    const latestPath = path.join(portPath, latestTimeDir);
    const logFiles = fs.readdirSync(latestPath);
    
    console.log(`📁 ${portDir}/${latestTimeDir}:`);
    console.log(`   - 日志文件数量: ${logFiles.length}`);
    
    if (logFiles.length === 0) {
      console.log('   ❌ 空目录 - 日志写入可能有问题');
    } else {
      console.log(`   - 文件列表: ${logFiles.join(', ')}`);
      
      // 检查各类日志的大小
      for (const file of logFiles) {
        const filePath = path.join(latestPath, file);
        const stats = fs.statSync(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`     ${file}: ${sizeKB}KB`);
        
        if (sizeKB === 0) {
          console.log(`     ⚠️ ${file} 为空文件`);
        }
      }
    }
    console.log('');
  }
}

async function testPatchSystem() {
  console.log('🔧 测试Patch系统问题...\n');
  
  // 检查running服务
  const runningServices = [];
  try {
    const response = await axios.get('http://localhost:5508/health', { timeout: 3000 });
    runningServices.push({ port: 5508, status: 'running', data: response.data });
  } catch (error) {
    console.log('⚠️ 端口5508服务未运行或无法连接');
  }
  
  try {
    const response = await axios.get('http://localhost:5509/health', { timeout: 3000 });
    runningServices.push({ port: 5509, status: 'running', data: response.data });
  } catch (error) {
    console.log('⚠️ 端口5509服务未运行或无法连接');
  }
  
  if (runningServices.length === 0) {
    console.log('❌ 没有发现运行中的服务，无法测试Patch系统');
    return;
  }
  
  console.log(`✅ 发现 ${runningServices.length} 个运行中的服务`);
  
  // 发送简单的工具调用请求测试patch
  for (const service of runningServices) {
    console.log(`\n🧪 测试端口 ${service.port} 的Patch系统:`);
    
    const testRequest = {
      model: "gpt-4",
      messages: [
        {
          role: "user", 
          content: "请使用TodoWrite工具创建一个简单的任务列表"
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "TodoWrite",
            description: "Create todo list",
            parameters: {
              type: "object",
              properties: {
                todos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      content: { type: "string" },
                      status: { type: "string" },
                      priority: { type: "string" },
                      id: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      ],
      max_tokens: 100,
      temperature: 0
    };
    
    try {
      const response = await axios.post(`http://localhost:${service.port}/v1/chat/completions`, testRequest, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(`   ✅ 请求成功，状态码: ${response.status}`);
      
      if (response.data && response.data.choices && response.data.choices[0]) {
        const message = response.data.choices[0].message;
        if (message.tool_calls) {
          console.log(`   ✅ 检测到工具调用: ${message.tool_calls.length} 个`);
          console.log(`   🔧 工具名称: ${message.tool_calls.map(tc => tc.function.name).join(', ')}`);
        } else {
          console.log(`   ⚠️ 未检测到工具调用，可能是patch问题`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ 请求失败: ${error.message}`);
      if (error.response) {
        console.log(`   - 状态码: ${error.response.status}`);
        console.log(`   - 错误详情: ${error.response.data?.error?.message || '未知错误'}`);
      }
    }
  }
}

async function analyzePatchConfiguration() {
  console.log('🔍 分析Patch配置问题...\n');
  
  // 检查patch文件是否存在
  const patchFiles = [
    'src/patches/anthropic/tool-call-text-fix.ts',
    'src/patches/registry.ts',
    'src/patches/manager.ts'
  ];
  
  for (const file of patchFiles) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ ${file} 存在`);
    } else {
      console.log(`❌ ${file} 不存在`);
    }
  }
  
  // 检查是否有针对端口5508 (OpenAI-compatible) 的特殊patch
  console.log('\n🔍 检查OpenAI-compatible provider的patch支持:');
  console.log('   当前只有Anthropic patch注册');
  console.log('   ⚠️ 缺少OpenAI-compatible provider的特殊工具格式patch');
  console.log('   ⚠️ 这可能是端口5508工具调用问题的原因');
}

async function suggestFixes() {
  console.log('\n🔧 问题修复建议:\n');
  
  console.log('📝 日志系统修复:');
  console.log('   1. 检查UnifiedLogger的日志写入逻辑');
  console.log('   2. 验证各类日志方法是否被正确调用');
  console.log('   3. 检查日志级别配置是否正确');
  console.log('   4. 确认文件权限和目录访问权限');
  console.log('');
  
  console.log('🔧 Patch系统修复:');
  console.log('   1. 为OpenAI-compatible provider创建专门的patch');
  console.log('   2. 检查patch的条件匹配逻辑');
  console.log('   3. 验证patch的应用时机是否正确');
  console.log('   4. 添加patch应用的调试日志');
  console.log('');
  
  console.log('🎯 具体修复步骤:');
  console.log('   1. 创建OpenAI工具格式修复patch');
  console.log('   2. 在registry.ts中注册OpenAI patch'); 
  console.log('   3. 增强日志写入的错误处理');
  console.log('   4. 添加patch应用状态的监控');
}

async function main() {
  console.log('🧪 日志系统和Patch系统问题诊断工具\n');
  console.log('='.repeat(60));
  console.log('');
  
  await testLoggingSystem();
  await testPatchSystem();
  await analyzePatchConfiguration();
  await suggestFixes();
  
  console.log('✅ 诊断完成');
}

main().catch(console.error);