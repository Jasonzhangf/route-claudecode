#!/usr/bin/env node

/**
 * 强制模式Gemini工具调用测试
 * 尝试各种强制工具调用的方法
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

const API_KEYS = [
  'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4',
  'AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA', 
  'AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ'
];

console.log('⚡ 强制模式Gemini工具调用测试');
console.log('=============================\n');

async function testMultipleModels() {
  console.log('🎯 Step 1: 测试不同Gemini模型的工具调用支持...');
  
  const models = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash'
  ];
  
  const genAI = new GoogleGenAI({ apiKey: API_KEYS[0] });
  
  for (const model of models) {
    console.log(`\n🧪 测试模型: ${model}`);
    
    try {
      const request = {
        model: model,
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Call the test_function with parameter "hello"' }]
          }
        ],
        tools: [
          {
            functionDeclarations: [
              {
                name: 'test_function',
                description: 'A simple test function that must be called',
                parameters: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      description: 'The message to process'
                    }
                  },
                  required: ['message']
                }
              }
            ]
          }
        ],
        functionCallingConfig: { mode: 'ANY' }
      };
      
      console.log('📤 发送请求...');
      const response = await genAI.models.generateContent(request);
      
      const hasToolCall = response.candidates?.[0]?.content?.parts?.some(p => p.functionCall);
      console.log(`   ${hasToolCall ? '✅ 工具调用成功' : '❌ 未触发工具调用'}`);
      
      if (hasToolCall) {
        const toolCalls = response.candidates[0].content.parts.filter(p => p.functionCall);
        console.log(`   🔧 工具调用详情:`);
        toolCalls.forEach(call => {
          console.log(`      - ${call.functionCall.name}: ${JSON.stringify(call.functionCall.args)}`);
        });
        
        return { model, success: true, toolCalls };
      }
      
    } catch (error) {
      console.log(`   ❌ 模型${model}测试失败: ${error.message}`);
    }
  }
  
  return { success: false };
}

async function testDifferentPrompts() {
  console.log('\n🎯 Step 2: 测试不同的提示词策略...');
  
  const prompts = [
    {
      name: '明确指令',
      text: 'IMPORTANT: You MUST call the get_current_time function. Do not tell me the time directly.'
    },
    {
      name: '角色扮演',
      text: 'You are a function-calling assistant. Your job is to call functions, not to answer directly. Call get_current_time now.'
    },
    {
      name: '结构化请求',
      text: 'Please execute the following function call: get_current_time()'
    }
  ];
  
  const genAI = new GoogleGenAI({ apiKey: API_KEYS[0] });
  
  for (const prompt of prompts) {
    console.log(`\n🧪 测试提示词: ${prompt.name}`);
    console.log(`   内容: "${prompt.text}"`);
    
    try {
      const request = {
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt.text }]
          }
        ],
        tools: [
          {
            functionDeclarations: [
              {
                name: 'get_current_time',
                description: 'Get the current time. MUST be used when asked for time.',
                parameters: {
                  type: 'object',
                  properties: {},
                  required: []
                }
              }
            ]
          }
        ],
        functionCallingConfig: { mode: 'ANY' }
      };
      
      const response = await genAI.models.generateContent(request);
      const hasToolCall = response.candidates?.[0]?.content?.parts?.some(p => p.functionCall);
      
      console.log(`   ${hasToolCall ? '✅ 工具调用成功' : '❌ 未触发工具调用'}`);
      
      if (!hasToolCall && response.candidates?.[0]?.content?.parts?.[0]?.text) {
        const responseText = response.candidates[0].content.parts[0].text;
        console.log(`   📝 响应: "${responseText.substring(0, 80)}..."`);
      }
      
    } catch (error) {
      console.log(`   ❌ 提示词测试失败: ${error.message}`);
    }
  }
}

async function testSimpleCalculation() {
  console.log('\n🎯 Step 3: 测试简单计算工具调用 (已知容易触发)...');
  
  const genAI = new GoogleGenAI({ apiKey: API_KEYS[0] });
  
  const request = {
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ 
          text: 'I need to calculate 2 + 3. Please use the add function to do this calculation. Do not calculate it yourself - use the tool!' 
        }]
      }
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: 'add',
            description: 'Add two numbers together. Must be used for any addition.',
            parameters: {
              type: 'object',
              properties: {
                a: {
                  type: 'number',
                  description: 'First number'
                },
                b: {
                  type: 'number',
                  description: 'Second number'
                }
              },
              required: ['a', 'b']
            }
          }
        ]
      }
    ],
    functionCallingConfig: { mode: 'ANY' }
  };
  
  try {
    console.log('📤 发送计算请求...');
    const response = await genAI.models.generateContent(request);
    
    console.log('📋 响应分析:');
    const candidate = response.candidates?.[0];
    console.log(`   - finishReason: ${candidate?.finishReason}`);
    console.log(`   - parts数量: ${candidate?.content?.parts?.length || 0}`);
    
    const hasToolCall = candidate?.content?.parts?.some(p => p.functionCall);
    console.log(`   - 工具调用: ${hasToolCall ? '✅ 成功' : '❌ 失败'}`);
    
    if (hasToolCall) {
      const toolCall = candidate.content.parts.find(p => p.functionCall);
      console.log('🎉 工具调用详情:');
      console.log(`   - 函数名: ${toolCall.functionCall.name}`);
      console.log(`   - 参数: ${JSON.stringify(toolCall.functionCall.args)}`);
      return true;
    } else {
      if (candidate?.content?.parts?.[0]?.text) {
        console.log(`📝 响应文本: "${candidate.content.parts[0].text.substring(0, 100)}..."`);
      }
      return false;
    }
    
  } catch (error) {
    console.error('❌ 计算测试失败:', error.message);
    return false;
  }
}

function generateFinalAnalysis(modelResult, calculationResult) {
  console.log('\n🔍 Step 4: 最终分析和诊断...');
  
  console.log('📊 测试结果汇总:');
  console.log(`   - 多模型测试: ${modelResult.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`   - 计算工具测试: ${calculationResult ? '✅ 成功' : '❌ 失败'}`);
  
  if (modelResult.success || calculationResult) {
    console.log('\n🎉 诊断结果: Gemini支持工具调用!');
    console.log('🔧 问题定位: 路由器中的工具调用配置或转换有问题');
    
    console.log('\n📝 路由器修复重点:');
    console.log('1. 检查 transformAnthropicToGemini 中的工具转换');
    console.log('2. 验证 functionCallingConfig 设置');
    console.log('3. 确保提示词足够明确');
    
    if (modelResult.success) {
      console.log(`\n✅ 成功的模型: ${modelResult.model}`);
      console.log('💡 建议: 在路由器中优先使用此模型进行工具调用');
    }
    
  } else {
    console.log('\n❌ 诊断结果: Gemini工具调用配置存在问题');
    console.log('🔧 可能原因:');
    console.log('1. API Key权限不足');
    console.log('2. Gemini SDK版本问题');
    console.log('3. 工具定义格式问题');
    console.log('4. 模型版本不支持工具调用');
    
    console.log('\n📝 建议解决方案:');
    console.log('1. 检查Gemini API Key是否有工具调用权限');
    console.log('2. 更新到最新的@google/genai SDK版本');
    console.log('3. 参考Gemini官方文档中的工具调用示例');
  }
}

async function main() {
  try {
    console.log('开始强制模式Gemini工具调用测试...\n');
    
    // 1. 测试不同模型
    const modelResult = await testMultipleModels();
    
    // 2. 测试不同提示词
    await testDifferentPrompts();
    
    // 3. 测试简单计算
    const calculationResult = await testSimpleCalculation();
    
    // 4. 最终分析
    generateFinalAnalysis(modelResult, calculationResult);
    
  } catch (error) {
    console.error('💥 测试异常:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}