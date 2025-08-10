#!/usr/bin/env node
/**
 * 真实端到端测试 - 检查实际的provider错误
 * Project owner: Jason Zhang
 */

const axios = require('axios').default;

async function testRealEndToEnd() {
  console.log('🔍 真实端到端测试 - 检查provider错误\n');
  
  const baseURL = 'http://localhost:5502';
  
  // 检查服务状态
  try {
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ 服务器运行正常');
  } catch (error) {
    console.error('❌ 服务器连接失败:', error.message);
    return;
  }
  
  // 测试1: 最简单的请求 - 不使用工具
  console.log('📋 测试1: 简单文本请求（无工具）');
  console.log('-'.repeat(50));
  
  const simpleRequest = {
    model: 'gemini-2.5-flash-lite',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: 'Hello, what is 2+2?'
      }
    ]
  };
  
  try {
    console.log('🚀 发送简单请求...');
    const response = await axios.post(`${baseURL}/v1/messages`, simpleRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ 简单请求成功');
    console.log('- 响应长度:', response.data.content?.[0]?.text?.length);
    console.log('- 内容预览:', response.data.content?.[0]?.text?.substring(0, 100));
    
  } catch (error) {
    console.error('❌ 简单请求失败:');
    if (error.response?.data) {
      const errorData = error.response.data;
      console.log('- 错误类型:', errorData.type);
      console.log('- 错误消息:', errorData.message);
      console.log('- 错误阶段:', errorData.stage);
      console.log('- Provider:', errorData.provider);
      console.log('- RequestId:', errorData.requestId);
      console.log('- 完整错误:', JSON.stringify(errorData, null, 2));
    } else {
      console.log('- 网络错误:', error.message);
    }
  }
  
  // 测试2: 带工具的请求 - 触发我们修复的代码
  console.log('\n📋 测试2: 工具调用请求（触发修复代码）');
  console.log('-'.repeat(50));
  
  const toolRequest = {
    model: 'gemini-2.5-flash-lite',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: 'What time is it in UTC? Use the get_time function.'
      }
    ],
    tools: [
      {
        name: 'get_time',
        description: 'Get current time',
        input_schema: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              enum: ['UTC']
            }
          },
          required: ['timezone']
        }
      }
    ]
  };
  
  try {
    console.log('🚀 发送工具请求...');
    const response = await axios.post(`${baseURL}/v1/messages`, toolRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ 工具请求成功');
    console.log('- stop_reason:', response.data.stop_reason);
    console.log('- content blocks:', response.data.content?.length);
    
    let toolUsed = false;
    if (response.data.content) {
      response.data.content.forEach((block, i) => {
        if (block.type === 'tool_use') {
          toolUsed = true;
          console.log(`🎯 block[${i}]: 工具调用成功!`);
          console.log(`- 工具名: ${block.name}`);
          console.log(`- 参数:`, JSON.stringify(block.input, null, 2));
        } else if (block.type === 'text') {
          console.log(`📝 block[${i}]: 文本内容 (${block.text?.substring(0, 80)}...)`);
        }
      });
    }
    
    console.log(`🎯 工具调用结果: ${toolUsed ? '✅ 成功' : '📝 文本回复（AUTO模式行为）'}`);
    
  } catch (error) {
    console.error('❌ 工具请求失败:');
    if (error.response?.data) {
      const errorData = error.response.data;
      console.log('- 错误类型:', errorData.type);
      console.log('- 错误消息:', errorData.message);
      console.log('- 错误阶段:', errorData.stage);
      console.log('- Provider:', errorData.provider);
      console.log('- RequestId:', errorData.requestId);
      
      // 检查是否是我们需要修复的特定错误
      if (errorData.message && errorData.message.includes('candidate missing content')) {
        console.log('\n🎯 确认发现了需要修复的问题!');
        console.log('💡 这是transformer处理Gemini响应时的空content错误');
        console.log('📋 错误详情:');
        console.log(JSON.stringify(errorData, null, 2));
      }
    } else {
      console.log('- 网络错误:', error.message);
    }
  }
  
  // 测试3: 检查日志文件
  console.log('\n📋 测试3: 检查最新日志');
  console.log('-'.repeat(50));
  
  try {
    const { execSync } = require('child_process');
    const logPath = '~/.route-claude-code/logs/port-3456';
    
    console.log('🔍 查找最新日志文件...');
    const logFiles = execSync(`find ${logPath} -name "*.log" -type f | head -3`).toString().trim().split('\n');
    
    if (logFiles.length > 0 && logFiles[0]) {
      console.log('📄 最新日志文件:', logFiles[0]);
      console.log('📋 最后20行日志:');
      const logContent = execSync(`tail -20 "${logFiles[0]}"`).toString();
      console.log(logContent);
    } else {
      console.log('❓ 未找到日志文件');
    }
    
  } catch (error) {
    console.log('❓ 无法读取日志文件:', error.message);
  }
  
  console.log('\n🎯 真实测试总结:');
  console.log('🔍 需要重点关注:');
  console.log('   1. 具体的provider错误类型和阶段');
  console.log('   2. 是否确实是candidate missing content问题');
  console.log('   3. 我们的buildToolConfig修复是否真正生效');
  console.log('   4. 实际的Gemini API响应结构');
}

testRealEndToEnd().catch(console.error);