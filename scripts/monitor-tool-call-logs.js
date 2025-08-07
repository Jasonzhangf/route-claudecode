#!/usr/bin/env node
/**
 * 🔍 实时监控工具调用日志
 * 
 * 发送工具调用请求并详细记录所有响应事件，用于诊断解析问题
 */

const http = require('http');

console.log('🔍 [TOOL-CALL-LOG-MONITOR] 开始监控工具调用日志...');

const TOOL_CALL_REQUEST = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: "请帮我执行 ls -la 命令查看当前目录的文件"
    }
  ],
  tools: [
    {
      name: "bash",
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

async function monitorToolCallLogs() {
  console.log('📤 发送工具调用请求到端口3456...');
  console.log('📋 请求内容:', JSON.stringify(TOOL_CALL_REQUEST, null, 2));
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(TOOL_CALL_REQUEST);
    
    const options = {
      hostname: '127.0.0.1',
      port: 3456,
      path: '/v1/messages?beta=true',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'text/event-stream'
      }
    };

    const req = http.request(options, (res) => {
      console.log(`\n📊 HTTP响应状态: ${res.statusCode}`);
      console.log('📋 响应头:', res.headers);
      
      if (res.statusCode !== 200) {
        console.error(`❌ HTTP错误: ${res.statusCode}`);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let buffer = '';
      let eventCount = 0;
      let toolCallInfo = {
        detected: false,
        id: null,
        name: null,
        inputParts: [],
        completeInput: '',
        stopReason: null,
        messageStopReceived: false,
        errors: []
      };
      
      console.log('\n📡 开始接收流式响应...');
      console.log('='.repeat(80));

      const timeout = setTimeout(() => {
        console.log('\n⏰ 监控超时，生成诊断报告...');
        generateDiagnosticReport(toolCallInfo, eventCount);
        resolve();
      }, 30000);

      res.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        // 显示原始数据块（截断显示）
        console.log(`📦 收到数据块 (${chunk.length} bytes): ${chunkStr.substring(0, 100)}${chunkStr.length > 100 ? '...' : ''}`);
        
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        
        events.forEach(eventData => {
          if (eventData.trim()) {
            eventCount++;
            processEvent(eventData.trim(), eventCount, toolCallInfo);
          }
        });
      });

      res.on('end', () => {
        clearTimeout(timeout);
        console.log('\n📊 流式响应结束');
        generateDiagnosticReport(toolCallInfo, eventCount);
        resolve();
      });

      res.on('error', (error) => {
        clearTimeout(timeout);
        console.error('💥 响应错误:', error);
        toolCallInfo.errors.push(`Response error: ${error.message}`);
        generateDiagnosticReport(toolCallInfo, eventCount);
        reject(error);
      });
    });

    req.on('error', (error) => {
      console.error('💥 请求错误:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

function processEvent(eventData, eventIndex, toolCallInfo) {
  const timestamp = new Date().toLocaleTimeString();
  
  console.log(`\n[${timestamp}] 📨 事件 ${eventIndex}:`);
  console.log('─'.repeat(40));
  
  // 显示原始事件数据
  console.log('📄 原始数据:');
  console.log(eventData);
  
  // 解析事件
  const lines = eventData.split('\n');
  let event = null;
  let data = null;
  
  lines.forEach(line => {
    if (line.startsWith('event: ')) {
      event = line.substring(7);
    } else if (line.startsWith('data: ')) {
      try {
        data = JSON.parse(line.substring(6));
      } catch (e) {
        data = line.substring(6);
        toolCallInfo.errors.push(`JSON parse error in event ${eventIndex}: ${e.message}`);
      }
    }
  });
  
  if (event && data) {
    console.log(`🏷️  事件类型: ${event}`);
    console.log(`📋 数据内容: ${JSON.stringify(data, null, 2)}`);
    
    // 分析特定事件
    analyzeEvent(event, data, toolCallInfo, eventIndex);
  } else {
    console.log('⚠️ 无法解析事件或数据');
    toolCallInfo.errors.push(`Failed to parse event ${eventIndex}`);
  }
}

function analyzeEvent(event, data, toolCallInfo, eventIndex) {
  switch (event) {
    case 'content_block_start':
      if (data.content_block?.type === 'tool_use') {
        toolCallInfo.detected = true;
        toolCallInfo.id = data.content_block.id;
        toolCallInfo.name = data.content_block.name;
        console.log(`🔧 ✅ 工具调用检测: ${toolCallInfo.name} (ID: ${toolCallInfo.id})`);
      }
      break;
      
    case 'content_block_delta':
      if (data.delta?.type === 'input_json_delta') {
        const part = data.delta.partial_json || '';
        toolCallInfo.inputParts.push(part);
        toolCallInfo.completeInput += part;
        console.log(`📝 参数片段 ${toolCallInfo.inputParts.length}: "${part}"`);
        console.log(`📝 累积参数: "${toolCallInfo.completeInput}"`);
      }
      break;
      
    case 'message_delta':
      if (data.delta?.stop_reason) {
        toolCallInfo.stopReason = data.delta.stop_reason;
        console.log(`🎯 Stop Reason: ${toolCallInfo.stopReason}`);
        
        if (toolCallInfo.stopReason === 'tool_use') {
          console.log('✅ 正确的工具调用stop_reason');
        } else {
          console.log('⚠️ 非预期的stop_reason');
        }
      }
      break;
      
    case 'message_stop':
      toolCallInfo.messageStopReceived = true;
      console.log('🏁 ❌ 收到message_stop (工具调用场景下不应该收到)');
      break;
      
    case 'content_block_stop':
      console.log('🛑 内容块结束');
      break;
      
    default:
      console.log(`📨 其他事件: ${event}`);
  }
}

function generateDiagnosticReport(toolCallInfo, eventCount) {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 工具调用日志诊断报告');
  console.log('='.repeat(80));
  
  console.log(`📊 基本统计:`);
  console.log(`   总事件数: ${eventCount}`);
  console.log(`   错误数: ${toolCallInfo.errors.length}`);
  
  console.log(`\n🔧 工具调用分析:`);
  console.log(`   检测到工具调用: ${toolCallInfo.detected ? '✅' : '❌'}`);
  
  if (toolCallInfo.detected) {
    console.log(`   工具ID: ${toolCallInfo.id}`);
    console.log(`   工具名称: ${toolCallInfo.name}`);
    console.log(`   参数片段数: ${toolCallInfo.inputParts.length}`);
    console.log(`   完整参数: "${toolCallInfo.completeInput}"`);
    
    // 尝试解析JSON参数
    if (toolCallInfo.completeInput) {
      try {
        const parsedInput = JSON.parse(toolCallInfo.completeInput);
        console.log(`   参数解析: ✅`);
        console.log(`   解析结果: ${JSON.stringify(parsedInput, null, 4)}`);
      } catch (error) {
        console.log(`   参数解析: ❌ - ${error.message}`);
        console.log(`   原始参数: "${toolCallInfo.completeInput}"`);
        toolCallInfo.errors.push(`JSON parameter parsing failed: ${error.message}`);
      }
    } else {
      console.log(`   参数解析: ❌ - 参数为空`);
    }
  }
  
  console.log(`\n🎯 流程状态:`);
  console.log(`   Stop Reason: ${toolCallInfo.stopReason || '未收到'}`);
  console.log(`   Message Stop: ${toolCallInfo.messageStopReceived ? '❌ 收到了' : '✅ 未收到'}`);
  
  if (toolCallInfo.errors.length > 0) {
    console.log(`\n❌ 发现的错误:`);
    toolCallInfo.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  console.log(`\n🔍 诊断结论:`);
  if (toolCallInfo.detected && toolCallInfo.stopReason === 'tool_use' && !toolCallInfo.messageStopReceived) {
    if (toolCallInfo.completeInput && toolCallInfo.completeInput.trim()) {
      try {
        JSON.parse(toolCallInfo.completeInput);
        console.log('✅ 工具调用解析完全正常！');
      } catch (error) {
        console.log('⚠️ 工具调用检测正常，但参数JSON格式有问题');
        console.log(`   建议检查参数构建逻辑`);
      }
    } else {
      console.log('⚠️ 工具调用检测正常，但参数为空');
      console.log(`   建议检查参数传递逻辑`);
    }
  } else {
    console.log('❌ 工具调用解析存在问题');
    const issues = [];
    if (!toolCallInfo.detected) issues.push('未检测到工具调用');
    if (toolCallInfo.stopReason !== 'tool_use') issues.push('Stop reason不正确');
    if (toolCallInfo.messageStopReceived) issues.push('错误发送了message_stop');
    
    console.log(`   问题: ${issues.join(', ')}`);
  }
}

// 执行监控
async function main() {
  try {
    await monitorToolCallLogs();
    console.log('\n✅ 监控完成');
  } catch (error) {
    console.error('💥 监控失败:', error);
  }
}

if (require.main === module) {
  main();
}