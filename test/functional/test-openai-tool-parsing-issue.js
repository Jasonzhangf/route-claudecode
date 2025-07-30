#!/usr/bin/env node

/**
 * 测试OpenAI provider的工具解析问题
 * 重现用户报告的："⏺ Tool call: Bash(...)" 被合并为文本块的问题
 */

const axios = require('axios');
const fs = require('fs');

const TEST_CONFIG = {
  // 使用8888端口的OpenAI供应商 (shuaihong-openai)
  ROUTER_URL: 'http://localhost:8888/v1/messages',
  OUTPUT_DIR: '/tmp',
  LOG_FILE: '/tmp/test-openai-tool-parsing.log'
};

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(TEST_CONFIG.LOG_FILE, logMessage + '\n');
}

/**
 * 创建可能触发多个工具调用的测试请求
 */
function createToolTestRequest() {
  return {
    model: "gemini-2.5-flash", // 使用会路由到OpenAI的模型
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: "Please help me with a few tasks: 1) Check the git status, 2) List the files in the current directory, 3) Check if there's a package.json file. Can you do these for me?"
      }
    ],
    tools: [
      {
        name: "Bash",
        description: "Execute bash commands",
        input_schema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The bash command to execute"
            }
          },
          required: ["command"]
        }
      }
    ],
    stream: true
  };
}

/**
 * 测试OpenAI供应商的工具解析
 */
async function testOpenAIToolParsing() {
  log('🧪 Starting OpenAI tool parsing test...');
  
  try {
    const request = createToolTestRequest();
    log(`📤 Sending request to ${TEST_CONFIG.ROUTER_URL}`);
    log(`📝 Request model: ${request.model}`);
    log(`🔧 Tools available: ${request.tools.map(t => t.name).join(', ')}`);
    
    const response = await axios.post(TEST_CONFIG.ROUTER_URL, request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      responseType: 'stream',
      timeout: 60000
    });
    
    log(`📥 Response status: ${response.status}`);
    
    // 收集所有事件
    const events = [];
    let buffer = '';
    let toolCallCounter = 0;
    let textBlockCounter = 0;
    
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        
        // 解析SSE事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.substring(7);
            events.push({ event: eventType, data: null, timestamp: Date.now() });
          } else if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            try {
              const data = JSON.parse(dataStr);
              if (events.length > 0) {
                events[events.length - 1].data = data;
                
                // 分析事件类型
                const event = events[events.length - 1];
                if (event.event === 'content_block_start') {
                  if (event.data.content_block?.type === 'tool_use') {
                    toolCallCounter++;
                    log(`🔧 Tool call detected: ${event.data.content_block.name} (${toolCallCounter})`);
                  } else if (event.data.content_block?.type === 'text') {
                    textBlockCounter++;
                    log(`📝 Text block detected (${textBlockCounter})`);
                  }
                } else if (event.event === 'content_block_delta') {
                  if (event.data.delta?.type === 'text_delta') {
                    const text = event.data.delta.text;
                    // 检查是否包含工具调用文本模式
                    if (text.includes('⏺ Tool call:') || text.includes('Tool call:')) {
                      log(`❌ PROBLEM DETECTED: Tool call found in text delta: ${text.slice(0, 100)}...`);
                    }
                  }
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });
      
      response.data.on('end', () => {
        log(`✅ Stream completed`);
        
        // 分析结果
        const analysis = analyzeToolParsingResults(events, toolCallCounter, textBlockCounter);
        
        // 保存详细结果
        const resultFile = `${TEST_CONFIG.OUTPUT_DIR}/openai-tool-parsing-test-${Date.now()}.json`;
        const testResult = {
          timestamp: new Date().toISOString(),
          request: request,
          totalEvents: events.length,
          toolCallsDetected: toolCallCounter,
          textBlocksDetected: textBlockCounter,
          analysis: analysis,
          events: events
        };
        
        fs.writeFileSync(resultFile, JSON.stringify(testResult, null, 2));
        log(`💾 Test results saved to: ${resultFile}`);
        
        // 显示分析结果
        displayAnalysis(analysis);
        
        resolve(testResult);
      });
      
      response.data.on('error', (error) => {
        log(`❌ Stream error: ${error.message}`);
        reject(error);
      });
    });
    
  } catch (error) {
    log(`❌ Test failed: ${error.message}`);
    if (error.response) {
      log(`   Status: ${error.response.status}`);
      log(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * 分析工具解析结果
 */
function analyzeToolParsingResults(events, toolCallCounter, textBlockCounter) {
  const analysis = {
    totalEvents: events.length,
    toolCallsDetected: toolCallCounter,
    textBlocksDetected: textBlockCounter,
    issues: [],
    summary: ''
  };
  
  // 检查是否有工具调用文本出现在text_delta中
  let toolCallTextInTextDelta = 0;
  let toolCallPatterns = [];
  
  events.forEach((event, index) => {
    if (event.event === 'content_block_delta' && 
        event.data?.delta?.type === 'text_delta') {
      const text = event.data.delta.text || '';
      
      if (text.includes('⏺ Tool call:') || text.includes('Tool call:')) {
        toolCallTextInTextDelta++;
        toolCallPatterns.push({
          eventIndex: index,
          text: text.slice(0, 200),
          timestamp: event.timestamp
        });
      }
    }
  });
  
  analysis.toolCallTextInTextDelta = toolCallTextInTextDelta;
  analysis.toolCallPatterns = toolCallPatterns;
  
  // 生成问题报告
  if (toolCallTextInTextDelta > 0) {
    analysis.issues.push(`发现 ${toolCallTextInTextDelta} 个工具调用被错误地包含在文本块中`);
  }
  
  if (toolCallCounter === 0 && toolCallTextInTextDelta > 0) {
    analysis.issues.push('没有检测到正确的tool_use事件，但在文本中发现工具调用');
  }
  
  // 生成总结
  if (analysis.issues.length > 0) {
    analysis.summary = `❌ 检测到 ${analysis.issues.length} 个工具解析问题`;
  } else {
    analysis.summary = '✅ 工具解析正常';
  }
  
  return analysis;
}

/**
 * 显示分析结果
 */
function displayAnalysis(analysis) {
  log('\n📊 分析结果:');
  log(`   总事件数: ${analysis.totalEvents}`);
  log(`   检测到的工具调用: ${analysis.toolCallsDetected}`);
  log(`   检测到的文本块: ${analysis.textBlocksDetected}`);
  log(`   文本中的工具调用: ${analysis.toolCallTextInTextDelta}`);
  
  if (analysis.issues.length > 0) {
    log('\n⚠️  发现的问题:');
    analysis.issues.forEach((issue, index) => {
      log(`   ${index + 1}. ${issue}`);
    });
  }
  
  if (analysis.toolCallPatterns.length > 0) {
    log('\n🔍 工具调用文本模式:');
    analysis.toolCallPatterns.forEach((pattern, index) => {
      log(`   ${index + 1}. ${pattern.text}`);
    });
  }
  
  log(`\n${analysis.summary}`);
}

async function main() {
  log('🚀 OpenAI Tool Parsing Issue Test');
  log('===================================');
  
  try {
    const result = await testOpenAIToolParsing();
    
    if (result.analysis.issues.length > 0) {
      log('\n❌ 测试失败 - 发现工具解析问题');
      process.exit(1);
    } else {
      log('\n✅ 测试通过 - 工具解析正常');
      process.exit(0);
    }
    
  } catch (error) {
    log(`\n💥 测试异常: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);