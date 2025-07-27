/**
 * Test raw streaming events processing - 测试原始流事件处理
 * 直接监听流式响应事件，检查工具调用是否被正确处理
 * 
 * @author Jason Zhang
 */

const axios = require('axios');
const { Transform } = require('stream');

class StreamEventMonitor extends Transform {
  constructor(options) {
    super(options);
    this.events = [];
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    
    // 解析SSE格式的数据
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // 保留最后一个不完整的行
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          this.events.push(data);
          
          // 检查是否包含工具调用相关的内容
          if (this.containsToolCall(data)) {
            console.log('[' + new Date().toISOString() + '] 🔧 检测到工具调用相关事件:', {
              type: data.type,
              delta: data.delta,
              content: data.content_block
            });
          }
          
          // 检查是否有可疑的文本内容
          if (this.containsSuspiciousText(data)) {
            console.log('[' + new Date().toISOString() + '] ⚠️ 检测到可疑文本内容:', {
              type: data.type,
              text: this.extractText(data)
            });
          }
          
        } catch (error) {
          // 忽略JSON解析错误
        }
      }
    }
    
    this.push(chunk);
    callback();
  }

  containsToolCall(data) {
    if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
      return true;
    }
    if (data.delta?.type === 'input_json_delta') {
      return true;
    }
    return false;
  }

  containsSuspiciousText(data) {
    const text = this.extractText(data);
    return text && text.includes('Tool call:');
  }

  extractText(data) {
    if (data.delta?.text) return data.delta.text;
    if (data.content) return data.content;
    if (data.text) return data.text;
    return null;
  }

  getEvents() {
    return this.events;
  }
}

async function testRawStreamingEvents() {
  console.log('[2025-07-27T08:00:00.000Z] 🔍 开始测试原始流事件处理');
  
  const startTime = Date.now();
  
  try {
    // 创建流事件监听器
    const monitor = new StreamEventMonitor();
    
    const testRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      stream: true,
      messages: [
        {
          role: 'user',
          content: 'List the files in /Users/fanzhang/.claude-code-router using the LS tool'
        }
      ],
      tools: [
        {
          name: 'LS',
          description: 'List files and directories',
          input_schema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to list'
              }
            },
            required: ['path']
          }
        }
      ]
    };
    
    console.log('[' + new Date().toISOString() + '] 📤 发送原始流事件测试请求');
    
    // 发送流式请求
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': 'any-string-is-ok',
        'Accept': 'text/event-stream'
      },
      responseType: 'stream',
      timeout: 30000
    });
    
    // 监听流数据
    return new Promise((resolve, reject) => {
      let streamCompleted = false;
      
      response.data.pipe(monitor);
      
      monitor.on('finish', () => {
        if (!streamCompleted) {
          streamCompleted = true;
          console.log('[' + new Date().toISOString() + '] ✅ 原始流事件测试完成');
          
          const events = monitor.getEvents();
          const analysisResult = analyzeStreamEvents(events);
          const testReport = generateStreamTestReport(analysisResult, startTime);
          
          console.log('\\n📊 流事件分析结果:');
          console.log(JSON.stringify(analysisResult, null, 2));
          
          console.log('\\n📋 原始流事件测试报告:');
          console.log(`[${new Date().toISOString()}] 状态: ${testReport.status}`);
          console.log(`[${new Date().toISOString()}] 总事件数: ${testReport.totalEvents}`);
          console.log(`[${new Date().toISOString()}] 工具调用事件: ${testReport.toolCallEvents}`);
          console.log(`[${new Date().toISOString()}] 可疑文本事件: ${testReport.suspiciousTextEvents}`);
          console.log(`[${new Date().toISOString()}] 检测到的问题: ${testReport.issueCount}`);
          
          if (testReport.issues.length > 0) {
            console.log('\\n⚠️  发现的问题:');
            testReport.issues.forEach((issue, index) => {
              console.log(`[${new Date().toISOString()}] ${index + 1}. ${issue}`);
            });
          }
          
          resolve(testReport);
        }
      });
      
      monitor.on('error', (error) => {
        if (!streamCompleted) {
          streamCompleted = true;
          reject(error);
        }
      });
      
      // 设置超时
      setTimeout(() => {
        if (!streamCompleted) {
          streamCompleted = true;
          monitor.end();
        }
      }, 25000);
    });
    
  } catch (error) {
    console.error('[' + new Date().toISOString() + '] ❌ 原始流事件测试失败:', error.message);
    
    return {
      status: 'FAILED',
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

function analyzeStreamEvents(events) {
  console.log('[' + new Date().toISOString() + '] 📡 开始分析流事件');
  
  const analysis = {
    totalEvents: events.length,
    eventTypes: {},
    toolCallEvents: [],
    textEvents: [],
    suspiciousEvents: [],
    issues: []
  };
  
  // 统计事件类型
  events.forEach((event, index) => {
    const eventType = event.type || 'unknown';
    analysis.eventTypes[eventType] = (analysis.eventTypes[eventType] || 0) + 1;
    
    // 记录工具调用相关事件
    if (eventType === 'content_block_start' && event.content_block?.type === 'tool_use') {
      analysis.toolCallEvents.push({
        index,
        toolName: event.content_block.name,
        toolId: event.content_block.id,
        input: event.content_block.input
      });
      console.log(`[${new Date().toISOString()}] 🔧 流事件 ${index}: 工具调用开始 - ${event.content_block.name}`);
    }
    
    // 记录文本事件
    if (eventType === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const textContent = event.delta.text || '';
      analysis.textEvents.push({
        index,
        text: textContent,
        length: textContent.length
      });
      
      // 检查文本中是否包含工具调用
      if (textContent.includes('Tool call:')) {
        analysis.suspiciousEvents.push({
          index,
          type: 'text_contains_tool_call',
          text: textContent
        });
        analysis.issues.push(`流事件 ${index}: 文本delta中发现工具调用文本 - "${textContent.substring(0, 100)}"`);
        console.log(`[${new Date().toISOString()}] ⚠️ 流事件 ${index}: 在文本delta中发现工具调用`);
      }
    }
  });
  
  console.log(`[${new Date().toISOString()}] 📊 事件类型分布:`, analysis.eventTypes);
  console.log(`[${new Date().toISOString()}] 🔧 工具调用事件数: ${analysis.toolCallEvents.length}`);
  console.log(`[${new Date().toISOString()}] 💬 文本事件数: ${analysis.textEvents.length}`);
  console.log(`[${new Date().toISOString()}] ⚠️ 可疑事件数: ${analysis.suspiciousEvents.length}`);
  
  return analysis;
}

function generateStreamTestReport(analysis, startTime) {
  const duration = Date.now() - startTime;
  
  const report = {
    status: analysis.issues.length === 0 ? 'PASSED' : 'FAILED',
    totalEvents: analysis.totalEvents,
    toolCallEvents: analysis.toolCallEvents.length,
    suspiciousTextEvents: analysis.suspiciousEvents.length,
    issueCount: analysis.issues.length,
    issues: analysis.issues,
    duration: duration,
    eventTypes: analysis.eventTypes
  };
  
  // 评估修复效果
  if (analysis.toolCallEvents.length > 0 && analysis.suspiciousEvents.length === 0) {
    report.fixEffectiveness = 'EXCELLENT';
    report.message = '累积式处理完全避免了工具调用被错误识别为文本';
  } else if (analysis.toolCallEvents.length > 0 && analysis.suspiciousEvents.length > 0) {
    report.fixEffectiveness = 'PARTIAL';
    report.message = '累积式处理部分有效，但仍有工具调用被识别为文本';
  } else if (analysis.toolCallEvents.length === 0) {
    report.fixEffectiveness = 'NO_TOOL_CALLS';
    report.message = '流中没有检测到工具调用事件';
  }
  
  return report;
}

// 如果直接运行此脚本
if (require.main === module) {
  testRawStreamingEvents()
    .then(result => {
      console.log('\\n🏁 原始流事件处理测试完成');
      process.exit(result.status === 'PASSED' ? 0 : 1);
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testRawStreamingEvents };