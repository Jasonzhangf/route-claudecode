#!/usr/bin/env node

/**
 * 测试demo2如何处理包含大量工具定义的请求
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

async function testDemo2LargeRequest() {
  console.log('🔍 测试demo2处理大量工具定义的请求\n');

  // 构建包含大量工具的请求（模拟Claude Code的完整工具集）
  const largeRequest = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: "我们根据文档，单独实现lmstudio格式的集成吧https://lmstudio.ai/docs/typescript"
      }
    ],
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
          required: ["description", "prompt", "subagent_type"],
          additionalProperties: false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      {
        name: "Bash",
        description: "Executes a given bash command in a persistent shell session with optional timeout.",
        input_schema: {
          type: "object",
          properties: {
            command: { type: "string", description: "The command to execute" },
            timeout: { type: "number", description: "Optional timeout in milliseconds (max 600000)" },
            description: { type: "string", description: "Clear, concise description of what this command does in 5-10 words." }
          },
          required: ["command"],
          additionalProperties: false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      {
        name: "Glob",
        description: "Fast file pattern matching tool that works with any codebase size",
        input_schema: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "The glob pattern to match files against" },
            path: { type: "string", description: "The directory to search in." }
          },
          required: ["pattern"],
          additionalProperties: false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      {
        name: "Grep",
        description: "A powerful search tool built on ripgrep",
        input_schema: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "The regular expression pattern to search for in file contents" },
            path: { type: "string", description: "File or directory to search in" },
            glob: { type: "string", description: "Glob pattern to filter files" },
            output_mode: { type: "string", enum: ["content", "files_with_matches", "count"] }
          },
          required: ["pattern"],
          additionalProperties: false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      {
        name: "Read",
        description: "Reads a file from the local filesystem.",
        input_schema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "The absolute path to the file to read" },
            offset: { type: "number", description: "The line number to start reading from" },
            limit: { type: "number", description: "The number of lines to read" }
          },
          required: ["file_path"],
          additionalProperties: false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      {
        name: "Edit",
        description: "Performs exact string replacements in files.",
        input_schema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "The absolute path to the file to modify" },
            old_string: { type: "string", description: "The text to replace" },
            new_string: { type: "string", description: "The text to replace it with" },
            replace_all: { type: "boolean", default: false, description: "Replace all occurences of old_string" }
          },
          required: ["file_path", "old_string", "new_string"],
          additionalProperties: false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      {
        name: "Write",
        description: "Writes a file to the local filesystem.",
        input_schema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "The absolute path to the file to write" },
            content: { type: "string", description: "The content to write to the file" }
          },
          required: ["file_path", "content"],
          additionalProperties: false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      {
        name: "TodoWrite",
        description: "Create and manage a structured task list for your current coding session.",
        input_schema: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string", minLength: 1 },
                  status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  id: { type: "string" }
                },
                required: ["content", "status", "priority", "id"],
                additionalProperties: false
              },
              description: "The updated todo list"
            }
          },
          required: ["todos"],
          additionalProperties: false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      }
    ]
  };

  const requestSize = JSON.stringify(largeRequest).length;
  console.log(`📏 请求大小: ${requestSize} 字符 (~${Math.round(requestSize/1024)}KB)`);
  console.log(`🛠️  工具数量: ${largeRequest.tools.length}`);

  // 测试我们的router
  console.log('\n📤 测试我们的router:');
  try {
    const ourStartTime = Date.now();
    
    const ourResponse = await axios.post(
      'http://127.0.0.1:3456/v1/messages',
      largeRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      }
    );

    const ourDuration = Date.now() - ourStartTime;
    console.log(`✅ 我们的router成功 (${ourDuration}ms)`);
    console.log(`   响应内容块: ${ourResponse.data.content.length}`);
    
  } catch (ourError) {
    console.log(`❌ 我们的router失败: ${ourError.message}`);
    console.log(`   状态码: ${ourError.response?.status}`);
    if (ourError.response?.data) {
      console.log(`   错误信息: ${JSON.stringify(ourError.response.data, null, 2)}`);
    }
  }

  // 测试demo2
  console.log('\n📤 测试demo2:');
  try {
    const demo2StartTime = Date.now();
    
    const demo2Response = await axios.post(
      'http://127.0.0.1:8080/v1/messages',
      largeRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      }
    );

    const demo2Duration = Date.now() - demo2StartTime;
    console.log(`✅ Demo2成功 (${demo2Duration}ms)`);
    console.log(`   响应内容块: ${demo2Response.data.content.length}`);
    
    demo2Response.data.content.forEach((block, i) => {
      const preview = block.type === 'text' ? 
        `"${block.text?.substring(0, 50)}..."` :
        block.type === 'tool_use' ? 
        `${block.name}(${Object.keys(block.input).join(', ')})` : 
        'unknown';
      console.log(`   [${i}] ${block.type}: ${preview}`);
    });

    // 保存demo2的成功响应用于分析
    fs.writeFileSync('/tmp/demo2-large-request-success.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      requestSize: requestSize,
      toolCount: largeRequest.tools.length,
      response: demo2Response.data,
      duration: demo2Duration
    }, null, 2));
    console.log(`   📁 Demo2结果保存到: /tmp/demo2-large-request-success.json`);
    
  } catch (demo2Error) {
    console.log(`❌ Demo2失败: ${demo2Error.message}`);
    console.log(`   状态码: ${demo2Error.response?.status}`);
    if (demo2Error.response?.data) {
      console.log(`   错误信息: ${JSON.stringify(demo2Error.response.data, null, 2)}`);
    }
    
    // 保存demo2的失败响应用于分析
    fs.writeFileSync('/tmp/demo2-large-request-error.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      requestSize: requestSize,
      toolCount: largeRequest.tools.length,
      error: demo2Error.message,
      status: demo2Error.response?.status,
      data: demo2Error.response?.data
    }, null, 2));
    console.log(`   📁 Demo2错误保存到: /tmp/demo2-large-request-error.json`);
  }

  console.log('\n🔍 分析结论:');
  console.log('1. 如果demo2成功处理大请求，说明问题在我们的实现');
  console.log('2. 如果demo2也失败，说明CodeWhisperer确实不支持大工具集');
  console.log('3. 关键是要看demo2如何处理工具定义');
}

// 运行测试
testDemo2LargeRequest().catch(console.error);