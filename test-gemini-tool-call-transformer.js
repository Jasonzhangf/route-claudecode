#!/usr/bin/env node

/**
 * Gemini工具调用Transformer验证测试
 * 检查工具调用是否正确转换回Anthropic格式
 * Project owner: Jason Zhang
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5502';

console.log('🔧 Gemini工具调用Transformer验证测试');
console.log('==================================\n');

async function testBasicConnection() {
  console.log('📡 Step 1: 基础连接测试...');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ 健康检查通过:', response.data.status);
    return true;
  } catch (error) {
    console.error('❌ 健康检查失败:', error.message);
    return false;
  }
}

async function testSimpleTextRequest() {
  console.log('\n📝 Step 2: 简单文本请求测试...');
  
  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, {
      model: "gemini-2.5-flash",
      messages: [
        { role: "user", content: "Hello, reply with just 'Hi there!'" }
      ],
      max_tokens: 20
    });
    
    console.log('✅ 简单文本请求成功');
    console.log('📄 响应格式验证:');
    console.log(`   - ID: ${response.data.id}`);
    console.log(`   - Model: ${response.data.model}`);  
    console.log(`   - Role: ${response.data.role}`);
    console.log(`   - Content类型: ${Array.isArray(response.data.content) ? 'Array' : typeof response.data.content}`);
    console.log(`   - Content长度: ${response.data.content?.length || 0}`);
    console.log(`   - Stop reason: ${response.data.stop_reason}`);
    
    if (response.data.content && response.data.content[0]?.type === 'text') {
      console.log(`   - 文本内容: "${response.data.content[0].text.substring(0, 50)}..."`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ 简单文本请求失败:', error.response?.data || error.message);
    return null;
  }
}

async function testToolCallRequest() {
  console.log('\n🔧 Step 3: 工具调用请求测试...');
  
  const toolCallRequest = {
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "user",
        content: "What's the weather like in Beijing? Use the weather tool."
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get current weather for a city",
          parameters: {
            type: "object",
            properties: {
              city: {
                type: "string",
                description: "City name"
              }
            },
            required: ["city"]
          }
        }
      }
    ],
    max_tokens: 200
  };
  
  console.log('📤 发送工具调用请求...');
  console.log('🔧 工具定义:');
  console.log(`   - 工具名: ${toolCallRequest.tools[0].function.name}`);
  console.log(`   - 描述: ${toolCallRequest.tools[0].function.description}`);
  
  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, toolCallRequest);
    
    console.log('\n✅ 工具调用请求成功');
    console.log('📋 响应详细分析:');
    console.log(`   - ID: ${response.data.id}`);
    console.log(`   - Model: ${response.data.model}`);
    console.log(`   - Role: ${response.data.role}`);
    console.log(`   - Content数组长度: ${response.data.content?.length || 0}`);
    console.log(`   - Stop reason: ${response.data.stop_reason}`);
    
    if (response.data.content && Array.isArray(response.data.content)) {
      console.log('\n🔍 Content块分析:');
      
      response.data.content.forEach((block, index) => {
        console.log(`   Block ${index + 1}:`);
        console.log(`     - Type: ${block.type}`);
        
        if (block.type === 'text') {
          console.log(`     - Text: "${block.text?.substring(0, 100)}..."`);
        } else if (block.type === 'tool_use') {
          console.log(`     - Tool ID: ${block.id}`);
          console.log(`     - Tool Name: ${block.name}`);
          console.log(`     - Input: ${JSON.stringify(block.input, null, 2)}`);
        }
      });
      
      // 检查是否有工具调用
      const toolUseBlocks = response.data.content.filter(b => b.type === 'tool_use');
      const textBlocks = response.data.content.filter(b => b.type === 'text');
      
      console.log('\n🎯 工具调用验证:');
      console.log(`   - 工具调用块数: ${toolUseBlocks.length}`);
      console.log(`   - 文本块数: ${textBlocks.length}`);
      
      if (toolUseBlocks.length > 0) {
        console.log('   ✅ 检测到工具调用 - Transformer正确工作');
        
        // 验证工具调用格式
        const toolCall = toolUseBlocks[0];
        const formatValid = toolCall.id && toolCall.name && typeof toolCall.input === 'object';
        
        console.log('\n🔍 工具调用格式验证:');
        console.log(`   - ID存在: ${!!toolCall.id}`);
        console.log(`   - Name存在: ${!!toolCall.name}`);
        console.log(`   - Input格式: ${typeof toolCall.input}`);
        console.log(`   - 格式完整性: ${formatValid ? '✅ 正确' : '❌ 不完整'}`);
        
        return {
          success: true,
          hasToolCall: true,
          toolCall: toolCall,
          formatValid
        };
      } else {
        console.log('   ❌ 未检测到工具调用 - 可能是Transformer问题');
        return {
          success: true,
          hasToolCall: false,
          formatValid: false
        };
      }
    } else {
      console.log('❌ 响应Content格式异常');
      return {
        success: false,
        hasToolCall: false,
        formatValid: false
      };
    }
    
  } catch (error) {
    console.error('❌ 工具调用请求失败:', error.response?.data || error.message);
    console.error('🔍 错误详情:');
    
    if (error.response?.data?.error?.message) {
      console.error(`   - API错误: ${error.response.data.error.message}`);
    }
    
    return {
      success: false,
      hasToolCall: false,
      formatValid: false,
      error: error.response?.data || error.message
    };
  }
}

async function testMultiToolRequest() {
  console.log('\n🔧 Step 4: 多工具调用测试...');
  
  const multiToolRequest = {
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "user",
        content: "Get the weather in Tokyo and also calculate 15 * 25"
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get current weather for a city",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string", description: "City name" }
            },
            required: ["city"]
          }
        }
      },
      {
        type: "function", 
        function: {
          name: "calculate",
          description: "Perform mathematical calculations",
          parameters: {
            type: "object",
            properties: {
              operation: { type: "string", description: "Math operation" },
              a: { type: "number", description: "First number" },
              b: { type: "number", description: "Second number" }
            },
            required: ["operation", "a", "b"]
          }
        }
      }
    ],
    max_tokens: 300
  };
  
  console.log('📤 发送多工具调用请求...');
  console.log(`🔧 定义了 ${multiToolRequest.tools.length} 个工具`);
  
  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, multiToolRequest);
    
    console.log('✅ 多工具调用请求成功');
    
    if (response.data.content && Array.isArray(response.data.content)) {
      const toolUseBlocks = response.data.content.filter(b => b.type === 'tool_use');
      
      console.log(`🎯 检测到 ${toolUseBlocks.length} 个工具调用`);
      
      toolUseBlocks.forEach((toolCall, index) => {
        console.log(`   工具${index + 1}: ${toolCall.name} (${toolCall.id})`);
        console.log(`   参数: ${JSON.stringify(toolCall.input)}`);
      });
      
      return {
        success: true,
        toolCallCount: toolUseBlocks.length,
        toolCalls: toolUseBlocks
      };
    } else {
      console.log('❌ 多工具调用响应格式异常');
      return { success: false, toolCallCount: 0 };
    }
    
  } catch (error) {
    console.error('❌ 多工具调用失败:', error.response?.data || error.message);
    return { success: false, toolCallCount: 0, error: error.message };
  }
}

function analyzeTransformerIssues(simpleResult, toolResult, multiToolResult) {
  console.log('\n🔍 Step 5: Transformer问题诊断...');
  
  const issues = [];
  const successes = [];
  
  // 基础文本转换检查
  if (simpleResult && simpleResult.content) {
    successes.push('✅ 基础文本响应转换正常');
  } else {
    issues.push('❌ 基础文本响应转换失败');
  }
  
  // 工具调用转换检查
  if (toolResult?.hasToolCall) {
    if (toolResult.formatValid) {
      successes.push('✅ 工具调用转换完全正常');
    } else {
      issues.push('⚠️ 工具调用转换部分异常 - 格式不完整');
    }
  } else if (toolResult?.success) {
    issues.push('❌ 工具调用转换失败 - Gemini未返回工具调用或转换丢失');
  } else {
    issues.push('❌ 工具调用请求完全失败');
  }
  
  // 多工具调用检查
  if (multiToolResult?.success) {
    if (multiToolResult.toolCallCount > 1) {
      successes.push('✅ 多工具调用转换正常');
    } else if (multiToolResult.toolCallCount === 1) {
      issues.push('⚠️ 多工具调用部分工作 - 只返回了1个工具调用');
    } else {
      issues.push('❌ 多工具调用转换失败 - 未检测到工具调用');
    }
  } else {
    issues.push('❌ 多工具调用请求失败');
  }
  
  console.log('📊 诊断结果:');
  console.log('\n🎉 正常功能:');
  successes.forEach(success => console.log(`   ${success}`));
  
  console.log('\n🚨 发现的问题:');
  issues.forEach(issue => console.log(`   ${issue}`));
  
  return { issues, successes };
}

function generateRecommendations(diagnosis) {
  console.log('\n💡 Step 6: 修复建议...');
  
  const { issues } = diagnosis;
  
  if (issues.some(i => i.includes('工具调用转换失败'))) {
    console.log('🔧 Gemini工具调用转换问题修复建议:');
    console.log('');
    console.log('1. 📄 检查 src/transformers/gemini.ts:');
    console.log('   - convertGeminiPartsToAnthropic() 方法');
    console.log('   - 确保 functionCall 正确转换为 tool_use');
    console.log('   - 验证 tool_use 格式包含 id, name, input');
    console.log('');
    console.log('2. 📄 检查 Gemini API 响应:');
    console.log('   - 确认 Gemini 返回 functionCall 对象');
    console.log('   - 检查 Gemini 响应结构是否符合预期');
    console.log('');
    console.log('3. 🐛 可能的问题位置:');
    console.log('   - gemini.ts:266-290 (convertGeminiPartsToAnthropic)');
    console.log('   - gemini.ts:273-289 (functionCall 处理逻辑)');
  }
  
  if (issues.some(i => i.includes('多工具调用'))) {
    console.log('🔧 多工具调用问题修复建议:');
    console.log('   - 检查 Gemini 是否支持多工具并发调用');
    console.log('   - 验证工具定义转换的完整性');
  }
  
  if (issues.some(i => i.includes('格式不完整'))) {
    console.log('🔧 格式完整性问题修复建议:');
    console.log('   - 检查 tool_use ID 生成逻辑');
    console.log('   - 验证 input 参数转换');
  }
}

async function main() {
  try {
    console.log('开始Gemini工具调用Transformer验证测试...\n');
    
    // 1. 基础连接测试
    const connected = await testBasicConnection();
    if (!connected) {
      console.error('❌ 无法连接到服务器，终止测试');
      process.exit(1);
    }
    
    // 2. 简单文本请求
    const simpleResult = await testSimpleTextRequest();
    
    // 3. 工具调用测试
    const toolResult = await testToolCallRequest();
    
    // 4. 多工具调用测试
    const multiToolResult = await testMultiToolRequest();
    
    // 5. 问题诊断
    const diagnosis = analyzeTransformerIssues(simpleResult, toolResult, multiToolResult);
    
    // 6. 修复建议
    generateRecommendations(diagnosis);
    
    // 7. 测试结论
    console.log('\n🎯 测试结论');
    console.log('===========');
    
    const hasIssues = diagnosis.issues.length > 0;
    const hasSuccess = diagnosis.successes.length > 0;
    
    if (hasSuccess && !hasIssues) {
      console.log('🎉 Gemini工具调用Transformer工作完全正常!');
      console.log('✅ 所有测试通过，可以继续其他任务');
    } else if (hasSuccess && hasIssues) {
      console.log('⚠️ Gemini工具调用Transformer部分正常，存在问题需要修复');
      console.log(`✅ ${diagnosis.successes.length} 个功能正常`);
      console.log(`❌ ${diagnosis.issues.length} 个问题需要解决`);
    } else {
      console.log('❌ Gemini工具调用Transformer存在严重问题');
      console.log('🔧 需要重点检查 Transformer 实现');
    }
    
  } catch (error) {
    console.error('💥 测试异常:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}