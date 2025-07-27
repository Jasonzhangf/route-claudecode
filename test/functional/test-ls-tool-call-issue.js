#!/usr/bin/env node

/**
 * 测试用例: 复现LS工具调用被当成文本的问题
 * 专门测试LS工具调用的特定案例
 * Author: Jason Zhang
 */

const fs = require('fs');
const axios = require('axios');

// 测试配置
const TEST_CONFIG = {
  name: 'LS工具调用被当成文本的问题',
  port: 3456,
  logFile: '/tmp/test-ls-tool-issue.log',
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
  const requestData = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: messages,
    tools: [
      {
        name: "LS",
        description: "List directory contents",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Directory path to list"
            }
          },
          required: ["path"]
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
  const lsToolCallTexts = []; // 专门记录LS工具调用文本
  
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
      
      // 专门检查LS工具调用文本
      if (textContent && textContent.includes('Tool call:') && textContent.includes('LS')) {
        lsToolCallTexts.push({
          index: index,
          textContent: textContent,
          event: event
        });
        
        issues.push({
          type: 'ls_tool_call_as_text',
          index: index,
          event: event,
          textContent: textContent,
          description: 'LS工具调用被错误识别为文本内容'
        });
      }
      
      // 通用工具调用检查
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
  });
  
  return {
    totalEvents: events.length,
    eventTypes: events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {}),
    toolEvents,
    textEvents,
    lsToolCallTexts,
    issues
  };
}

// 主测试函数
async function runTest() {
  log(`🧪 开始测试: ${TEST_CONFIG.name}`);
  
  try {
    // 测试1: 请求列出目录内容（触发LS工具调用）
    log('\n📋 测试1: 请求列出.claude-code-router目录');
    const lsEvents = await sendTestRequest([
      {
        role: "user", 
        content: "请列出 /Users/fanzhang/.claude-code-router 目录的内容"
      }
    ], (event, index) => {
      // 实时检查每个事件
      if (event.type === 'content_block_delta' && 
          event.delta && 
          event.delta.type === 'text_delta' && 
          event.delta.text && 
          event.delta.text.includes('Tool call:') &&
          event.delta.text.includes('LS')) {
        log(`⚠️  发现LS工具调用被当成文本 (事件 ${index}):`, {
          eventType: event.type,
          textContent: event.delta.text
        });
      }
    });
    
    const analysis1 = analyzeToolCallIssues(lsEvents);
    log('✅ 测试1完成:', analysis1);
    
    // 测试2: 请求列出当前目录（另一个LS工具调用）
    log('\n📋 测试2: 请求列出当前目录');
    const currentDirEvents = await sendTestRequest([
      {
        role: "user", 
        content: "请使用LS工具列出当前工作目录的文件和文件夹"
      }
    ], (event, index) => {
      if (event.type === 'content_block_delta' && 
          event.delta && 
          event.delta.type === 'text_delta' && 
          event.delta.text && 
          event.delta.text.includes('Tool call:') &&
          event.delta.text.includes('LS')) {
        log(`⚠️  发现LS工具调用被当成文本 (事件 ${index}):`, {
          eventType: event.type,
          textContent: event.delta.text
        });
      }
    });
    
    const analysis2 = analyzeToolCallIssues(currentDirEvents);
    log('✅ 测试2完成:', analysis2);
    
    // 汇总测试结果
    const totalIssues = analysis1.issues.length + analysis2.issues.length;
    const totalLsIssues = analysis1.lsToolCallTexts.length + analysis2.lsToolCallTexts.length;
    const summary = {
      testName: TEST_CONFIG.name,
      totalTests: 2,
      totalEvents: analysis1.totalEvents + analysis2.totalEvents,
      totalIssues: totalIssues,
      totalLsIssues: totalLsIssues,
      issuesByTest: {
        lsDirectoryCall: analysis1.issues,
        currentDirCall: analysis2.issues
      },
      lsToolCallTexts: {
        test1: analysis1.lsToolCallTexts,
        test2: analysis2.lsToolCallTexts
      },
      eventTypesSummary: {
        test1: analysis1.eventTypes,
        test2: analysis2.eventTypes
      }
    };
    
    log('\n🎯 测试汇总结果:', summary);
    
    if (totalLsIssues > 0) {
      log(`❌ 发现 ${totalLsIssues} 个LS工具调用被当成文本的问题`);
      log('\n🔍 具体的LS工具调用文本:');
      [...analysis1.lsToolCallTexts, ...analysis2.lsToolCallTexts].forEach((item, idx) => {
        log(`问题 ${idx + 1}:`, item);
      });
      process.exit(1);
    } else if (totalIssues > 0) {
      log(`⚠️  发现 ${totalIssues} 个其他工具调用问题，但没有LS特定问题`);
      process.exit(1);
    } else {
      log('✅ 所有测试通过，未发现LS工具调用被当成文本的问题');
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