#!/usr/bin/env node

const axios = require('axios');

console.log('🚨 测试完整15个Claude Code工具 - 复现Gemini工具名称错误');
console.log('=' .repeat(70));

// 完整的Claude Code工具集 - 这是导致15个工具错误的真实场景
const fullClaudeCodeTools = [
  {
    name: 'Task',
    description: 'Launch specialized agents for complex tasks',
    input_schema: {
      type: 'object',
      properties: { description: { type: 'string' }, prompt: { type: 'string' } },
      required: ['description', 'prompt']
    }
  },
  {
    name: 'Bash',
    description: 'Execute bash commands',
    input_schema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command']
    }
  },
  {
    name: 'Glob',
    description: 'Find files by pattern matching',
    input_schema: {
      type: 'object',
      properties: { pattern: { type: 'string' } },
      required: ['pattern']
    }
  },
  {
    name: 'Grep',
    description: 'Search text in files using regex',
    input_schema: {
      type: 'object',
      properties: { pattern: { type: 'string' } },
      required: ['pattern']
    }
  },
  {
    name: 'LS',
    description: 'List files and directories',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path']
    }
  },
  {
    name: 'Read',
    description: 'Read file contents',
    input_schema: {
      type: 'object',
      properties: { file_path: { type: 'string' } },
      required: ['file_path']
    }
  },
  {
    name: 'Edit',
    description: 'Edit files with find and replace',
    input_schema: {
      type: 'object',
      properties: { file_path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } },
      required: ['file_path', 'old_string', 'new_string']
    }
  },
  {
    name: 'MultiEdit',
    description: 'Perform multiple edits on a file',
    input_schema: {
      type: 'object',
      properties: { file_path: { type: 'string' } },
      required: ['file_path']
    }
  },
  {
    name: 'Write',
    description: 'Write content to files',
    input_schema: {
      type: 'object',
      properties: { file_path: { type: 'string' }, content: { type: 'string' } },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'NotebookRead',
    description: 'Read Jupyter notebook files',
    input_schema: {
      type: 'object',
      properties: { notebook_path: { type: 'string' } },
      required: ['notebook_path']
    }
  },
  {
    name: 'NotebookEdit',
    description: 'Edit Jupyter notebook files',
    input_schema: {
      type: 'object',
      properties: { notebook_path: { type: 'string' } },
      required: ['notebook_path']
    }
  },
  {
    name: 'WebFetch',
    description: 'Fetch and analyze web content',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url']
    }
  },
  {
    name: 'TodoWrite',
    description: 'Create and manage structured task lists',
    input_schema: {
      type: 'object',
      properties: { todos: { type: 'array' } },
      required: ['todos']
    }
  },
  {
    name: 'WebSearch',
    description: 'Search the web for information',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    }
  },
  {
    name: 'ExitPlanMode',
    description: 'Exit planning mode',
    input_schema: {
      type: 'object',
      properties: { plan: { type: 'string' } },
      required: ['plan']
    }
  }
];

async function testFull15ToolsError() {
  const request = {
    model: 'gemini-2.5-flash-lite',
    messages: [{
      role: 'user',
      content: 'Please help me with file operations and web research'
    }],
    max_tokens: 500,
    tools: fullClaudeCodeTools
  };

  console.log('📤 发送完整15个工具请求到3456端口...');
  console.log('🎯 模型: gemini-2.5-flash-lite');
  console.log('🔧 工具数量: 15个 (完整Claude Code工具集)');
  console.log('💡 这是导致 "tools[0].function_declarations[0-14].name" 错误的场景');
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000 // 增加超时时间
    });
    
    console.log('✅ 请求成功！');
    console.log(`📊 状态: ${response.status}`);
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    
    return { success: true, status: response.status };
    
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      const errorMsg = errorData.error?.message || '';
      
      console.log('❌ 请求失败！');
      console.log(`📊 状态码: ${status}`);
      
      if (errorMsg.includes('Invalid function name')) {
        console.log('🎯 成功复现！这就是用户反馈的15个工具名称格式错误！');
        
        // 统计错误的工具数量
        const functionNameErrors = (errorMsg.match(/function_declarations\[\d+\]\.name/g) || []).length;
        console.log(`📈 检测到 ${functionNameErrors} 个工具名称格式错误`);
        
        // 提取错误的具体索引
        const indexMatches = [...errorMsg.matchAll(/function_declarations\[(\d+)\]\.name/g)];
        const errorIndexes = indexMatches.map(m => parseInt(m[1]));
        
        if (errorIndexes.length > 0) {
          console.log('🔍 错误的工具索引:', errorIndexes.slice(0, 10).join(', ') + (errorIndexes.length > 10 ? '...' : ''));
          console.log('📋 对应工具名称:');
          errorIndexes.slice(0, 5).forEach(index => {
            if (fullClaudeCodeTools[index]) {
              console.log(`  [${index}] ${fullClaudeCodeTools[index].name}`);
            }
          });
        }
        
        console.log('\n💡 问题确认: OpenAI兼容流程在转换15个Anthropic工具时发生格式错误');
        
        return { 
          success: false, 
          confirmed: true, 
          toolNameError: true,
          errorCount: functionNameErrors,
          errorIndexes: errorIndexes,
          error: errorMsg.substring(0, 800) 
        };
      } else {
        console.log('⚠️ 其他错误类型');
        console.log('💬 错误信息:', errorMsg.substring(0, 300));
        return { success: false, otherError: true, error: errorMsg };
      }
    } else {
      console.log('❌ 网络错误:', error.message);
      return { success: false, networkError: true, error: error.message };
    }
  }
}

testFull15ToolsError().then(result => {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 最终结果:');
  
  if (result.success) {
    console.log('❓ 未复现15个工具错误');
    console.log('💡 可能原因: 路由到了非Gemini模型或问题已修复');
  } else if (result.confirmed && result.toolNameError) {
    console.log('✅ 确认复现！发现OpenAI流程中15个工具名称格式错误');
    console.log(`📊 错误工具数量: ${result.errorCount}`);
    console.log(`🔍 错误索引数量: ${result.errorIndexes?.length || 0}`);
    console.log('\n🚨 问题定位成功：');
    console.log('  1. shuaihong-openai provider处理gemini-2.5-flash-lite模型');
    console.log('  2. OpenAI兼容流程转换15个Anthropic工具格式时出错');
    console.log('  3. 需要修复OpenAI transformer的工具格式转换逻辑');
  } else {
    console.log('⚠️ 其他情况，需要进一步分析');
  }
  
}).catch(error => {
  console.error('💥 测试异常:', error.message);
});