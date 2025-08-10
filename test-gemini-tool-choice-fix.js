#!/usr/bin/env node
/**
 * 测试Gemini工具选择修复 - 验证tool_choice动态配置
 * Project owner: Jason Zhang
 */

const { GeminiTransformer } = require('./dist/transformers/gemini.js');

function testToolChoiceConfiguration() {
  console.log('🔧 测试Gemini工具选择配置修复...\n');
  
  const transformer = new GeminiTransformer();
  transformer.setProviderId('test-provider');
  
  const baseRequest = {
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'user', content: 'Use the calculator to compute 8 × 9' }
    ],
    tools: [
      {
        function: {
          name: 'calculator',
          description: 'Perform mathematical calculations',
          parameters: {
            type: 'object',
            properties: {
              operation: { type: 'string' },
              a: { type: 'number' },
              b: { type: 'number' }
            },
            required: ['operation', 'a', 'b']
          }
        }
      }
    ],
    metadata: { requestId: 'test-001' }
  };

  // 测试场景1：没有tool_choice (应该使用AUTO)
  console.log('📋 测试1: 没有tool_choice - 应该使用AUTO模式');
  try {
    const result1 = transformer.transformAnthropicToGemini({ ...baseRequest });
    console.log('✅ toolConfig:', JSON.stringify(result1.toolConfig, null, 2));
    console.log('   预期: mode=AUTO, allowedFunctionNames=["calculator"]\n');
  } catch (error) {
    console.error('❌ 测试1失败:', error.message);
  }

  // 测试场景2：tool_choice = "auto"
  console.log('📋 测试2: tool_choice="auto" - 应该使用AUTO模式');
  try {
    const result2 = transformer.transformAnthropicToGemini({
      ...baseRequest,
      tool_choice: 'auto'
    });
    console.log('✅ toolConfig:', JSON.stringify(result2.toolConfig, null, 2));
    console.log('   预期: mode=AUTO\n');
  } catch (error) {
    console.error('❌ 测试2失败:', error.message);
  }

  // 测试场景3：tool_choice = "required"
  console.log('📋 测试3: tool_choice="required" - 应该使用ANY模式强制调用');
  try {
    const result3 = transformer.transformAnthropicToGemini({
      ...baseRequest,
      tool_choice: 'required'
    });
    console.log('✅ toolConfig:', JSON.stringify(result3.toolConfig, null, 2));
    console.log('   预期: mode=ANY (强制工具调用)\n');
  } catch (error) {
    console.error('❌ 测试3失败:', error.message);
  }

  // 测试场景4：tool_choice = "none"
  console.log('📋 测试4: tool_choice="none" - 应该使用NONE模式禁用工具');
  try {
    const result4 = transformer.transformAnthropicToGemini({
      ...baseRequest,
      tool_choice: 'none'
    });
    console.log('✅ toolConfig:', JSON.stringify(result4.toolConfig, null, 2));
    console.log('   预期: mode=NONE (禁用工具调用)\n');
  } catch (error) {
    console.error('❌ 测试4失败:', error.message);
  }

  // 测试场景5：tool_choice指定特定函数
  console.log('📋 测试5: tool_choice指定特定函数 - 应该只允许该函数');
  try {
    const result5 = transformer.transformAnthropicToGemini({
      ...baseRequest,
      tool_choice: {
        type: 'function',
        function: { name: 'calculator' }
      }
    });
    console.log('✅ toolConfig:', JSON.stringify(result5.toolConfig, null, 2));
    console.log('   预期: mode=ANY, allowedFunctionNames=["calculator"]\n');
  } catch (error) {
    console.error('❌ 测试5失败:', error.message);
  }

  console.log('🎯 工具选择配置测试完成');
  console.log('💡 关键修复点：');
  console.log('   - 不再强制使用ANY模式');
  console.log('   - 根据tool_choice动态设置工具调用策略');
  console.log('   - 参考demo3的buildToolConfig模式');
  console.log('   - 默认使用AUTO让Gemini自主判断何时调用工具');
}

// 执行测试
testToolChoiceConfiguration();