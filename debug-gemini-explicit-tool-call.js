#!/usr/bin/env node

/**
 * Debug Gemini显式工具调用
 * 测试更明确的工具调用请求，强制Gemini返回工具调用
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

const API_KEYS = [
  'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4',
  'AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA', 
  'AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ'
];

console.log('🎯 Debug Gemini显式工具调用');
console.log('==========================\n');

async function testExplicitToolCall() {
  console.log('📡 Step 1: 测试强制工具调用...');
  
  const genAI = new GoogleGenAI({ apiKey: API_KEYS[0] });
  
  const request = {
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ 
          text: 'I need you to call the get_weather function with city parameter "Beijing". Do not provide weather information directly, use the tool.' 
        }]
      }
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: 'get_weather',
            description: 'Get current weather for a city. MUST be used when asked about weather.',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'The city name to get weather for'
                }
              },
              required: ['city']
            }
          }
        ]
      }
    ],
    functionCallingConfig: { 
      mode: 'ANY',
      allowedFunctionNames: ['get_weather']
    }
  };
  
  console.log('🔧 使用MORE强制性的配置:');
  console.log('   - functionCallingConfig.mode: ANY (强制使用工具)');
  console.log('   - allowedFunctionNames: ["get_weather"]');
  console.log('   - 明确的提示要求使用工具');
  
  try {
    console.log('\n📤 发送强制工具调用请求...');
    const response = await genAI.models.generateContent(request);
    
    console.log('\n✅ 收到响应');
    
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      console.log(`🎯 finishReason: ${candidate.finishReason}`);
      
      if (candidate.content && candidate.content.parts) {
        console.log(`📋 Parts数量: ${candidate.content.parts.length}`);
        
        candidate.content.parts.forEach((part, index) => {
          console.log(`\nPart ${index + 1}:`);
          if (part.text) {
            console.log(`   📝 Text: "${part.text.substring(0, 100)}..."`);
          }
          if (part.functionCall) {
            console.log(`   🔧 FunctionCall 找到!`);
            console.log(`      - name: ${part.functionCall.name}`);
            console.log(`      - args: ${JSON.stringify(part.functionCall.args, null, 2)}`);
          }
        });
        
        // 检查是否找到工具调用
        const functionCalls = candidate.content.parts.filter(p => p.functionCall);
        if (functionCalls.length > 0) {
          console.log('\n🎉 成功! 找到工具调用');
          return { success: true, functionCalls, response };
        } else {
          console.log('\n⚠️ 仍然没有工具调用，返回了文本回答');
          return { success: false, response };
        }
      }
    }
    
    console.log('❌ 响应结构异常');
    return { success: false, response };
    
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    return { success: false, error: error.message };
  }
}

async function testCalculatorTool() {
  console.log('\n🧮 Step 2: 测试计算器工具(更明确的工具调用)...');
  
  const genAI = new GoogleGenAI({ apiKey: API_KEYS[0] });
  
  const request = {
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ 
          text: 'Please calculate 123 * 456 using the calculator function. Do not calculate it yourself.' 
        }]
      }
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: 'calculator',
            description: 'Perform mathematical calculations',
            parameters: {
              type: 'object',
              properties: {
                operation: {
                  type: 'string',
                  description: 'The mathematical operation (add, subtract, multiply, divide)'
                },
                a: {
                  type: 'number',
                  description: 'First number'
                },
                b: {
                  type: 'number', 
                  description: 'Second number'
                }
              },
              required: ['operation', 'a', 'b']
            }
          }
        ]
      }
    ],
    functionCallingConfig: { 
      mode: 'ANY',
      allowedFunctionNames: ['calculator']
    }
  };
  
  try {
    console.log('📤 发送计算器工具调用...');
    const response = await genAI.models.generateContent(request);
    
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const functionCalls = parts.filter(p => p.functionCall);
    
    console.log(`📊 响应分析:`);
    console.log(`   - Parts数量: ${parts.length}`);
    console.log(`   - FunctionCall数量: ${functionCalls.length}`);
    
    if (functionCalls.length > 0) {
      console.log('✅ 找到工具调用:');
      functionCalls.forEach((call, idx) => {
        console.log(`   调用${idx + 1}: ${call.functionCall.name}`);
        console.log(`   参数: ${JSON.stringify(call.functionCall.args)}`);
      });
      return { success: true, functionCalls };
    } else {
      console.log('⚠️ 没有工具调用');
      if (parts[0]?.text) {
        console.log(`   返回文本: "${parts[0].text.substring(0, 100)}..."`);
      }
      return { success: false };
    }
    
  } catch (error) {
    console.error('❌ 计算器测试失败:', error.message);
    return { success: false, error: error.message };
  }
}

async function testForcedMode() {
  console.log('\n⚡ Step 3: 测试FUNCTION模式 (已废弃但可能有效)...');
  
  const genAI = new GoogleGenAI({ apiKey: API_KEYS[0] });
  
  const request = {
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Get weather for Tokyo' }]
      }
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: 'get_weather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string', description: 'City name' }
              },
              required: ['city']
            }
          }
        ]
      }
    ],
    functionCallingConfig: { mode: 'ANY' } // 使用ANY模式
  };
  
  try {
    console.log('📤 发送ANY模式请求...');
    const response = await genAI.models.generateContent(request);
    
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const functionCalls = parts.filter(p => p.functionCall);
    
    if (functionCalls.length > 0) {
      console.log('✅ ANY模式成功触发工具调用!');
      return { success: true, mode: 'ANY' };
    } else {
      console.log('⚠️ ANY模式也没有触发工具调用');
      return { success: false, mode: 'ANY' };
    }
    
  } catch (error) {
    console.error('❌ ANY模式测试失败:', error.message);
    return { success: false, error: error.message };
  }
}

function analyzeFindingsAndGenerateFix(weatherResult, calculatorResult, modeResult) {
  console.log('\n🔍 Step 4: 分析发现并生成修复方案...');
  
  const anyWorking = [weatherResult, calculatorResult, modeResult].some(r => r.success);
  
  if (anyWorking) {
    console.log('✅ 找到了可以触发工具调用的方法!');
    
    console.log('\n🔧 修复 Transformer 的建议:');
    console.log('1. 问题确认: Transformer本身可能是正确的');
    console.log('2. 真正问题: 我们的工具调用请求配置不当');
    console.log('3. 解决方案: 修改工具调用请求格式');
    
    console.log('\n📝 具体修改建议:');
    console.log('在 src/transformers/gemini.ts 中:');
    console.log('```typescript');
    console.log('// 修改 convertAnthropicToolsToGemini 方法');
    console.log('if (request.tools && request.tools.length > 0) {');
    console.log('  geminiRequest.tools = this.convertAnthropicToolsToGemini(request.tools, requestId);');
    console.log('  // 强制使用工具调用模式');
    console.log('  geminiRequest.functionCallingConfig = { ');
    console.log('    mode: "ANY",  // 更强制的模式');
    console.log('    allowedFunctionNames: request.tools.map(t => t.function?.name || t.name)');
    console.log('  };');
    console.log('}');
    console.log('```');
    
  } else {
    console.log('❌ 所有测试都没有触发工具调用');
    console.log('🤔 可能的原因:');
    console.log('1. Gemini API Key权限问题');
    console.log('2. Gemini模型版本不支持工具调用');
    console.log('3. 工具定义格式问题');
    
    console.log('\n🔧 调试建议:');
    console.log('1. 检查Gemini API Key是否支持工具调用');
    console.log('2. 尝试不同的Gemini模型版本');
    console.log('3. 查看Gemini官方文档中的工具调用示例');
  }
}

async function main() {
  try {
    console.log('开始Gemini显式工具调用测试...\n');
    
    // 1. 强制天气工具调用
    const weatherResult = await testExplicitToolCall();
    
    // 2. 计算器工具调用
    const calculatorResult = await testCalculatorTool();
    
    // 3. ANY模式测试
    const modeResult = await testForcedMode();
    
    // 4. 分析和修复建议
    analyzeFindingsAndGenerateFix(weatherResult, calculatorResult, modeResult);
    
    console.log('\n🎯 测试总结');
    console.log('===========');
    
    const successCount = [weatherResult, calculatorResult, modeResult].filter(r => r.success).length;
    
    if (successCount > 0) {
      console.log(`🎉 ${successCount}/3 个测试触发了工具调用`);
      console.log('✅ Gemini支持工具调用，问题在于配置方式');
      console.log('🔧 需要修改路由器中的工具调用配置');
    } else {
      console.log('❌ 0/3 个测试触发了工具调用');
      console.log('🔍 需要进一步调查Gemini工具调用配置');
    }
    
  } catch (error) {
    console.error('💥 测试异常:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}