#!/usr/bin/env node
/**
 * Stage 4: CodeWhisperer响应模拟和解析测试
 * 基于demo2的二进制解析逻辑，模拟CodeWhisperer的响应并测试解析
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Stage 4: CodeWhisperer响应模拟和解析测试');
console.log('============================================\n');

// 读取Stage 3的输出
const stage3OutputPath = path.join(__dirname, 'stage3-codewhisperer-request.json');

if (!fs.existsSync(stage3OutputPath)) {
  console.error('❌ 找不到Stage 3的输出文件');
  console.log('💡 请先运行 test-stage3-codewhisperer-conversion.js');
  process.exit(1);
}

const conversionResult = JSON.parse(fs.readFileSync(stage3OutputPath, 'utf8'));

console.log('📋 输入的转换结果:');
console.log(`   原始模型: ${conversionResult.conversion.originalModel}`);
console.log(`   映射模型: ${conversionResult.conversion.mappedModelId}`);
console.log(`   内容长度: ${conversionResult.conversion.contentLength}`);
console.log(`   请求大小: ${conversionResult.conversion.requestSize} 字节`);

// 模拟CodeWhisperer的响应事件（基于demo2的assistantResponseEvent）
function createMockResponseEvents() {
  console.log('\n🎭 创建模拟CodeWhisperer响应事件:');
  
  const responseText = "Router test successful! The Claude Code Router is working correctly.";
  const chunks = responseText.split(' '); // 分割成多个chunk
  
  const events = [];
  
  // 添加开始事件
  events.push({
    content: chunks[0],
    input: null,
    name: "",
    toolUseId: "",
    stop: false
  });
  
  // 添加中间的文本chunk
  for (let i = 1; i < chunks.length; i++) {
    events.push({
      content: " " + chunks[i],
      input: null,
      name: "",
      toolUseId: "",
      stop: false
    });
  }
  
  // 添加结束事件
  events.push({
    content: "",
    input: null,
    name: "",
    toolUseId: "",
    stop: true
  });
  
  console.log(`   创建了 ${events.length} 个响应事件`);
  console.log(`   响应文本: "${responseText}"`);
  
  return events;
}

// 将事件转换为二进制格式（基于demo2的二进制结构）
function createBinaryResponse(events) {
  console.log('\n🔧 创建二进制响应格式:');
  
  const buffers = [];
  
  events.forEach((event, index) => {
    const eventJson = JSON.stringify(event);
    const payload = Buffer.from('vent' + eventJson, 'utf8'); // demo2中有"vent"前缀
    
    const totalLen = 12 + payload.length; // 4+4+4(总长度+头长度+CRC) + payload长度
    const headerLen = 0; // 简化，不使用header
    
    // 创建帧结构
    const frame = Buffer.allocUnsafe(totalLen);
    let offset = 0;
    
    // 总长度 (4字节，大端)
    frame.writeUInt32BE(totalLen, offset);
    offset += 4;
    
    // 头长度 (4字节，大端)
    frame.writeUInt32BE(headerLen, offset);
    offset += 4;
    
    // Payload
    payload.copy(frame, offset);
    offset += payload.length;
    
    // CRC32 (4字节，简化为0)
    frame.writeUInt32BE(0, offset);
    
    buffers.push(frame);
    
    console.log(`   事件 ${index + 1}: ${eventJson.length} 字节 payload, ${totalLen} 字节 frame`);
  });
  
  const finalBuffer = Buffer.concat(buffers);
  console.log(`   总响应大小: ${finalBuffer.length} 字节`);
  
  return finalBuffer;
}

// 基于demo2的SSE解析器（JavaScript版本）
function parseEvents(resp) {
  console.log('\n🔍 解析二进制响应:');
  
  const events = [];
  let offset = 0;
  
  while (offset + 12 <= resp.length) {
    // 读取总长度
    const totalLen = resp.readUInt32BE(offset);
    offset += 4;
    
    // 读取头长度
    const headerLen = resp.readUInt32BE(offset);
    offset += 4;
    
    // 验证帧长度
    if (totalLen > resp.length - offset + 8) {
      console.log(`   ⚠️  帧长度无效: ${totalLen}, 剩余: ${resp.length - offset + 8}`);
      break;
    }
    
    // 跳过header
    if (headerLen > 0) {
      offset += headerLen;
    }
    
    // 读取payload
    const payloadLen = totalLen - headerLen - 12;
    if (payloadLen <= 0) {
      console.log(`   ⚠️  无效的payload长度: ${payloadLen}`);
      offset += 4; // 跳过CRC
      continue;
    }
    
    const payload = resp.subarray(offset, offset + payloadLen);
    offset += payloadLen;
    
    // 跳过CRC32
    offset += 4;
    
    // 解析payload
    const payloadStr = payload.toString('utf8');
    
    // 去掉"vent"前缀（如果有）
    const jsonStr = payloadStr.startsWith('vent') ? payloadStr.substring(4) : payloadStr;
    
    try {
      const eventObj = JSON.parse(jsonStr);
      const sseEvent = convertAssistantEventToSSE(eventObj);
      if (sseEvent.event) {
        events.push(sseEvent);
        console.log(`   解析事件: ${sseEvent.event} (${eventObj.content ? eventObj.content.length : 0} chars)`);
      }
    } catch (error) {
      console.log(`   ❌ JSON解析错误: ${error.message}`);
      console.log(`   原始数据: ${jsonStr.substring(0, 100)}...`);
    }
  }
  
  console.log(`   总共解析出 ${events.length} 个SSE事件`);
  return events;
}

// 转换为Anthropic SSE格式（基于demo2）
function convertAssistantEventToSSE(evt) {
  if (evt.content && evt.content !== "") {
    return {
      event: "content_block_delta",
      data: {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "text_delta",
          text: evt.content
        }
      }
    };
  } else if (evt.toolUseId && evt.name && !evt.stop) {
    if (!evt.input) {
      return {
        event: "content_block_start",
        data: {
          type: "content_block_start",
          index: 1,
          content_block: {
            type: "tool_use",
            id: evt.toolUseId,
            name: evt.name,
            input: {}
          }
        }
      };
    } else {
      return {
        event: "content_block_delta",
        data: {
          type: "content_block_delta",
          index: 1,
          delta: {
            type: "input_json_delta",
            id: evt.toolUseId,
            name: evt.name,
            partial_json: evt.input
          }
        }
      };
    }
  } else if (evt.stop) {
    return {
      event: "content_block_stop",
      data: {
        type: "content_block_stop",
        index: 0
      }
    };
  }
  
  return { event: null, data: null };
}

// 构建完整的Anthropic流式响应
function buildAnthropicStreamResponse(sseEvents, baseRequest) {
  console.log('\n📡 构建Anthropic流式响应:');
  
  const messageId = `msg_${Date.now()}`;
  const streamEvents = [];
  
  // 1. Message start
  streamEvents.push({
    event: "message_start",
    data: {
      type: "message_start",
      message: {
        id: messageId,
        type: "message",
        role: "assistant",
        content: [],
        model: baseRequest.model,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      }
    }
  });
  
  // 2. Ping
  streamEvents.push({
    event: "ping",
    data: { type: "ping" }
  });
  
  // 3. Content block start
  streamEvents.push({
    event: "content_block_start",
    data: {
      type: "content_block_start",
      index: 0,
      content_block: {
        type: "text",
        text: ""
      }
    }
  });
  
  // 4. Content deltas from CodeWhisperer
  let totalText = "";
  sseEvents.forEach(event => {
    if (event.event === "content_block_delta" && event.data.delta.text) {
      streamEvents.push(event);
      totalText += event.data.delta.text;
    }
  });
  
  // 5. Content block stop
  streamEvents.push({
    event: "content_block_stop",
    data: {
      type: "content_block_stop",
      index: 0
    }
  });
  
  // 6. Message delta
  streamEvents.push({
    event: "message_delta",
    data: {
      type: "message_delta",
      delta: {
        stop_reason: "end_turn",
        stop_sequence: null
      },
      usage: {
        output_tokens: Math.ceil(totalText.length / 4) // 粗略估计
      }
    }
  });
  
  // 7. Message stop
  streamEvents.push({
    event: "message_stop",
    data: {
      type: "message_stop"
    }
  });
  
  console.log(`   构建了 ${streamEvents.length} 个流式事件`);
  console.log(`   响应文本: "${totalText}"`);
  console.log(`   估计token数: ${Math.ceil(totalText.length / 4)}`);
  
  return {
    messageId,
    events: streamEvents,
    responseText: totalText,
    tokenCount: Math.ceil(totalText.length / 4)
  };
}

// 执行完整的响应处理流程
console.log('\n🚀 执行完整响应处理流程:');

try {
  // 1. 创建模拟响应事件
  const mockEvents = createMockResponseEvents();
  
  // 2. 转换为二进制格式
  const binaryResponse = createBinaryResponse(mockEvents);
  
  // 3. 解析二进制响应
  const parsedEvents = parseEvents(binaryResponse);
  
  // 4. 构建Anthropic流式响应
  const anthropicResponse = buildAnthropicStreamResponse(parsedEvents, conversionResult.originalRequest);
  
  console.log('\n📊 处理结果总结:');
  console.log(`   原始事件数: ${mockEvents.length}`);
  console.log(`   二进制大小: ${binaryResponse.length} 字节`);
  console.log(`   解析事件数: ${parsedEvents.length}`);
  console.log(`   Anthropic事件数: ${anthropicResponse.events.length}`);
  console.log(`   最终响应文本: "${anthropicResponse.responseText}"`);
  
  // 验证响应完整性
  console.log('\n🔍 验证响应完整性:');
  
  const hasMessageStart = anthropicResponse.events.some(e => e.event === 'message_start');
  const hasContentDelta = anthropicResponse.events.some(e => e.event === 'content_block_delta');
  const hasMessageStop = anthropicResponse.events.some(e => e.event === 'message_stop');
  const hasContent = anthropicResponse.responseText.length > 0;
  
  console.log(`   ✅ Message start: ${hasMessageStart}`);
  console.log(`   ✅ Content delta: ${hasContentDelta}`);
  console.log(`   ✅ Message stop: ${hasMessageStop}`);
  console.log(`   ✅ Has content: ${hasContent}`);
  
  const isValid = hasMessageStart && hasContentDelta && hasMessageStop && hasContent;
  
  if (isValid) {
    console.log('\n✅ 响应格式验证通过');
  } else {
    console.log('\n❌ 响应格式验证失败');
  }
  
  // 构建最终结果
  const result = {
    request: conversionResult.originalRequest,
    codewhispererRequest: conversionResult.codewhispererRequest,
    mockResponse: {
      events: mockEvents,
      binarySize: binaryResponse.length
    },
    parsing: {
      parsedEvents: parsedEvents.length,
      success: parsedEvents.length > 0
    },
    anthropicResponse: anthropicResponse,
    validation: {
      hasMessageStart,
      hasContentDelta,
      hasMessageStop,
      hasContent,
      isValid
    },
    timestamp: new Date().toISOString()
  };
  
  // 保存结果
  const outputPath = path.join(__dirname, 'stage4-response-simulation.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  
  // 保存二进制响应样本
  const binaryPath = path.join(__dirname, 'stage4-mock-binary-response.bin');
  fs.writeFileSync(binaryPath, binaryResponse);
  
  console.log(`\n✅ Stage 4 完成！结果已保存到: ${outputPath}`);
  console.log(`📁 二进制样本已保存到: ${binaryPath}`);
  console.log('💡 可以继续运行 Stage 5: test-stage5-server-integration.js');
  
} catch (error) {
  console.error('\n❌ 响应处理过程中发生错误:', error.message);
  console.error('📚 错误堆栈:', error.stack);
  process.exit(1);
}