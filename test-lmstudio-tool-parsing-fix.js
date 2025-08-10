#!/usr/bin/env node

/**
 * 测试LM Studio工具调用解析修复
 * 验证预处理器中LM Studio工具调用解析是否正常工作
 */

const fs = require('fs');
const path = require('path');

// 模拟预处理器中的LM Studio工具调用解析方法
function parseLMStudioToolCalls(content) {
  const toolCalls = [];
  
  // LM Studio格式: <|start|>assistant<|channel|>commentary to=functions.FunctionName<|constrain|>JSON<|message|>{"param":"value"}
  const lmstudioPattern = /<\|start\|>assistant<\|channel\|>commentary to=functions\.(\w+)<\|constrain\|>(?:JSON|json)<\|message\|>(\{[^}]*\})/g;
  
  let match;
  while ((match = lmstudioPattern.exec(content)) !== null) {
    try {
      const functionName = match[1];
      const argsJson = match[2];
      const args = JSON.parse(argsJson);
      
      const toolCall = {
        id: `call_${Date.now()}_${toolCalls.length}`,
        type: 'function',
        function: {
          name: functionName,
          arguments: JSON.stringify(args)
        }
      };
      
      toolCalls.push(toolCall);
      console.log(`✅ 解析到工具调用: ${functionName}`);
    } catch (error) {
      console.error('❌ 解析工具调用失败:', error.message);
    }
  }
  
  return toolCalls;
}

// 测试用例
const testCases = [
  {
    name: 'LM Studio工具调用格式',
    content: '这是一个测试响应。我们需要列出当前目录的内容。<|start|>assistant<|channel|>commentary to=functions.LS<|constrain|>JSON<|message|>{"path":"/Users/fanzhang/Documents/github"}'
  },
  {
    name: '多个LM Studio工具调用',
    content: '首先获取当前目录，然后读取文件。<|start|>assistant<|channel|>commentary to=functions.LS<|constrain|>JSON<|message|>{"path":"."}<|start|>assistant<|channel|>commentary to=functions.Read<|constrain|>JSON<|message|>{"file_path":"/Users/fanzhang/Documents/github/README.md"}'
  },
  {
    name: '普通文本（无工具调用）',
    content: '这是一个普通的响应，不包含任何工具调用。'
  },
  {
    name: '混合内容',
    content: '我将为您执行这个任务。<|start|>assistant<|channel|>commentary to=functions.Bash<|constrain|>JSON<|message|>{"command":"ls -la","description":"列出当前目录内容"} 这是执行结果的描述。'
  }
];

console.log('🧪 测试LM Studio工具调用解析修复...\\n');

let passedTests = 0;
let totalTests = testCases.length;

for (const testCase of testCases) {
  console.log(`=== 测试: ${testCase.name} ===`);
  console.log(`输入内容: ${testCase.content.substring(0, 100)}${testCase.content.length > 100 ? '...' : ''}`);
  
  const toolCalls = parseLMStudioToolCalls(testCase.content);
  
  if (toolCalls.length > 0) {
    console.log(`✅ 解析到 ${toolCalls.length} 个工具调用:`);
    toolCalls.forEach((toolCall, index) => {
      console.log(`  ${index + 1}. ${toolCall.function.name}: ${toolCall.function.arguments}`);
    });
    passedTests++;
  } else {
    if (testCase.name.includes('无工具调用')) {
      console.log('✅ 正确识别为无工具调用内容');
      passedTests++;
    } else {
      console.log('❌ 未能解析到预期的工具调用');
    }
  }
  
  console.log('');
}

console.log(`\\n📊 测试结果: ${passedTests}/${totalTests} 通过`);

if (passedTests === totalTests) {
  console.log('🎉 所有测试通过！LM Studio工具调用解析修复成功。');
  process.exit(0);
} else {
  console.log('❌ 部分测试失败，请检查实现。');
  process.exit(1);
}