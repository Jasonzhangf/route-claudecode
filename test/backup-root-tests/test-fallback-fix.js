#!/usr/bin/env node

/**
 * 测试修复fallback机制后的CodeWhisperer实现
 * 项目所有者: Jason Zhang
 */

const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');

async function testFallbackFix() {
  console.log('🔧 测试修复fallback机制后的CodeWhisperer实现\n');

  // 启动服务器
  console.log('🚀 启动服务器...');
  const serverProcess = spawn('node', ['dist/cli.js', 'start', '--debug'], {
    stdio: 'pipe',
    detached: false
  });

  // 等待服务器启动
  await new Promise((resolve) => {
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('服务器输出:', output.trim());
      if (output.includes('Claude Code Router listening')) {
        setTimeout(resolve, 2000); // 额外等待2秒确保完全启动
      }
    });
  });

  try {
    // 构建包含大量工具的请求
    const largeRequest = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: "List all TypeScript files"
        }
      ],
      tools: [
        {
          name: "Glob",
          description: "Fast file pattern matching tool",
          input_schema: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "The glob pattern to match files against" }
            },
            required: ["pattern"],
            additionalProperties: false,
            "$schema": "http://json-schema.org/draft-07/schema#"
          }
        }
      ]
    };

    console.log('📤 测试我们的router (修复后):');
    console.log(`📏 请求大小: ${JSON.stringify(largeRequest).length} 字符`);
    console.log(`🛠️  工具数量: ${largeRequest.tools.length}`);

    const startTime = Date.now();
    
    const response = await axios.post(
      'http://127.0.0.1:3456/v1/messages',
      largeRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      }
    );

    const duration = Date.now() - startTime;
    console.log(`✅ 修复后router成功 (${duration}ms)`);
    console.log(`   响应内容块: ${response.data.content.length}`);
    
    response.data.content.forEach((block, i) => {
      const preview = block.type === 'text' ? 
        `"${block.text?.substring(0, 50)}..."` :
        block.type === 'tool_use' ? 
        `${block.name}(${Object.keys(block.input).join(', ')})` : 
        'unknown';
      console.log(`   [${i}] ${block.type}: ${preview}`);
    });

    // 保存结果用于分析
    fs.writeFileSync('/tmp/fallback-fix-test-success.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      requestSize: JSON.stringify(largeRequest).length,
      toolCount: largeRequest.tools.length,
      response: response.data,
      duration: duration,
      fixApplied: "Removed MODEL_MAP fallback mechanism"
    }, null, 2));
    console.log(`📁 修复测试结果保存到: /tmp/fallback-fix-test-success.json`);
    
  } catch (error) {
    console.log(`❌ 修复后router失败: ${error.message}`);
    console.log(`   状态码: ${error.response?.status}`);
    if (error.response?.data) {
      console.log(`   错误信息: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    // 保存错误用于分析
    fs.writeFileSync('/tmp/fallback-fix-test-error.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
      fixApplied: "Removed MODEL_MAP fallback mechanism"
    }, null, 2));
    console.log(`📁 修复测试错误保存到: /tmp/fallback-fix-test-error.json`);
  }

  // 停止服务器
  console.log('\n🛑 停止服务器...');
  serverProcess.kill('SIGTERM');
  
  console.log('\n🔍 修复验证结论:');
  console.log('1. 如果成功：fallback机制确实是问题所在');
  console.log('2. 如果仍失败：需要继续查找其他差异');
  console.log('3. 对比demo2的Go实现查找更多差异点');
}

// 运行测试
testFallbackFix().catch(console.error);