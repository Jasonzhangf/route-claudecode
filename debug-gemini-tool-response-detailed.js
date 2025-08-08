#!/usr/bin/env node

/**
 * 详细调试Gemini工具调用响应格式
 * 深入分析工具调用时的实际响应结构和内容解析问题
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

const API_KEYS = [
  'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4',
  'AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA', 
  'AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ'
];

console.log('🔍 详细调试Gemini工具调用响应格式');
console.log('===================================\n');

async function testToolCallWithDetailedAnalysis() {
  console.log('🧪 Step 1: 详细分析工具调用响应...');
  
  const genAI = new GoogleGenAI({ apiKey: API_KEYS[0] });
  
  // 尝试多种工具调用模式
  const testCases = [
    {
      name: 'AUTO模式天气查询',
      request: {
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'What\'s the weather in Tokyo? Please use the weather tool to get accurate information.' }]
          }
        ],
        tools: [
          {
            functionDeclarations: [
              {
                name: 'get_weather',
                description: 'Get current weather information for a city',
                parameters: {
                  type: 'object',
                  properties: {
                    city: {
                      type: 'string',
                      description: 'The city name'
                    }
                  },
                  required: ['city']
                }
              }
            ]
          }
        ],
        functionCallingConfig: { mode: 'AUTO' }
      }
    },
    {
      name: 'ANY模式计算器',
      request: {
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Calculate 25 * 34 using the calculator function' }]
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
                      enum: ['multiply', 'add', 'subtract', 'divide'],
                      description: 'The operation to perform'
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
        functionCallingConfig: { mode: 'ANY' }
      }
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\n🎯 测试案例: ${testCase.name}`);
    console.log(`📋 配置: ${JSON.stringify(testCase.request.functionCallingConfig)}`);
    
    try {
      console.log('📤 发送请求...');
      const response = await genAI.models.generateContent(testCase.request);
      
      console.log('✅ 收到响应');
      console.log(`📊 完整响应结构分析:`);
      
      // 分析响应的每一层结构
      console.log(`   - 响应键: ${Object.keys(response).join(', ')}`);
      
      if (response.candidates) {
        console.log(`   - Candidates数量: ${response.candidates.length}`);
        
        const candidate = response.candidates[0];
        console.log(`   - Candidate键: ${Object.keys(candidate).join(', ')}`);
        console.log(`   - finishReason: ${candidate.finishReason}`);
        console.log(`   - index: ${candidate.index}`);
        
        if (candidate.content) {
          console.log(`   - content键: ${Object.keys(candidate.content).join(', ')}`);
          console.log(`   - content.role: ${candidate.content.role}`);
          console.log(`   - content.parts数量: ${candidate.content.parts?.length || 0}`);
          
          if (candidate.content.parts) {
            candidate.content.parts.forEach((part, idx) => {
              console.log(`\n   🧩 Part ${idx + 1}:`);
              console.log(`      - 包含的键: ${Object.keys(part).join(', ')}`);
              
              if (part.text) {
                console.log(`      - text: "${part.text.substring(0, 80)}..."`);
              }
              
              if (part.functionCall) {
                console.log(`      - functionCall 存在!`);
                console.log(`      - functionCall键: ${Object.keys(part.functionCall).join(', ')}`);
                console.log(`      - name: ${part.functionCall.name}`);
                console.log(`      - args: ${JSON.stringify(part.functionCall.args, null, 2)}`);
              }
              
              // 检查其他可能的工具调用字段
              ['function_call', 'tool_call', 'toolCall'].forEach(field => {
                if (part[field]) {
                  console.log(`      - ${field} 存在: ${JSON.stringify(part[field])}`);
                }
              });
            });
          }
        } else {
          console.log('   ❌ candidate.content 不存在');
          
          // 检查candidate级别的其他字段
          Object.keys(candidate).forEach(key => {
            if (key !== 'content' && key !== 'finishReason' && key !== 'index') {
              console.log(`   - ${key}: ${typeof candidate[key]} - ${JSON.stringify(candidate[key]).substring(0, 100)}...`);
            }
          });
        }
      }
      
      // 检查Usage metadata
      if (response.usageMetadata) {
        console.log(`\n   📈 Usage: prompt=${response.usageMetadata.promptTokenCount}, candidates=${response.usageMetadata.candidatesTokenCount}`);
      }
      
      // 分析工具调用检测
      const hasToolCall = response.candidates?.[0]?.content?.parts?.some(p => p.functionCall);
      console.log(`\n   🔧 工具调用检测: ${hasToolCall ? '✅ 找到' : '❌ 未找到'}`);
      
      results.push({
        testCase: testCase.name,
        success: true,
        hasToolCall,
        response,
        candidate: response.candidates?.[0]
      });
      
    } catch (error) {
      console.error(`❌ ${testCase.name} 失败:`, error.message);
      results.push({
        testCase: testCase.name,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

function analyzeResponsePatterns(results) {
  console.log('\n🔍 Step 2: 响应模式分析...');
  
  const successfulTests = results.filter(r => r.success);
  const toolCallTests = results.filter(r => r.hasToolCall);
  
  console.log(`📊 测试结果统计:`);
  console.log(`   - 成功测试: ${successfulTests.length}/${results.length}`);
  console.log(`   - 检测到工具调用: ${toolCallTests.length}/${results.length}`);
  
  if (toolCallTests.length > 0) {
    console.log('\n✅ 工具调用成功案例分析:');
    toolCallTests.forEach(test => {
      const parts = test.candidate?.content?.parts || [];
      const functionCalls = parts.filter(p => p.functionCall);
      
      console.log(`   ${test.testCase}:`);
      functionCalls.forEach((call, idx) => {
        console.log(`     工具${idx + 1}: ${call.functionCall.name}`);
        console.log(`     参数: ${JSON.stringify(call.functionCall.args)}`);
      });
    });
  }
  
  if (successfulTests.length > 0 && toolCallTests.length === 0) {
    console.log('\n⚠️ 所有测试成功但无工具调用:');
    successfulTests.forEach(test => {
      const parts = test.candidate?.content?.parts || [];
      const textParts = parts.filter(p => p.text);
      
      console.log(`   ${test.testCase}:`);
      if (textParts.length > 0) {
        console.log(`     返回文本: "${textParts[0].text.substring(0, 100)}..."`);
      }
    });
    
    console.log('\n💡 分析: Gemini可能正在直接回答问题而不是调用工具');
  }
}

function generateTransformerDiagnosis(results) {
  console.log('\n🔧 Step 3: Transformer诊断和修复建议...');
  
  const toolCallTests = results.filter(r => r.hasToolCall);
  
  if (toolCallTests.length > 0) {
    console.log('✅ Gemini确实可以返回工具调用');
    console.log('🔧 Transformer修复重点:');
    console.log('   1. 确保正确处理 functionCall 字段');
    console.log('   2. 验证 args 参数正确转换为 input');
    console.log('   3. 生成正确的 tool_use ID');
    
    console.log('\n📝 具体修复代码:');
    console.log('```typescript');
    console.log('// 在 convertGeminiPartsToAnthropic 方法中');
    console.log('if (part.functionCall) {');
    console.log('  content.push({');
    console.log('    type: "tool_use",');
    console.log('    id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,');
    console.log('    name: part.functionCall.name,');
    console.log('    input: part.functionCall.args || {}');
    console.log('  });');
    console.log('}');
    console.log('```');
  } else {
    console.log('❌ Gemini没有返回工具调用');
    console.log('🔧 问题可能在于:');
    console.log('   1. 工具定义格式不正确');
    console.log('   2. functionCallingConfig 配置问题');
    console.log('   3. 提示词不够明确');
    
    console.log('\n📝 修复建议:');
    console.log('1. 检查 convertAnthropicToolsToGemini 方法');
    console.log('2. 尝试更强制性的 functionCallingConfig');
    console.log('3. 改进工具描述使其更明确');
  }
}

async function main() {
  try {
    console.log('开始详细调试Gemini工具调用响应格式...\n');
    
    // 1. 执行详细测试
    const results = await testToolCallWithDetailedAnalysis();
    
    // 2. 分析响应模式
    analyzeResponsePatterns(results);
    
    // 3. 生成诊断建议
    generateTransformerDiagnosis(results);
    
    console.log('\n🎯 调试总结');
    console.log('===========');
    
    const toolCallCount = results.filter(r => r.hasToolCall).length;
    
    if (toolCallCount > 0) {
      console.log(`🎉 成功: ${toolCallCount} 个测试触发了工具调用`);
      console.log('✅ 问题在于Transformer实现，需要修复convertGeminiPartsToAnthropic方法');
    } else {
      console.log('❌ 没有任何测试触发工具调用');
      console.log('🔧 问题在于Gemini配置或工具定义');
    }
    
  } catch (error) {
    console.error('💥 调试异常:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}