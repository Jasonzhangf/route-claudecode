#!/usr/bin/env node

/**
 * 调试工具定义预处理过程
 * 验证统一兼容性预处理器是否正确处理malformed工具定义
 */

const { getUnifiedCompatibilityPreprocessor } = require('./dist/preprocessing/unified-compatibility-preprocessor');
const { setDefaultPort } = require('./dist/logging/logger-manager');

console.log('🧪 调试工具定义预处理过程...');
console.log('=' + '='.repeat(50));

async function testToolPreprocessing() {
  // 设置默认端口
  setDefaultPort(3456);
  const processor = getUnifiedCompatibilityPreprocessor(3456);
  
  // 有问题的工具定义
  const problematicInput = {
    model: 'claude-4-sonnet',
    messages: [{ role: 'user', content: 'Test message' }],
    max_tokens: 1000,
    tools: [
      // 正常工具
      {
        name: "ValidTool",
        description: "A valid tool",
        input_schema: {
          type: "object", 
          properties: {
            param: { type: "string", description: "Valid parameter" }
          },
          required: ["param"]
        }
      },
      // 有问题的工具 - malformed input_schema
      {
        name: "ProblematicTool",
        description: "This tool has malformed input_schema", 
        input_schema: {
          type: "object",
          properties: {
            test: "invalid_format"  // 错误：应该是 { type: "string" }
          }
        }
      }
    ]
  };
  
  console.log('\n📋 原始工具定义:');
  problematicInput.tools.forEach((tool, index) => {
    console.log(`Tool ${index}: ${tool.name}`);
    if (tool.input_schema?.properties) {
      console.log(`  Properties:`, JSON.stringify(tool.input_schema.properties, null, 2));
    }
  });
  
  try {
    console.log('\n🔧 运行预处理器...');
    const processedInput = await processor.preprocessInput(
      problematicInput,
      'modelscope',
      'GLM-4.5',
      'test-request-preprocessing'
    );
    
    console.log('\n✅ 预处理完成!');
    console.log(`处理后工具数量: ${processedInput.tools?.length || 0}`);
    
    if (processedInput.tools) {
      processedInput.tools.forEach((tool, index) => {
        console.log(`\n🔍 处理后的工具 ${index}: ${tool.function?.name || tool.name || 'unknown'}`);
        console.log(`  Type: ${tool.type}`);
        if (tool.function) {
          console.log(`  Function name: ${tool.function.name}`);
          console.log(`  Description: ${tool.function.description}`);
          if (tool.function.parameters) {
            console.log(`  Parameters:`, JSON.stringify(tool.function.parameters, null, 2));
          }
        }
      });
    }
    
    // 检查是否修复了malformed的input_schema
    const originalProblematicTool = problematicInput.tools[1];
    const processedProblematicTool = processedInput.tools?.[1];
    
    if (processedProblematicTool) {
      console.log('\n🎯 Malformed工具修复结果:');
      console.log('原始:', originalProblematicTool.input_schema.properties.test);
      console.log('修复后:', processedProblematicTool.function?.parameters?.properties?.test);
      
      const isFixed = (
        processedProblematicTool.function?.parameters?.properties?.test &&
        typeof processedProblematicTool.function.parameters.properties.test === 'object' &&
        processedProblematicTool.function.parameters.properties.test.type
      );
      
      if (isFixed) {
        console.log('✅ Malformed input_schema已成功修复!');
      } else {
        console.log('❌ Malformed input_schema修复失败');
      }
    }
    
    return { success: true, processedInput };
    
  } catch (error) {
    console.log('❌ 预处理失败:', error.message);
    console.log('Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

async function main() {
  try {
    const result = await testToolPreprocessing();
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 预处理测试总结:');
    
    if (result.success) {
      console.log('✅ 工具定义预处理成功');
      console.log('✅ 统一兼容性预处理器正常工作');
      console.log('📝 如果API调用仍然失败，问题可能在Provider层或API格式转换');
    } else {
      console.log('❌ 工具定义预处理失败');
      console.log('🔧 需要修复统一兼容性预处理器的工具标准化逻辑');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

main();