#!/usr/bin/env node

const axios = require('axios');

console.log('🧪 测试Claude Code完整工具集在Gemini中的工具名称格式问题');
console.log('=' .repeat(80));

// 模拟Claude Code的完整工具集 - 这是导致15个工具格式错误的真实场景
const fullClaudeCodeToolset = [
  { name: 'Task', description: 'Launch specialized agents for complex tasks' },
  { name: 'Bash', description: 'Execute bash commands' },
  { name: 'Glob', description: 'Find files by pattern matching' },
  { name: 'Grep', description: 'Search text in files using regex' },
  { name: 'LS', description: 'List files and directories' },
  { name: 'Read', description: 'Read file contents' },
  { name: 'Edit', description: 'Edit files with find and replace' },
  { name: 'MultiEdit', description: 'Perform multiple edits on a file' },
  { name: 'Write', description: 'Write content to files' },
  { name: 'NotebookRead', description: 'Read Jupyter notebook files' },
  { name: 'NotebookEdit', description: 'Edit Jupyter notebook files' },
  { name: 'WebFetch', description: 'Fetch and analyze web content' },
  { name: 'TodoWrite', description: 'Create and manage structured task lists' },
  { name: 'WebSearch', description: 'Search the web for information' },
  { name: 'ExitPlanMode', description: 'Exit planning mode' }
];

// 测试Gemini工具名称格式验证
async function testGeminiToolNameCompatibility() {
  console.log('📋 Claude Code完整工具集 (15个工具):');
  fullClaudeCodeToolset.forEach((tool, index) => {
    console.log(`  [${index}] ${tool.name} - ${tool.description}`);
  });

  // Gemini API工具名称规范检查
  const geminiToolNameRegex = /^[a-zA-Z_][a-zA-Z0-9_.\\-]*$/;
  const geminiStartRegex = /^[a-zA-Z_]/;
  const maxLength = 64;

  console.log('\n🔍 Gemini API工具名称格式验证:');
  
  const invalidTools = [];
  const validTools = [];

  fullClaudeCodeToolset.forEach((tool, index) => {
    const startsValid = geminiStartRegex.test(tool.name);
    const charsValid = geminiToolNameRegex.test(tool.name);
    const lengthValid = tool.name.length <= maxLength;
    const isValid = startsValid && charsValid && lengthValid;
    
    if (isValid) {
      validTools.push({ index, name: tool.name });
      console.log(`  ✅ [${index}] ${tool.name} - 格式正确`);
    } else {
      invalidTools.push({ 
        index, 
        name: tool.name, 
        issues: {
          start: !startsValid,
          chars: !charsValid, 
          length: !lengthValid
        }
      });
      console.log(`  ❌ [${index}] ${tool.name} - 格式错误`);
      if (!startsValid) console.log(`      - 开头错误：必须以字母或下划线开头`);
      if (!charsValid) console.log(`      - 字符错误：包含非法字符`);
      if (!lengthValid) console.log(`      - 长度错误：超过64字符限制 (${tool.name.length})`);
    }
  });

  console.log(`\n📊 验证结果统计:`);
  console.log(`  ✅ 有效工具: ${validTools.length}个`);
  console.log(`  ❌ 无效工具: ${invalidTools.length}个`);
  
  if (invalidTools.length === 0) {
    console.log('🎉 所有Claude Code工具名称都符合Gemini API规范！');
    return { allValid: true, invalidTools: [] };
  } else {
    console.log('⚠️ 发现工具名称格式问题，需要修复！');
    return { allValid: false, invalidTools, validTools };
  }
}

// 创建完整工具定义进行实际API测试
async function testFullToolsetWithGemini() {
  console.log('\n🧪 测试完整工具集与ShuaiHong Gemini API:');
  
  const tools = fullClaudeCodeToolset.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Tool input parameter' }
        },
        required: ['input']
      }
    }
  }));

  const testRequest = {
    model: 'gemini-2.5-flash-lite',
    messages: [
      {
        role: 'user',
        content: [{ 
          type: 'text', 
          text: 'Please help me check the recent logs for any errors'
        }]
      }
    ],
    max_tokens: 500,
    tools: tools
  };

  console.log(`📤 发送包含${tools.length}个工具的请求到5508端口 (ShuaiHong Gemini)...`);
  
  try {
    const response = await axios.post('http://localhost:5508/v1/messages', testRequest, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    console.log('✅ 请求成功! 所有工具名称被Gemini API接受');
    console.log(`📊 状态码: ${response.status}`);
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    
    return { success: true, response: response.data };
  } catch (error) {
    if (error.response) {
      const errorMsg = error.response.data.error?.message || '';
      
      if (errorMsg.includes('Invalid function name')) {
        console.log('❌ 确认Gemini工具名称格式错误！');
        
        // 提取具体错误的工具索引
        const toolErrorRegex = /tools\[0\]\.function_declarations\[(\d+)\]\.name/g;
        const matches = [...errorMsg.matchAll(toolErrorRegex)];
        const errorIndexes = matches.map(m => parseInt(m[1]));
        
        console.log(`💥 错误的工具索引: ${errorIndexes.join(', ')}`);
        
        errorIndexes.forEach(index => {
          if (fullClaudeCodeToolset[index]) {
            console.log(`  - [${index}] ${fullClaudeCodeToolset[index].name}`);
          }
        });
        
        return { 
          success: false, 
          toolNameError: true, 
          errorIndexes,
          errorMessage: errorMsg 
        };
      } else {
        console.log('❌ 其他API错误:', error.response.status, errorMsg);
        return { success: false, otherError: true, errorMessage: errorMsg };
      }
    } else {
      console.log('❌ 网络错误:', error.message);
      return { success: false, networkError: true, error: error.message };
    }
  }
}

// 主测试函数
async function runCompleteTest() {
  console.log('🔧 Phase 1: 静态工具名称格式验证');
  const staticValidation = await testGeminiToolNameCompatibility();
  
  console.log('\n🌐 Phase 2: 实际API测试验证');
  const apiTest = await testFullToolsetWithGemini();
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 完整测试总结:');
  
  if (staticValidation.allValid && apiTest.success) {
    console.log('🎉 完美！工具名称格式正确且API调用成功');
  } else if (!staticValidation.allValid) {
    console.log('❌ 静态验证失败: Claude Code工具名称不符合Gemini规范');
    console.log('💡 需要实现工具名称转换逻辑');
  } else if (apiTest.toolNameError) {
    console.log('❌ API验证失败: Gemini拒绝了特定工具名称');
    console.log('💡 需要在预处理器中添加工具名称修复');
  } else {
    console.log('⚠️ 其他错误，需要进一步调查');
  }
  
  return { staticValidation, apiTest };
}

// 执行测试
runCompleteTest().catch(error => {
  console.error('💥 测试脚本异常:', error);
});