#!/usr/bin/env node

/**
 * 检查LMStudio响应格式与标准OpenAI格式的对比
 * 目标：确定是否需要在预处理阶段修复格式问题
 */

const axios = require('axios');

// 标准OpenAI Chat Completion响应格式
const STANDARD_OPENAI_FORMAT = {
  id: 'chatcmpl-ABC123',
  object: 'chat.completion',
  created: 1699896916,
  model: 'gpt-3.5-turbo-0125',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello! How can I assist you today?'
      },
      logprobs: null,
      finish_reason: 'stop'
    }
  ],
  usage: {
    prompt_tokens: 9,
    completion_tokens: 12,
    total_tokens: 21
  }
};

async function checkLMStudioResponseFormat() {
  console.log('📋 标准OpenAI Chat Completion响应格式:');
  console.log(JSON.stringify(STANDARD_OPENAI_FORMAT, null, 2));
  
  console.log('\n🔍 测试LMStudio实际响应格式...\n');
  
  const testCases = [
    {
      name: '基础文本响应',
      request: {
        model: 'gpt-oss-20b-mlx',
        messages: [{ role: 'user', content: 'Hello, just say hi back' }],
        stream: false,
        max_tokens: 50
      }
    },
    {
      name: '带工具调用的响应',
      request: {
        model: 'gpt-oss-20b-mlx',
        messages: [{ role: 'user', content: 'Create a file named test.txt' }],
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
        max_tokens: 200
      }
    },
    {
      name: '流式响应第一块',
      request: {
        model: 'gpt-oss-20b-mlx',
        messages: [{ role: 'user', content: 'Say hello' }],
        stream: true,
        max_tokens: 50
      },
      streaming: true
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`=== ${testCase.name} ===`);
    
    try {
      if (testCase.streaming) {
        // 流式响应测试
        const response = await axios.post('http://localhost:1234/v1/chat/completions', testCase.request, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer lm-studio-local-key'
          },
          responseType: 'stream',
          timeout: 15000
        });
        
        console.log('📡 流式响应状态:', response.status);
        console.log('📦 流式响应头:', response.headers['content-type']);
        
        let firstChunk = null;
        response.data.on('data', (chunk) => {
          if (!firstChunk) {
            const chunkStr = chunk.toString();
            const lines = chunkStr.split('\n').filter(line => line.startsWith('data: '));
            if (lines.length > 0) {
              try {
                const data = lines[0].replace('data: ', '');
                if (data !== '[DONE]') {
                  firstChunk = JSON.parse(data);
                }
              } catch (e) {
                console.log('❌ 解析流式数据失败:', e.message);
              }
            }
          }
        });
        
        // 等待一段时间获取第一个chunk
        await new Promise(resolve => setTimeout(resolve, 2000));
        response.data.destroy();
        
        if (firstChunk) {
          console.log('📦 第一个流式chunk数据:');
          analyzeResponseFormat(firstChunk, STANDARD_OPENAI_FORMAT);
        } else {
          console.log('❌ 未能获取到流式chunk数据');
        }
        
      } else {
        // 非流式响应测试
        const response = await axios.post('http://localhost:1234/v1/chat/completions', testCase.request, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer lm-studio-local-key'
          },
          timeout: 15000
        });
        
        console.log('✅ 请求成功, 状态:', response.status);
        console.log('📦 LMStudio实际响应数据:');
        analyzeResponseFormat(response.data, STANDARD_OPENAI_FORMAT);
      }
      
    } catch (error) {
      console.log('❌ LMStudio请求失败:', error.message);
      if (error.response) {
        console.log('状态:', error.response.status);
        console.log('数据:', error.response.data);
      }
    }
    
    console.log(''); // 空行分隔
  }
}

function analyzeResponseFormat(lmstudioResponse, standardFormat) {
  console.log('🔍 格式对比分析:');
  
  // 检查必需字段
  const requiredFields = ['id', 'object', 'created', 'model', 'choices'];
  const missingFields = [];
  const extraFields = [];
  
  requiredFields.forEach(field => {
    if (!(field in lmstudioResponse)) {
      missingFields.push(field);
    }
  });
  
  Object.keys(lmstudioResponse).forEach(field => {
    if (!requiredFields.includes(field) && !['usage', 'system_fingerprint', 'stats'].includes(field)) {
      extraFields.push(field);
    }
  });
  
  console.log('📋 字段检查:');
  console.log('  ✅ 必需字段全部存在:', missingFields.length === 0);
  if (missingFields.length > 0) {
    console.log('  ❌ 缺失字段:', missingFields);
  }
  if (extraFields.length > 0) {
    console.log('  ⚠️  额外字段:', extraFields);
  }
  
  // 检查choices字段详细结构
  if (lmstudioResponse.choices) {
    console.log('📋 choices字段分析:');
    console.log('  - 类型:', typeof lmstudioResponse.choices);
    console.log('  - 是否数组:', Array.isArray(lmstudioResponse.choices));
    console.log('  - 长度:', lmstudioResponse.choices.length || 0);
    
    if (Array.isArray(lmstudioResponse.choices) && lmstudioResponse.choices.length > 0) {
      const firstChoice = lmstudioResponse.choices[0];
      console.log('  - 第一个choice结构:');
      console.log('    - index存在:', 'index' in firstChoice);
      console.log('    - message存在:', 'message' in firstChoice);
      console.log('    - finish_reason存在:', 'finish_reason' in firstChoice);
      
      if (firstChoice.message) {
        console.log('    - message.role:', firstChoice.message.role);
        console.log('    - message.content存在:', 'content' in firstChoice.message);
        console.log('    - message.tool_calls存在:', 'tool_calls' in firstChoice.message);
      }
    }
  } else {
    console.log('❌ choices字段不存在!');
  }
  
  // 检查object字段
  console.log('📋 object字段:', lmstudioResponse.object);
  if (lmstudioResponse.object !== 'chat.completion' && lmstudioResponse.object !== 'chat.completion.chunk') {
    console.log('⚠️  非标准object值, 标准值应为: chat.completion 或 chat.completion.chunk');
  }
  
  console.log('📄 完整响应数据:');
  console.log(JSON.stringify(lmstudioResponse, null, 2));
  
  // 格式兼容性结论
  const isCompatible = 
    lmstudioResponse.choices && 
    Array.isArray(lmstudioResponse.choices) && 
    lmstudioResponse.choices.length > 0 &&
    lmstudioResponse.choices[0].message;
    
  console.log('🎯 兼容性结论:', isCompatible ? '✅ 兼容' : '❌ 需要修复');
  
  if (!isCompatible) {
    console.log('🔧 建议的预处理修复:');
    if (!lmstudioResponse.choices) {
      console.log('  - 添加choices数组');
    }
    if (!Array.isArray(lmstudioResponse.choices)) {
      console.log('  - 将choices转换为数组');
    }
    if (lmstudioResponse.choices && lmstudioResponse.choices.length === 0) {
      console.log('  - 添加至少一个choice对象');
    }
  }
}

// 运行检查
checkLMStudioResponseFormat().then(() => {
  console.log('\n🏁 LMStudio响应格式检查完成');
}).catch(console.error);