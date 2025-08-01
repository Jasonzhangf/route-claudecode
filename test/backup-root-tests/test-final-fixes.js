#!/usr/bin/env node

/**
 * 测试所有修复后的实际效果
 * 项目所有者: Jason Zhang
 */

const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');

async function testAllFixes() {
  console.log('🔧 测试所有修复后的实际效果\n');
  console.log('📋 应用的修复:');
  console.log('1. ✅ 移除MODEL_MAP fallback机制');
  console.log('2. ✅ 修复userInputMessageContext omitempty行为');
  console.log('3. ✅ 完全对齐demo2的Go实现\n');

  // 启动服务器
  console.log('🚀 启动服务器...');
  const serverProcess = spawn('node', ['dist/cli.js', 'start', '--debug'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  let serverReady = false;
  
  // 等待服务器启动
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('⚠️  服务器启动超时，继续测试...');
      resolve();
    }, 10000);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Claude Code Router listening')) {
        serverReady = true;
        clearTimeout(timeout);
        setTimeout(resolve, 2000); // 额外等待
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('ERROR') || error.includes('address already in use')) {
        console.log('⚠️  服务器启动遇到问题，继续测试...');
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  if (!serverReady) {
    console.log('❌ 服务器未能正常启动，无法测试API调用');
    serverProcess.kill('SIGTERM');
    return;
  }

  try {
    // 测试简单请求
    console.log('📤 测试1: 简单文本请求（无工具）');
    const simpleRequest = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      messages: [{ role: "user", content: "Hello" }]
    };

    try {
      const simpleResponse = await axios.post(
        'http://127.0.0.1:3456/v1/messages',
        simpleRequest,
        {
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
          timeout: 15000
        }
      );
      console.log('✅ 简单请求成功');
      console.log(`   响应类型: ${simpleResponse.data.type}`);
      console.log(`   内容块数: ${simpleResponse.data.content?.length || 0}`);
    } catch (error) {
      console.log(`❌ 简单请求失败: ${error.message}`);
      if (error.response?.status) {
        console.log(`   状态码: ${error.response.status}`);
        console.log(`   错误详情: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }

    // 测试工具请求
    console.log('\n📤 测试2: 工具调用请求');
    const toolRequest = {
      model: "claude-sonnet-4-20250514", 
      max_tokens: 100,
      messages: [{ role: "user", content: "List TypeScript files" }],
      tools: [{
        name: "Glob",
        description: "File pattern matching",
        input_schema: {
          type: "object",
          properties: { pattern: { type: "string" } },
          required: ["pattern"]
        }
      }]
    };

    try {
      const toolResponse = await axios.post(
        'http://127.0.0.1:3456/v1/messages',
        toolRequest,
        {
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
          timeout: 20000
        }
      );
      console.log('✅ 工具请求成功');
      console.log(`   响应类型: ${toolResponse.data.type}`);
      console.log(`   内容块数: ${toolResponse.data.content?.length || 0}`);
      
      if (toolResponse.data.content) {
        toolResponse.data.content.forEach((block, i) => {
          if (block.type === 'tool_use') {
            console.log(`   工具调用[${i}]: ${block.name}(${Object.keys(block.input || {}).join(', ')})`);
          } else if (block.type === 'text') {
            const preview = block.text?.substring(0, 50) + '...';
            console.log(`   文本块[${i}]: "${preview}"`);
          }
        });
      }

      // 保存成功结果
      fs.writeFileSync('/tmp/final-fixes-success.json', JSON.stringify({
        timestamp: new Date().toISOString(),
        simpleRequest: simpleRequest,
        toolRequest: toolRequest,
        toolResponse: toolResponse.data,
        fixesApplied: [
          "Removed MODEL_MAP fallback mechanism",
          "Fixed userInputMessageContext omitempty behavior",
          "Aligned with demo2 Go implementation"
        ]
      }, null, 2));
      console.log(`📁 成功结果保存到: /tmp/final-fixes-success.json`);
      
    } catch (error) {
      console.log(`❌ 工具请求失败: ${error.message}`);
      if (error.response?.status) {
        console.log(`   状态码: ${error.response.status}`);
        console.log(`   错误详情: ${JSON.stringify(error.response.data, null, 2)}`);
        
        // 保存错误分析
        fs.writeFileSync('/tmp/final-fixes-error.json', JSON.stringify({
          timestamp: new Date().toISOString(),
          error: error.message,
          status: error.response.status,
          data: error.response.data,
          toolRequest: toolRequest,
          fixesApplied: [
            "Removed MODEL_MAP fallback mechanism", 
            "Fixed userInputMessageContext omitempty behavior",
            "Aligned with demo2 Go implementation"
          ]
        }, null, 2));
        console.log(`📁 错误分析保存到: /tmp/final-fixes-error.json`);
      }
    }

  } finally {
    // 停止服务器
    console.log('\n🛑 停止服务器...');
    serverProcess.kill('SIGTERM');
  }

  console.log('\n🔍 最终测试结论:');
  console.log('1. 如果两个测试都成功：我们的修复完全生效');
  console.log('2. 如果仍有400错误：需要进一步分析demo2差异');
  console.log('3. 对比demo2的实际请求格式找出剩余差异');
}

// 运行测试
testAllFixes().catch(console.error);