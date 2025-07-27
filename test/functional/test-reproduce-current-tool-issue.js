#!/usr/bin/env node

/**
 * 测试用例: 复现当前工具调用被当成文本的问题
 * 基于实际生产日志数据构建测试用例
 * Author: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  name: '复现当前工具调用被当成文本的问题',
  port: 3456,
  logFile: '/tmp/test-current-tool-issue.log',
  timeout: 30000
};

// 日志记录函数
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  
  // 写入日志文件
  const logEntry = data ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n` : `${logMessage}\n`;
  fs.appendFileSync(TEST_CONFIG.logFile, logEntry);
}

// 发送测试请求
async function sendTestRequest(messages, streamHandler) {
  const axios = require('axios');
  
  const requestData = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: messages,
    tools: [
      {
        name: "Read",
        description: "Read file contents",
        input_schema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to file"
            }
          },
          required: ["file_path"]
        }
      },
      {
        name: "Bash",
        description: "Execute bash command",
        input_schema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "Command to execute"
            }
          },
          required: ["command"]
        }
      }
    ]
  };

  try {
    const response = await axios({
      method: 'POST',
      url: `http://127.0.0.1:${TEST_CONFIG.port}/v1/messages?beta=true`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
        'Accept': 'text/event-stream',
        'anthropic-beta': 'claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
      },
      data: requestData,
      responseType: 'stream',
      timeout: TEST_CONFIG.timeout
    });

    return new Promise((resolve, reject) => {
      const events = [];
      let buffer = '';
      
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              events.push(eventData);
              if (streamHandler) {
                streamHandler(eventData, events.length - 1);
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines
            }
          }
        }
      });
      
      response.data.on('end', () => {
        resolve(events);
      });
      
      response.data.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

// 分析事件中的工具调用问题
function analyzeToolCallIssues(events) {
  const issues = [];
  const toolEvents = [];
  const textEvents = [];
  const unknownEvents = [];
  
  events.forEach((event, index) => {
    // 检查是否为工具调用事件
    if (event.type === 'content_block_start' && 
        event.content_block && 
        event.content_block.type === 'tool_use') {
      toolEvents.push({
        event: event.type,
        data: event,
        index: index,
        toolName: event.content_block.name,
        toolId: event.content_block.id,
        toolInput: event.content_block.input
      });
    }
    
    // 检查是否为文本事件
    if (event.type === 'content_block_delta' && 
        event.delta && 
        event.delta.type === 'text_delta') {
      const textContent = event.delta.text;
      textEvents.push({
        event: event.type,
        data: event,
        index: index,
        textContent: textContent
      });
      
      // 检查文本内容是否包含工具调用格式
      if (textContent && textContent.includes('Tool call:')) {
        issues.push({
          type: 'tool_call_as_text',
          index: index,
          event: event,
          textContent: textContent,
          description: '工具调用被错误识别为文本内容'
        });
      }
    }
    
    // 收集未知或异常事件
    if (!['message_start', 'content_block_start', 'content_block_delta', 
          'content_block_stop', 'message_delta', 'message_stop', 'ping'].includes(event.type)) {
      unknownEvents.push({
        event: event.type,
        data: event,
        index: index
      });
    }
  });
  
  return {
    totalEvents: events.length,
    eventTypes: events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {}),
    toolEvents,
    textEvents,
    unknownEvents,
    issues
  };
}

// 主测试函数
async function runTest() {
  log(`🧪 开始测试: ${TEST_CONFIG.name}`);
  
  try {
    // 测试1: 简单工具调用 - 检查是否会被误认为文本
    log('\n📋 测试1: 简单工具调用');
    const simpleToolEvents = await sendTestRequest([
      {
        role: "user", 
        content: "请读取文件 /tmp/test.txt 的内容"
      }
    ], (event, index) => {
      // 实时检查每个事件
      if (event.type === 'content_block_delta' && 
          event.delta && 
          event.delta.type === 'text_delta' && 
          event.delta.text && 
          event.delta.text.includes('Tool call:')) {
        log(`⚠️  发现工具调用被当成文本 (事件 ${index}):`, {
          eventType: event.type,
          textContent: event.delta.text
        });
      }
    });
    
    const analysis1 = analyzeToolCallIssues(simpleToolEvents);
    log('✅ 测试1完成:', analysis1);
    
    // 测试2: 多工具调用 - 检查复杂工具调用场景
    log('\n📋 测试2: 多工具调用');
    const multiToolEvents = await sendTestRequest([
      {
        role: "user", 
        content: "请先读取文件 /tmp/test.txt，然后列出当前目录的文件"
      }
    ], (event, index) => {
      if (event.type === 'content_block_delta' && 
          event.delta && 
          event.delta.type === 'text_delta' && 
          event.delta.text && 
          event.delta.text.includes('Tool call:')) {
        log(`⚠️  发现工具调用被当成文本 (事件 ${index}):`, {
          eventType: event.type,
          textContent: event.delta.text
        });
      }
    });
    
    const analysis2 = analyzeToolCallIssues(multiToolEvents);
    log('✅ 测试2完成:', analysis2);
    
    // 测试3: 命令执行工具调用
    log('\n📋 测试3: 命令执行工具调用');
    const bashToolEvents = await sendTestRequest([
      {
        role: "user", 
        content: "请执行命令 ls -la /tmp 查看临时目录内容"
      }
    ], (event, index) => {
      if (event.type === 'content_block_delta' && 
          event.delta && 
          event.delta.type === 'text_delta' && 
          event.delta.text && 
          event.delta.text.includes('Tool call:')) {
        log(`⚠️  发现工具调用被当成文本 (事件 ${index}):`, {
          eventType: event.type,
          textContent: event.delta.text
        });
      }
    });
    
    const analysis3 = analyzeToolCallIssues(bashToolEvents);
    log('✅ 测试3完成:', analysis3);
    
    // 汇总测试结果
    const totalIssues = analysis1.issues.length + analysis2.issues.length + analysis3.issues.length;
    const summary = {
      testName: TEST_CONFIG.name,
      totalTests: 3,
      totalEvents: analysis1.totalEvents + analysis2.totalEvents + analysis3.totalEvents,
      totalIssues: totalIssues,
      issuesByTest: {
        simpleToolCall: analysis1.issues,
        multiToolCall: analysis2.issues,
        bashToolCall: analysis3.issues
      },
      eventTypesSummary: {
        test1: analysis1.eventTypes,
        test2: analysis2.eventTypes,
        test3: analysis3.eventTypes
      }
    };
    
    log('\n🎯 测试汇总结果:', summary);
    
    if (totalIssues > 0) {
      log(`❌ 发现 ${totalIssues} 个工具调用被当成文本的问题`);
      process.exit(1);
    } else {
      log('✅ 所有测试通过，未发现工具调用被当成文本的问题');
      process.exit(0);
    }
    
  } catch (error) {
    log('❌ 测试失败:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  // 清理之前的日志文件
  if (fs.existsSync(TEST_CONFIG.logFile)) {
    fs.unlinkSync(TEST_CONFIG.logFile);
  }
  
  runTest().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTest, analyzeToolCallIssues };