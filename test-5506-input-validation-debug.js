#!/usr/bin/env node

/**
 * 调试5506端口输入验证失败的具体原因
 * 直接测试OpenAIInputProcessor的canProcess和validate方法
 */

// 模拟工具调用请求
const testRequest = {
  messages: [
    { 
      role: 'user', 
      content: '请使用grep工具搜索当前目录中包含"testing"的文件' 
    }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "grep",
        description: "搜索文件中的文本模式",
        parameters: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "搜索模式"
            },
            path: {
              type: "string", 
              description: "搜索路径"
            }
          },
          required: ["pattern"]
        }
      }
    }
  ],
  max_tokens: 1024,
  temperature: 0.7,
  stream: false,
  model: "qwen3-30b"
};

console.log('🔍 开始调试输入验证失败问题...');
console.log('=' + '='.repeat(70));

async function testInputValidation() {
  try {
    // 动态导入 OpenAI 输入处理器
    const { OpenAIInputProcessor } = await import('./src/input/openai/processor.js');
    const processor = new OpenAIInputProcessor();
    
    console.log('\n📋 测试请求结构:');
    console.log('- model:', testRequest.model);
    console.log('- messages:', testRequest.messages.length, '条消息');
    console.log('- tools:', testRequest.tools.length, '个工具');
    console.log('- max_tokens:', testRequest.max_tokens);
    console.log('- temperature:', testRequest.temperature);
    console.log('- stream:', testRequest.stream);
    
    // 测试每个验证步骤
    console.log('\n🧪 详细验证测试:');
    
    // Step 1: 基本对象检查
    const isObject = testRequest && typeof testRequest === 'object';
    console.log(`1. 基本对象检查: ${isObject ? '✅' : '❌'}`);
    
    // Step 2: model检查
    const hasValidModel = typeof testRequest.model === 'string';
    console.log(`2. model字段检查: ${hasValidModel ? '✅' : '❌'} (type: ${typeof testRequest.model}, value: "${testRequest.model}")`);
    
    // Step 3: messages检查
    const hasValidMessages = Array.isArray(testRequest.messages) && testRequest.messages.length > 0;
    console.log(`3. messages数组检查: ${hasValidMessages ? '✅' : '❌'} (是数组: ${Array.isArray(testRequest.messages)}, 长度: ${testRequest.messages?.length || 0})`);
    
    // Step 4: 每个message的验证
    if (hasValidMessages) {
      testRequest.messages.forEach((msg, index) => {
        const msgValid = msg && 
          typeof msg.role === 'string' &&
          ['user', 'assistant', 'system', 'tool'].includes(msg.role) &&
          (msg.content !== undefined || msg.tool_calls);
        
        console.log(`4.${index + 1}. message ${index} 检查: ${msgValid ? '✅' : '❌'}`);
        console.log(`     - role: "${msg.role}" (type: ${typeof msg.role})`);
        console.log(`     - content: ${msg.content !== undefined ? '有内容' : '无内容'} (type: ${typeof msg.content})`);
        console.log(`     - tool_calls: ${msg.tool_calls ? '有' : '无'}`);
      });
    }
    
    // Step 5: tools格式检查
    if (testRequest.tools) {
      console.log(`5. tools检查: 数组长度 ${testRequest.tools.length}`);
      testRequest.tools.forEach((tool, index) => {
        const toolValid = tool &&
          tool.type === 'function' &&
          tool.function &&
          typeof tool.function.name === 'string' &&
          typeof tool.function.description === 'string' &&
          tool.function.parameters &&
          typeof tool.function.parameters === 'object';
        
        console.log(`5.${index + 1}. tool ${index} 检查: ${toolValid ? '✅' : '❌'}`);
        console.log(`     - type: "${tool.type}" (预期: "function")`);
        console.log(`     - function.name: "${tool.function?.name}" (type: ${typeof tool.function?.name})`);
        console.log(`     - function.description: ${tool.function?.description ? '有' : '无'} (type: ${typeof tool.function?.description})`);
        console.log(`     - function.parameters: ${tool.function?.parameters ? '有' : '无'} (type: ${typeof tool.function?.parameters})`);
      });
    }
    
    // 测试 canProcess 方法
    console.log('\n🎯 canProcess 方法测试:');
    try {
      const canProcess = processor.canProcess(testRequest);
      console.log(`canProcess 结果: ${canProcess ? '✅ 通过' : '❌ 失败'}`);
      
      if (!canProcess) {
        console.log('🚨 canProcess失败！这就是为什么请求被拒绝的原因。');
      }
    } catch (canProcessError) {
      console.log(`❌ canProcess 方法抛出异常: ${canProcessError.message}`);
    }
    
    // 测试 validate 方法
    console.log('\n🎯 validate 方法测试:');
    try {
      const isValid = processor.validate(testRequest);
      console.log(`validate 结果: ${isValid ? '✅ 通过' : '❌ 失败'}`);
      
      if (!isValid) {
        console.log('🚨 validate失败！');
      }
    } catch (validateError) {
      console.log(`❌ validate 方法抛出异常: ${validateError.message}`);
    }
    
    // 尝试实际处理
    console.log('\n🎯 实际处理测试:');
    try {
      const processed = await processor.process(testRequest);
      console.log('✅ 处理成功！');
      console.log('处理结果预览:', {
        model: processed.model,
        messageCount: processed.messages.length,
        hasTools: !!processed.tools?.length,
        toolCount: processed.tools?.length || 0,
        originalFormat: processed.metadata?.originalFormat
      });
    } catch (processError) {
      console.log(`❌ 处理失败: ${processError.message}`);
      console.log('错误详情:', processError);
    }
    
  } catch (importError) {
    console.error('❌ 模块导入失败:', importError.message);
    console.log('尝试使用TypeScript编译...');
    
    try {
      // 尝试直接运行编译后的JS文件
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('npm run build');
      console.log('✅ 构建成功，重新尝试...');
      
      // 重新导入编译后的模块
      const processorsModule = require('./dist/input/openai/processor.js');
      const OpenAIInputProcessor = processorsModule.OpenAIInputProcessor;
      
      if (OpenAIInputProcessor) {
        const processor = new OpenAIInputProcessor();
        const canProcess = processor.canProcess(testRequest);
        console.log(`\n重新测试 canProcess: ${canProcess ? '✅ 通过' : '❌ 失败'}`);
        
        if (!canProcess) {
          console.log('\n🔧 修复建议:');
          console.log('1. 检查OpenAI输入处理器的canProcess方法是否过于严格');
          console.log('2. 验证tools格式检查逻辑');
          console.log('3. 确认messages验证逻辑的正确性');
        }
      } else {
        console.log('❌ 无法找到OpenAIInputProcessor类');
      }
      
    } catch (buildError) {
      console.error('❌ 构建失败:', buildError.message);
    }
  }
}

console.log('📤 测试请求详情:');
console.log(JSON.stringify(testRequest, null, 2));

testInputValidation().catch(error => {
  console.error('❌ 测试执行失败:', error);
});