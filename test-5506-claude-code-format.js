#!/usr/bin/env node

/**
 * 测试Claude Code实际发送的请求格式
 * 使用Claude Code真实的工具定义格式
 */

const http = require('http');

// Claude Code实际使用的工具定义格式（完整列表）
const claudeCodeRequest = {
  model: 'qwen3-30b',
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: '请列出当前目录的文件' }]
    }
  ],
  max_tokens: 8192,
  tools: [
    {
      name: "Task",
      description: "Launch a new agent to handle complex, multi-step tasks autonomously.",
      input_schema: {
        type: "object",
        properties: {
          description: { type: "string", description: "A short (3-5 word) description of the task" },
          prompt: { type: "string", description: "The task for the agent to perform" },
          subagent_type: { type: "string", description: "The type of specialized agent to use for this task" }
        },
        required: ["description", "prompt", "subagent_type"]
      }
    },
    {
      name: "Bash",
      description: "Executes a given bash command in a persistent shell session with optional timeout.",
      input_schema: {
        type: "object",
        properties: {
          command: { type: "string", description: "The command to execute" },
          description: { type: "string", description: "Clear, concise description of what this command does in 5-10 words." },
          timeout: { type: "number", description: "Optional timeout in milliseconds (max 600000)" }
        },
        required: ["command"]
      }
    },
    {
      name: "Glob",
      description: "Fast file pattern matching tool that works with any codebase size",
      input_schema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "The glob pattern to match files against" },
          path: { type: "string", description: "The directory to search in" }
        },
        required: ["pattern"]
      }
    },
    {
      name: "Grep",
      description: "A powerful search tool built on ripgrep",
      input_schema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "The regular expression pattern to search for in file contents" },
          output_mode: { enum: ["content", "files_with_matches", "count"], type: "string" },
          glob: { type: "string", description: "Glob pattern to filter files" },
          path: { type: "string", description: "File or directory to search in" }
        },
        required: ["pattern"]
      }
    },
    {
      name: "LS",
      description: "Lists files and directories in a given path",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "The absolute path to the directory to list" },
          ignore: { type: "array", items: { type: "string" }, description: "List of glob patterns to ignore" }
        },
        required: ["path"]
      }
    },
    {
      name: "Read",
      description: "Reads a file from the local filesystem",
      input_schema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "The absolute path to the file to read" },
          limit: { type: "number", description: "The number of lines to read" },
          offset: { type: "number", description: "The line number to start reading from" }
        },
        required: ["file_path"]
      }
    },
    {
      name: "Edit",
      description: "Performs exact string replacements in files",
      input_schema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "The absolute path to the file to modify" },
          old_string: { type: "string", description: "The text to replace" },
          new_string: { type: "string", description: "The text to replace it with" },
          replace_all: { type: "boolean", description: "Replace all occurences of old_string" }
        },
        required: ["file_path", "old_string", "new_string"]
      }
    },
    {
      name: "Write",
      description: "Writes a file to the local filesystem",
      input_schema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "The absolute path to the file to write" },
          content: { type: "string", description: "The content to write to the file" }
        },
        required: ["file_path", "content"]
      }
    },
    {
      name: "MultiEdit",
      description: "Making multiple edits to a single file in one operation",
      input_schema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "The absolute path to the file to modify" },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                old_string: { type: "string", description: "The text to replace" },
                new_string: { type: "string", description: "The edited text to replace" },
                replace_all: { type: "boolean", description: "Replace all occurences" }
              },
              required: ["old_string", "new_string"]
            }
          }
        },
        required: ["file_path", "edits"]
      }
    },
    {
      name: "TodoWrite",
      description: "Use this tool to create and manage a structured task list for your current coding session",
      input_schema: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string", minLength: 1 },
                status: { enum: ["pending", "in_progress", "completed"], type: "string" },
                priority: { enum: ["high", "medium", "low"], type: "string" },
                id: { type: "string" }
              },
              required: ["content", "status", "priority", "id"]
            }
          }
        },
        required: ["todos"]
      }
    },
    {
      name: "WebSearch",
      description: "Allows Claude to search the web and use the results to inform responses",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 2, description: "The search query to use" },
          allowed_domains: { type: "array", items: { type: "string" } },
          blocked_domains: { type: "array", items: { type: "string" } }
        },
        required: ["query"]
      }
    },
    {
      name: "WebFetch",
      description: "Fetches content from a specified URL and processes it using an AI model",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri", description: "The URL to fetch content from" },
          prompt: { type: "string", description: "The prompt to run on the fetched content" }
        },
        required: ["url", "prompt"]
      }
    },
    {
      name: "NotebookRead",
      description: "Reads a Jupyter notebook (.ipynb file) and returns all of the cells with their outputs",
      input_schema: {
        type: "object",
        properties: {
          notebook_path: { type: "string", description: "The absolute path to the Jupyter notebook file to read" },
          cell_id: { type: "string", description: "The ID of a specific cell to read" }
        },
        required: ["notebook_path"]
      }
    },
    {
      name: "NotebookEdit",
      description: "Completely replaces the contents of a specific cell in a Jupyter notebook",
      input_schema: {
        type: "object",
        properties: {
          notebook_path: { type: "string", description: "The absolute path to the Jupyter notebook file to edit" },
          new_source: { type: "string", description: "The new source for the cell" },
          cell_id: { type: "string", description: "The ID of the cell to edit" },
          cell_type: { enum: ["code", "markdown"], type: "string" },
          edit_mode: { enum: ["replace", "insert", "delete"], type: "string" }
        },
        required: ["notebook_path", "new_source"]
      }
    },
    {
      name: "ExitPlanMode",
      description: "Use this tool when you are in plan mode and have finished presenting your plan",
      input_schema: {
        type: "object",
        properties: {
          plan: { type: "string", description: "The plan you came up with" }
        },
        required: ["plan"]
      }
    }
  ]
};

console.log('🔍 测试Claude Code完整工具列表格式...');
console.log('=' + '='.repeat(70));

async function testClaudeCodeFormat() {
  console.log(`\n📤 发送包含${claudeCodeRequest.tools.length}个工具的请求...`);
  console.log('工具列表:');
  claudeCodeRequest.tools.forEach((tool, i) => {
    console.log(`${i + 1}. ${tool.name}`);
  });
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(claudeCodeRequest);
    
    const req = http.request({
      hostname: 'localhost',
      port: 5506,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer test-key'
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n📊 响应状态: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200 && response.error) {
            console.log('\n🚨 错误响应 - 这就是真实的问题!');
            console.log('错误类型:', response.error.type);
            
            if (response.error.message && response.error.message.includes('Invalid discriminator value')) {
              console.log('\n🎯 发现问题: 多个工具定义缺少type字段!');
              
              // 计算受影响的工具数量
              const errorMsg = response.error.message;
              const toolErrors = errorMsg.match(/tools",\s*(\d+),/g) || [];
              const affectedTools = new Set();
              
              toolErrors.forEach(match => {
                const toolIndex = parseInt(match.match(/(\d+)/)[1]);
                affectedTools.add(toolIndex);
              });
              
              console.log(`受影响的工具索引: ${Array.from(affectedTools).sort((a,b) => a-b).join(', ')}`);
              console.log(`总共${affectedTools.size}个工具缺少type字段 (共${claudeCodeRequest.tools.length}个工具)`);
              
              if (affectedTools.size === claudeCodeRequest.tools.length) {
                console.log('\n🚨 所有工具都缺少type字段 - 说明Transformer完全没有应用!');
                console.log('🔧 Root Cause: server.ts中的applyRequestTransformation没有正确调用');
                console.log('🔧 可能原因:');
                console.log('1. Provider类型判断错误 (lmstudio不匹配openai)');
                console.log('2. getProviderType方法返回值不正确');
                console.log('3. Transformer调用条件不满足');
              } else {
                console.log('\n🤔 部分工具缺少type字段 - Transformer部分应用?');
              }
              
              resolve({
                issue: 'missing_type_field',
                affectedToolCount: affectedTools.size,
                totalToolCount: claudeCodeRequest.tools.length,
                affectedIndices: Array.from(affectedTools),
                errorDetails: response.error
              });
            } else {
              console.log('其他错误:', response.error.message);
              resolve({ otherError: response.error });
            }
          } else {
            console.log('✅ 请求成功处理 - 所有工具定义格式正确');
            resolve({ success: true, response });
          }
        } catch (err) {
          console.log('❌ 响应解析失败:', err.message);
          resolve({ parseError: err.message, rawData: data });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ 请求错误:', err.message);
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log('❌ 请求超时');
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const result = await testClaudeCodeFormat();
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 Claude Code格式测试结果:');
    
    if (result.issue === 'missing_type_field') {
      console.log(`🚨 确认问题: ${result.affectedToolCount}/${result.totalToolCount} 个工具缺少type字段`);
      
      if (result.affectedToolCount === result.totalToolCount) {
        console.log('\n🎯 根本原因: Transformer层完全没有应用');
        console.log('🔧 需要修复的地方:');
        console.log('1. server.ts -> applyRequestTransformation方法');
        console.log('2. getProviderType方法 - 确保lmstudio返回"openai"');
        console.log('3. provider匹配逻辑');
        
        console.log('\n📝 下一步行动:');
        console.log('1. 检查server.ts中Provider类型判断逻辑');
        console.log('2. 确认lmstudio provider被正确识别为openai类型');
        console.log('3. 验证Transformer调用的条件匹配');
      }
    } else if (result.success) {
      console.log('✅ 所有工具定义格式正确 - 问题已解决!');
    } else {
      console.log('❌ 其他类型错误:', result.otherError || result.parseError);
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error.message);
  }
}

main();