#!/usr/bin/env node

/**
 * 模拟系统发送给LMStudio的确切请求格式
 * 目标：确定是请求格式问题还是响应处理问题
 */

const axios = require('axios');

async function testExactSystemRequestFormat() {
  console.log('🔍 模拟系统发送给LMStudio的确切请求格式...\n');
  
  // 基于日志分析，系统发送的请求格式应该是：
  const systemRequest = {
    model: 'gpt-oss-20b-mlx',  // 这是路由后的目标模型
    messages: [
      {
        role: 'user',
        content: 'Hello, create a test file'
      }
    ],
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
    max_tokens: 131072,  // OpenAI transformer默认值
    temperature: 0.7,    // 假设值
    stream: false        // forceNonStreaming设置为false
  };

  console.log('📤 发送模拟系统请求到LMStudio:');
  console.log(JSON.stringify(systemRequest, null, 2));
  console.log('');

  try {
    const response = await axios.post('http://localhost:1234/v1/chat/completions', systemRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio-local-key'
      },
      timeout: 30000
    });

    console.log('✅ LMStudio直接调用成功');
    console.log('📊 响应状态:', response.status);
    
    console.log('\n🔍 响应格式验证:');
    console.log('  - 有response对象:', !!response.data);
    console.log('  - 有choices字段:', !!response.data.choices);
    console.log('  - choices是数组:', Array.isArray(response.data.choices));
    console.log('  - choices长度:', response.data.choices?.length || 0);
    console.log('  - object字段:', response.data.object);
    console.log('  - id字段:', response.data.id);
    
    if (response.data.choices && response.data.choices[0]) {
      const choice = response.data.choices[0];
      console.log('  - choice.message存在:', !!choice.message);
      console.log('  - choice.message.role:', choice.message?.role);
      console.log('  - choice.message.content存在:', !!choice.message?.content);
      console.log('  - choice.finish_reason:', choice.finish_reason);
      console.log('  - choice.index:', choice.index);
    }
    
    console.log('\n📦 完整响应数据:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // 测试是否与标准OpenAI格式兼容
    const isOpenAICompatible = 
      response.data &&
      response.data.choices &&
      Array.isArray(response.data.choices) &&
      response.data.choices.length > 0 &&
      response.data.choices[0].message &&
      response.data.object === 'chat.completion';
      
    console.log('\n🎯 兼容性检查:');
    console.log('  - OpenAI格式兼容:', isOpenAICompatible ? '✅' : '❌');
    
    if (!isOpenAICompatible) {
      console.log('❌ LMStudio响应格式不兼容，需要预处理修复');
    } else {
      console.log('✅ LMStudio响应格式兼容，问题出现在系统处理中');
    }

  } catch (error) {
    console.log('❌ LMStudio直接调用失败:');
    console.log('  - 状态码:', error.response?.status || 'NETWORK_ERROR');
    console.log('  - 错误信息:', error.response?.data || error.message);
    
    if (error.response?.status) {
      console.log('🔍 响应头:');
      console.log(error.response.headers);
      
      console.log('📦 错误响应数据:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n=== 结论 ===');
  console.log('如果LMStudio直接调用成功但系统调用失败，说明问题在于:');
  console.log('1. OpenAI SDK的调用方式问题');  
  console.log('2. 请求参数转换问题');
  console.log('3. 响应处理管道中的数据丢失');
  console.log('4. 中间件或预处理器修改了响应');
}

// 运行测试
testExactSystemRequestFormat().then(() => {
  console.log('\n🏁 精确请求格式测试完成');
}).catch(console.error);