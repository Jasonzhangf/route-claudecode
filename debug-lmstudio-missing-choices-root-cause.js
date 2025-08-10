#!/usr/bin/env node

/**
 * 深入追踪LMStudio "missing choices"错误的根本原因
 * 目标：确定响应数据在哪个环节丢失了choices字段
 */

const axios = require('axios');

async function traceChoicesMissingError() {
  console.log('🔍 开始深度追踪missing choices错误根因...\n');
  
  // 第1步：直接测试LMStudio API
  console.log('=== STEP 1: 直接测试LMStudio API ===');
  try {
    const directResponse = await axios.post('http://localhost:1234/v1/chat/completions', {
      model: 'gpt-oss-20b-mlx',
      messages: [{ role: 'user', content: 'Hello, create a file test.txt' }],
      tools: [{
        type: 'function',
        function: {
          name: 'create_file',
          description: 'Create a file',
          parameters: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['filename', 'content']
          }
        }
      }],
      stream: false,
      max_tokens: 1000
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio-local-key'
      },
      timeout: 30000
    });
    
    console.log('✅ LMStudio直接API调用成功');
    console.log('📊 响应状态:', directResponse.status);
    console.log('📦 响应数据结构:');
    console.log('  - 有choices字段:', !!directResponse.data.choices);
    console.log('  - choices长度:', directResponse.data.choices?.length || 0);
    console.log('  - choices[0]结构:', !!directResponse.data.choices?.[0]);
    
    if (directResponse.data.choices?.[0]) {
      const choice = directResponse.data.choices[0];
      console.log('  - message存在:', !!choice.message);
      console.log('  - message.content存在:', !!choice.message?.content);
      console.log('  - finish_reason:', choice.finish_reason);
    }
    
    console.log('\n📝 原始响应数据:');
    console.log(JSON.stringify(directResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ LMStudio直接API调用失败:', error.message);
    return;
  }
  
  console.log('\n=== STEP 2: 通过我们的系统调用 ===');
  
  // 第2步：通过我们的系统调用并拦截响应
  try {
    const systemResponse = await axios.post('http://localhost:5506/v1/messages', {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: 'Hello, create a file test.txt'
      }],
      tools: [{
        type: 'function',
        function: {
          name: 'create_file',
          description: 'Create a file',
          parameters: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['filename', 'content']
          }
        }
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key'
      },
      timeout: 30000
    });
    
    console.log('✅ 系统调用成功');
    console.log('📊 响应状态:', systemResponse.status);
    console.log('📦 系统响应数据:');
    console.log(JSON.stringify(systemResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ 系统调用失败:', error.response?.status || 'NETWORK_ERROR');
    console.log('🚨 错误详情:', error.response?.data || error.message);
    
    // 如果是500错误，这说明missing choices确实发生了
    if (error.response?.status === 500) {
      console.log('\n🔍 分析error.response.data:');
      const errorData = error.response.data;
      if (errorData?.error?.message?.includes('missing choices')) {
        console.log('✅ 确认：错误确实是"missing choices"');
        console.log('📍 错误发生在我们的系统内部，不是LMStudio API');
        
        // 分析可能的原因
        console.log('\n🧩 可能原因分析:');
        console.log('1. OpenAI SDK Client处理问题');
        console.log('2. 响应转换过程中数据丢失');
        console.log('3. LMStudio Client的sendRequest方法问题');
        console.log('4. 流式/非流式转换过程中丢失');
      }
    }
  }
  
  console.log('\n=== STEP 3: 测试非流式强制设置 ===');
  
  // 第3步：验证forceNonStreaming是否生效
  try {
    const configResponse = await axios.get('http://localhost:5506/health');
    console.log('📊 服务状态:', configResponse.status);
    console.log('🔧 服务配置检查完成');
  } catch (error) {
    console.log('❌ 无法获取服务状态');
  }
  
  console.log('\n=== 总结 ===');
  console.log('🎯 下一步需要检查的关键点:');
  console.log('1. LMStudioClient.sendRequest方法的实际执行结果');
  console.log('2. OpenAI SDK调用和响应处理逻辑');
  console.log('3. 响应在transformer中的处理流程');
  console.log('4. 是否存在中间件修改了响应格式');
}

// 运行追踪
traceChoicesMissingError().then(() => {
  console.log('\n🏁 missing choices根因追踪完成');
}).catch(console.error);