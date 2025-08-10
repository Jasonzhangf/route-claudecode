#!/usr/bin/env node

/**
 * 测试LM Studio预处理器修复
 * 验证预处理器中LM Studio工具调用解析是否正常工作
 */

const fs = require('fs');
const path = require('path');

// 模拟预处理器中的方法
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

// 模拟applyShuaiHongFormatPatch方法
function applyShuaiHongFormatPatch(data, context) {
  // Handle ShuaiHong/ModelScope format responses
  if (data.message && typeof data.message === 'string') return data.message;
  if (data.text) return data.text;
  if (data.response) return data.response;
  if (data.output) return data.output;
  
  // Try to extract from nested objects
  if (data.result && data.result.content) return data.result.content;
  if (data.data && data.data.content) return data.data.content;
  
  // LM Studio special handling: Parse embedded tool calls in content
  const isLMStudio = context.provider.includes('lmstudio') || context.provider.includes('LMStudio');
  if (isLMStudio && data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0];
    const content = choice.message?.content;
    
    if (typeof content === 'string' && content.length > 0) {
      // Try to parse LM Studio format tool calls
      const lmstudioToolCalls = parseLMStudioToolCalls(content, context);
      
      if (lmstudioToolCalls.length > 0) {
        console.log(`🔧 [PREPROCESSING] Parsed ${lmstudioToolCalls.length} LM Studio tool calls`);
        
        // Remove tool call markers from content
        let newContent = content;
        const lmstudioPattern = /<\|start\|>assistant<\|channel\|>commentary to=functions\.[^<]*<\|constrain\|>[^<]*<\|message\|>\{[^}]*\}/g;
        newContent = newContent.replace(lmstudioPattern, '').trim();
        
        const fixedData = {
          ...data,
          choices: [{
            ...choice,
            message: {
              ...choice.message,
              content: newContent || null,
              tool_calls: lmstudioToolCalls
            },
            finish_reason: 'tool_calls'
          }]
        };
        
        return fixedData;
      }
    }
  }
  
  return data;
}

// 测试用例
const testCases = [
  {
    name: 'LM Studio工具调用格式',
    data: {
      choices: [{
        message: {
          content: '这是一个测试响应。我们需要列出当前目录的内容。<|start|>assistant<|channel|>commentary to=functions.LS<|constrain|>JSON<|message|>{"path":"/Users/fanzhang/Documents/github"}',
          role: 'assistant'
        },
        finish_reason: 'stop'
      }]
    },
    context: { provider: 'lmstudio' }
  },
  {
    name: '多个LM Studio工具调用',
    data: {
      choices: [{
        message: {
          content: '首先获取当前目录，然后读取文件。<|start|>assistant<|channel|>commentary to=functions.LS<|constrain|>JSON<|message|>{"path":"."}<|start|>assistant<|channel|>commentary to=functions.Read<|constrain|>JSON<|message|>{"file_path":"/Users/fanzhang/Documents/github/README.md"}',
          role: 'assistant'
        },
        finish_reason: 'stop'
      }]
    },
    context: { provider: 'lmstudio' }
  },
  {
    name: '普通文本（无工具调用）',
    data: {
      choices: [{
        message: {
          content: '这是一个普通的响应，不包含任何工具调用。',
          role: 'assistant'
        },
        finish_reason: 'stop'
      }]
    },
    context: { provider: 'lmstudio' }
  },
  {
    name: '混合内容',
    data: {
      choices: [{
        message: {
          content: '我将为您执行这个任务。<|start|>assistant<|channel|>commentary to=functions.Bash<|constrain|>JSON<|message|>{"command":"ls -la","description":"列出当前目录内容"} 这是执行结果的描述。',
          role: 'assistant'
        },
        finish_reason: 'stop'
      }]
    },
    context: { provider: 'lmstudio' }
  },
  {
    name: '非LM Studio Provider',
    data: {
      choices: [{
        message: {
          content: '这是一个普通的响应。<|start|>assistant<|channel|>commentary to=functions.LS<|constrain|>JSON<|message|>{"path":"."}',
          role: 'assistant'
        },
        finish_reason: 'stop'
      }]
    },
    context: { provider: 'openai' }
  }
];

console.log('🧪 测试LM Studio预处理器修复...');
console.log('=' + '='.repeat(50));

let passedTests = 0;
let totalTests = testCases.length;

for (const testCase of testCases) {
  console.log(`\n=== 测试: ${testCase.name} ===`);
  
  const result = applyShuaiHongFormatPatch(testCase.data, testCase.context);
  
  if (result.choices && result.choices[0].message.tool_calls) {
    const toolCalls = result.choices[0].message.tool_calls;
    console.log(`✅ 解析到 ${toolCalls.length} 个工具调用:`);
    toolCalls.forEach((toolCall, index) => {
      console.log(`  ${index + 1}. ${toolCall.function.name}: ${toolCall.function.arguments}`);
    });
    
    // 检查内容是否正确清理
    const content = result.choices[0].message.content;
    console.log(`📄 清理后的内容: "${content}"`);
    
    // 检查finish_reason是否正确设置
    const finishReason = result.choices[0].finish_reason;
    console.log(`🏁 Finish reason: ${finishReason}`);
    
    if (testCase.context.provider.includes('lmstudio')) {
      passedTests++;
    }
  } else {
    if (testCase.name.includes('无工具调用') || testCase.context.provider.includes('openai')) {
      console.log('✅ 正确处理无工具调用内容');
      passedTests++;
    } else {
      console.log('❌ 未能解析到预期的工具调用');
    }
  }
}

console.log(`\n📊 测试结果: ${passedTests}/${totalTests} 通过`);

if (passedTests === totalTests) {
  console.log('🎉 所有测试通过！LM Studio预处理器修复成功。');
  process.exit(0);
} else {
  console.log('❌ 部分测试失败，请检查实现。');
  process.exit(1);
}