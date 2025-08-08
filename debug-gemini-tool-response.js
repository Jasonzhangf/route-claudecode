#!/usr/bin/env node

/**
 * Debug Gemini工具调用响应结构
 * 检查Gemini API在工具调用时的实际响应格式
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

console.log('🐛 Debug Gemini工具调用响应结构');
console.log('===============================\n');

// 使用配置中的API Key进行测试
const API_KEYS = [
  'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4',
  'AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA', 
  'AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ'
];

async function testDirectGeminiToolCall() {
  console.log('📡 Step 1: 直接Gemini API工具调用测试...');
  
  const genAI = new GoogleGenAI({ apiKey: API_KEYS[0] });
  
  // 构造Gemini格式的工具调用请求
  const request = {
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: 'What\'s the weather like in Beijing? Use the weather tool.' }]
      }
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: 'get_weather',
            description: 'Get current weather for a city',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'City name'
                }
              },
              required: ['city']
            }
          }
        ]
      }
    ],
    functionCallingConfig: { mode: 'AUTO' }
  };
  
  console.log('🔧 发送的请求结构:');
  console.log(JSON.stringify(request, null, 2));
  
  try {
    console.log('\n📤 发送请求到Gemini API...');
    const response = await genAI.models.generateContent(request);
    
    console.log('\n✅ 收到Gemini响应');
    console.log('📋 完整响应结构:');
    console.log(JSON.stringify(response, null, 2));
    
    console.log('\n🔍 详细分析:');
    console.log(`📊 Candidates数量: ${response.candidates?.length || 0}`);
    
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      console.log('\n🎯 第一个Candidate分析:');
      console.log(`   - finishReason: ${candidate.finishReason}`);
      console.log(`   - content存在: ${!!candidate.content}`);
      
      if (candidate.content) {
        console.log(`   - content.role: ${candidate.content.role}`);
        console.log(`   - content.parts存在: ${!!candidate.content.parts}`);
        console.log(`   - content.parts数量: ${candidate.content.parts?.length || 0}`);
        
        if (candidate.content.parts && candidate.content.parts.length > 0) {
          console.log('\n🧩 Parts详细分析:');
          candidate.content.parts.forEach((part, index) => {
            console.log(`   Part ${index + 1}:`);
            console.log(`     - text: ${part.text ? `"${part.text.substring(0, 50)}..."` : 'null'}`);
            console.log(`     - functionCall: ${part.functionCall ? 'exists' : 'null'}`);
            
            if (part.functionCall) {
              console.log(`       - name: ${part.functionCall.name}`);
              console.log(`       - args: ${JSON.stringify(part.functionCall.args)}`);
            }
          });
        } else {
          console.log('❌ content.parts 为空或不存在');
        }
      } else {
        console.log('❌ candidate.content 不存在');
      }
    } else {
      console.log('❌ 没有candidates');
    }
    
    // 检查usage metadata
    if (response.usageMetadata) {
      console.log('\n📈 Usage Metadata:');
      console.log(`   - promptTokenCount: ${response.usageMetadata.promptTokenCount}`);
      console.log(`   - candidatesTokenCount: ${response.usageMetadata.candidatesTokenCount}`);
      console.log(`   - totalTokenCount: ${response.usageMetadata.totalTokenCount}`);
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Gemini API调用失败:');
    console.error('错误详情:', error.message);
    console.error('完整错误:', error);
    return null;
  }
}

async function testSimpleGeminiText() {
  console.log('\n📝 Step 2: 简单文本请求对比测试...');
  
  const genAI = new GoogleGenAI({ apiKey: API_KEYS[0] });
  
  const request = {
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Hello, just say hi!' }]
      }
    ]
  };
  
  try {
    console.log('📤 发送简单文本请求...');
    const response = await genAI.models.generateContent(request);
    
    console.log('✅ 简单文本响应结构:');
    
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      console.log(`   - content存在: ${!!candidate.content}`);
      console.log(`   - content.parts存在: ${!!candidate.content?.parts}`);
      console.log(`   - parts数量: ${candidate.content?.parts?.length || 0}`);
      
      if (candidate.content?.parts?.[0]) {
        const part = candidate.content.parts[0];
        console.log(`   - 文本内容: "${part.text?.substring(0, 50)}..."`);
      }
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ 简单文本请求失败:', error.message);
    return null;
  }
}

function analyzeResponseDifferences(toolResponse, textResponse) {
  console.log('\n🔍 Step 3: 响应结构对比分析...');
  
  console.log('📊 结构对比:');
  
  if (toolResponse && textResponse) {
    const toolCandidate = toolResponse.candidates?.[0];
    const textCandidate = textResponse.candidates?.[0];
    
    console.log('工具调用响应:');
    console.log(`   - candidates: ${toolResponse.candidates?.length || 0}`);
    console.log(`   - content存在: ${!!toolCandidate?.content}`);
    console.log(`   - parts存在: ${!!toolCandidate?.content?.parts}`);
    console.log(`   - finishReason: ${toolCandidate?.finishReason}`);
    
    console.log('\n简单文本响应:');
    console.log(`   - candidates: ${textResponse.candidates?.length || 0}`);
    console.log(`   - content存在: ${!!textCandidate?.content}`);
    console.log(`   - parts存在: ${!!textCandidate?.content?.parts}`);
    console.log(`   - finishReason: ${textCandidate?.finishReason}`);
    
    // 识别关键差异
    const toolHasContent = !!toolCandidate?.content?.parts;
    const textHasContent = !!textCandidate?.content?.parts;
    
    if (!toolHasContent && textHasContent) {
      console.log('\n🚨 发现问题:');
      console.log('   ❌ 工具调用响应缺少content.parts');
      console.log('   ✅ 简单文本响应content.parts正常');
      console.log('   💡 可能原因: Gemini工具调用时返回结构不同');
    }
  }
}

function generateTransformerFix(toolResponse) {
  console.log('\n🔧 Step 4: Transformer修复建议...');
  
  if (!toolResponse) {
    console.log('❌ 无法生成修复建议 - 工具调用响应为空');
    return;
  }
  
  const candidate = toolResponse.candidates?.[0];
  
  if (!candidate) {
    console.log('❌ 响应没有candidates');
    return;
  }
  
  console.log('🛠️ 基于实际响应结构的修复建议:');
  console.log('');
  console.log('在 src/transformers/gemini.ts 中修改:');
  console.log('');
  
  if (!candidate.content) {
    console.log('1. 处理缺失content的情况:');
    console.log('```typescript');
    console.log('if (!candidate.content) {');
    console.log('  // 某些工具调用可能没有content，检查其他字段');
    console.log('  logger.warn("Gemini candidate missing content", { finishReason: candidate.finishReason });');
    console.log('  // 创建空content或处理特殊情况');
    console.log('}');
    console.log('```');
  }
  
  if (!candidate.content?.parts) {
    console.log('2. 处理缺失parts的情况:');
    console.log('```typescript');
    console.log('if (!candidate.content.parts || candidate.content.parts.length === 0) {');
    console.log('  // 检查是否有其他字段包含工具调用信息');
    console.log('  if (candidate.functionCall || candidate.toolCalls) {');
    console.log('    // 处理直接在candidate级别的工具调用');
    console.log('  }');
    console.log('  return [{ type: "text", text: "No content available" }];');
    console.log('}');
    console.log('```');
  }
  
  // 检查实际的响应字段
  console.log('\n📋 实际响应字段分析:');
  const candidateKeys = Object.keys(candidate);
  console.log(`Candidate包含的字段: ${candidateKeys.join(', ')}`);
  
  candidateKeys.forEach(key => {
    if (key !== 'content') {
      console.log(`   - ${key}: ${typeof candidate[key]} ${candidate[key] ? '(存在)' : '(空)'}`);
    }
  });
}

async function main() {
  try {
    console.log('开始Debug Gemini工具调用响应结构...\n');
    
    // 1. 测试工具调用
    const toolResponse = await testDirectGeminiToolCall();
    
    // 2. 测试简单文本
    const textResponse = await testSimpleGeminiText();
    
    // 3. 对比分析
    analyzeResponseDifferences(toolResponse, textResponse);
    
    // 4. 生成修复建议
    generateTransformerFix(toolResponse);
    
    console.log('\n🎯 Debug总结');
    console.log('===========');
    
    if (toolResponse) {
      console.log('✅ 成功获取Gemini工具调用响应');
      console.log('🔍 可以根据实际响应结构调整Transformer');
    } else {
      console.log('❌ 无法获取Gemini工具调用响应');
      console.log('🔧 需要检查API Key和网络连接');
    }
    
  } catch (error) {
    console.error('💥 Debug异常:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}