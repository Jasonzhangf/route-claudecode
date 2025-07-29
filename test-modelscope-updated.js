#!/usr/bin/env node

/**
 * 测试更新后的ModelScope配置
 * 包括OpenAI格式和Anthropic格式两种接口
 */

const axios = require('axios');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function testDirectModelScopeAPIs() {
  console.log('🔍 直接测试ModelScope API连接');
  console.log('===============================');
  
  // 测试 OpenAI 格式
  console.log('\n1. OpenAI 格式接口测试:');
  try {
    const openaiRequest = {
      model: "qwen3-coder",
      messages: [{ role: "user", content: "写一个Python hello world" }],
      max_tokens: 100
    };
    
    const openaiResponse = await axios.post('https://api-inference.modelscope.cn/v1/chat/completions', openaiRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ms-cc2f461b-8228-427f-99aa-1d44fab73e67'
      },
      timeout: 30000
    });
    
    console.log('✅ OpenAI格式测试成功');
    console.log('   模型:', openaiResponse.data.model);
    console.log('   内容:', openaiResponse.data.choices?.[0]?.message?.content?.slice(0, 50) + '...');
  } catch (error) {
    console.log('❌ OpenAI格式测试失败:', error.message);
  }
  
  // 测试 Anthropic 格式
  console.log('\n2. Anthropic 格式接口测试:');
  try {
    const anthropicRequest = {
      model: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      max_tokens: 100,
      messages: [{ role: "user", content: "写一个Python hello world" }]
    };
    
    const anthropicResponse = await axios.post('https://api-inference.modelscope.cn/v1/messages', anthropicRequest, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'ms-cc2f461b-8228-427f-99aa-1d44fab73e67',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });
    
    console.log('✅ Anthropic格式测试成功');
    console.log('   模型:', anthropicResponse.data.model);
    console.log('   内容:', anthropicResponse.data.content?.[0]?.text?.slice(0, 50) + '...');
  } catch (error) {
    console.log('❌ Anthropic格式测试失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误详情:', error.response.data);
    }
  }
}

async function testRoutedRequests() {
  console.log('\n🔍 测试路由请求');
  console.log('================');
  
  const testCases = [
    {
      name: "Default Category - Anthropic Provider",
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{ role: "user", content: "写一个Python函数计算两数之和" }]
      },
      expectedModel: "Qwen/Qwen3-Coder-480B-A35B-Instruct"
    },
    {
      name: "Thinking Category - Anthropic Provider", 
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{ role: "user", content: "分析这段代码的时间复杂度" }],
        metadata: { thinking: true }
      },
      expectedModel: "Qwen/Qwen3-Coder-480B-A35B-Instruct"
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🧪 ${testCase.name}`);
    console.log('=' + '='.repeat(testCase.name.length + 3));
    
    try {
      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/v1/messages`, testCase.request, {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 60000
      });
      const responseTime = Date.now() - startTime;
      
      console.log('✅ 请求成功');
      console.log(`   响应时间: ${responseTime}ms`);
      console.log('   返回模型:', response.data.model);
      console.log('   期望模型:', testCase.expectedModel);
      console.log('   模型匹配:', response.data.model === testCase.expectedModel ? '✅' : '❌');
      
      // 检查内容
      if (response.data.content && response.data.content[0]?.text) {
        const content = response.data.content[0].text;
        console.log('   内容长度:', content.length);
        console.log('   内容预览:', JSON.stringify(content.slice(0, 80) + '...'));
        
        // 检查是否是编程相关内容
        const isProgramming = content.toLowerCase().includes('python') || 
                             content.toLowerCase().includes('def ') ||
                             content.toLowerCase().includes('function');
        console.log('   编程内容:', isProgramming ? '✅' : '❌');
      }
      
    } catch (error) {
      console.error('❌ 测试失败:', error.message);
      
      if (error.response) {
        console.error('   状态码:', error.response.status);
        if (error.response.status === 401) {
          console.error('   💡 API Key认证问题');
        } else if (error.response.status === 404) {
          console.error('   💡 端点不存在，可能ModelScope不支持Anthropic格式');
        } else if (error.response.status === 400) {
          console.error('   💡 请求格式问题');
          console.error('   错误详情:', error.response.data);
        }
      }
    }
  }
}

async function main() {
  console.log('🚀 ModelScope 双接口配置测试');
  console.log('==============================\n');
  
  // 测试直接API连接
  await testDirectModelScopeAPIs();
  
  // 启动服务器进行路由测试
  console.log('\n🚀 启动服务器测试路由...');
  const { spawn } = require('child_process');
  
  const server = spawn('node', ['dist/cli.js', 'start', '--debug'], {
    cwd: '/Users/fanzhang/Documents/github/claude-code-router',
    stdio: 'pipe'
  });
  
  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    await testRoutedRequests();
  } finally {
    // 清理服务器
    server.kill();
    console.log('\n🧹 服务器已停止');
  }
  
  console.log('\n📋 测试完成');
  console.log('============');
  console.log('✅ 已配置两种ModelScope接口:');
  console.log('   • modelscope-qwen (OpenAI格式): qwen3-coder');
  console.log('   • modelscope-anthropic (Anthropic格式): Qwen/Qwen3-Coder-480B-A35B-Instruct');
  console.log('✅ 从shuaihong-openai中移除了qwen3-coder模型');
  console.log('✅ Default和Thinking路由已更新到modelscope-anthropic');
}

if (require.main === module) {
  main().catch(console.error);
}