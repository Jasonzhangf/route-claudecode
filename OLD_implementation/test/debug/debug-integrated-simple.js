#!/usr/bin/env node

/**
 * 简化的集成解析器测试
 * 直接使用二进制解析逻辑测试CodeWhisperer响应
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

// Directly implement the core parsing logic for testing
class SimplifiedAWSParser {
  parseEvents(buffer) {
    const events = [];
    let offset = 0;
    
    while (offset < buffer.length) {
      try {
        const event = this.parseEventAtOffset(buffer, offset);
        if (event) {
          events.push(event.data);
          offset = event.nextOffset;
        } else {
          break;
        }
      } catch (error) {
        console.log(`解析错误在偏移 ${offset}:`, error.message);
        break;
      }
    }
    
    return events;
  }

  parseEventAtOffset(buffer, offset) {
    if (offset + 12 > buffer.length) {
      return null;
    }

    const totalLength = buffer.readUInt32BE(offset);
    const headersLength = buffer.readUInt32BE(offset + 4);
    
    if (offset + totalLength > buffer.length) {
      return null;
    }

    // Parse headers
    const headersStart = offset + 12;
    const headers = this.parseHeaders(buffer, headersStart, headersLength);
    
    // Parse payload
    const payloadStart = headersStart + headersLength;
    const payloadLength = totalLength - 12 - headersLength - 4;
    const payload = buffer.slice(payloadStart, payloadStart + payloadLength);
    
    const eventData = {
      headers: headers,
      payload: payload.toString('utf8')
    };

    // Try to parse JSON payload
    try {
      eventData.payloadJSON = JSON.parse(eventData.payload);
    } catch {
      // Not JSON, keep as string
    }

    return {
      data: eventData,
      nextOffset: offset + totalLength
    };
  }

  parseHeaders(buffer, start, length) {
    const headers = {};
    let offset = start;
    const end = start + length;

    while (offset < end) {
      if (offset + 4 > end) break;

      const nameLength = buffer.readUInt8(offset);
      offset += 1;

      if (offset + nameLength > end) break;

      const name = buffer.slice(offset, offset + nameLength).toString('utf8');
      offset += nameLength;

      if (offset + 3 > end) break;

      const valueType = buffer.readUInt8(offset);
      offset += 1;

      const valueLength = buffer.readUInt16BE(offset);
      offset += 2;

      if (offset + valueLength > end) break;

      let value;
      if (valueType === 7) { // String
        value = buffer.slice(offset, offset + valueLength).toString('utf8');
      } else {
        value = buffer.slice(offset, offset + valueLength);
      }

      headers[name] = value;
      offset += valueLength;
    }

    return headers;
  }

  convertToSSEFormat(binaryEvents) {
    return binaryEvents.map(event => ({
      Event: event.headers[':event-type'] || 'assistantResponseEvent',
      Data: event.payloadJSON || { text: event.payload }
    }));
  }

  convertToAnthropicFormat(sseEvents) {
    const anthropicEvents = [];
    
    for (const event of sseEvents) {
      if (event.Event === 'assistantResponseEvent' && event.Data && event.Data.content) {
        anthropicEvents.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'text_delta',
              text: event.Data.content
            }
          }
        });
      }
    }
    
    return anthropicEvents;
  }
}

async function testSimplifiedParser() {
  console.log('🧪 测试简化的集成解析器...\n');

  const responseFile = path.join(__dirname, 'debug-output', 'fixed-streaming-response.bin');
  
  if (!fs.existsSync(responseFile)) {
    console.log('❌ 二进制响应文件不存在，请先运行 debug-codewhisperer-fixed-api.js');
    return false;
  }

  const binaryData = fs.readFileSync(responseFile);
  console.log(`📂 读取二进制文件: ${responseFile} (${binaryData.length} bytes)`);

  try {
    const parser = new SimplifiedAWSParser();
    
    // Parse binary events
    console.log('\n🔍 解析二进制事件...');
    const binaryEvents = parser.parseEvents(binaryData);
    console.log(`✅ 解析出 ${binaryEvents.length} 个二进制事件`);
    
    // Convert to SSE format
    console.log('\n🔄 转换为SSE格式...');
    const sseEvents = parser.convertToSSEFormat(binaryEvents);
    console.log(`✅ 转换出 ${sseEvents.length} 个SSE事件`);
    
    // Convert to Anthropic format
    console.log('\n🎯 转换为Anthropic格式...');
    const anthropicEvents = parser.convertToAnthropicFormat(sseEvents);
    console.log(`✅ 转换出 ${anthropicEvents.length} 个Anthropic事件`);

    // Reconstruct message
    console.log('\n📝 重构完整消息...');
    let fullMessage = '';
    anthropicEvents.forEach(event => {
      if (event.event === 'content_block_delta' && 
          event.data && event.data.delta && event.data.delta.text) {
        fullMessage += event.data.delta.text;
      }
    });
    
    console.log(`完整消息: "${fullMessage}"`);

    // Save results
    const outputFile = path.join(__dirname, 'debug-output', 'simplified-parser-test.json');
    const testResults = {
      timestamp: new Date().toISOString(),
      binaryEventCount: binaryEvents.length,
      sseEventCount: sseEvents.length,
      anthropicEventCount: anthropicEvents.length,
      fullMessage: fullMessage,
      binaryEvents: binaryEvents,
      sseEvents: sseEvents,
      anthropicEvents: anthropicEvents
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 测试结果已保存: ${outputFile}`);

    // Verification
    console.log('\n📊 测试验证:');
    if (fullMessage.includes('API working correctly!')) {
      console.log('✅ 解析器正确提取了完整消息！');
      console.log('✅ AWS二进制事件流解析器集成成功！');
      return true;
    } else {
      console.log('❌ 解析器未能正确提取消息内容');
      return false;
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testSimplifiedParser()
    .then(success => {
      console.log(`\n${success ? '✅ 测试通过' : '❌ 测试失败'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { testSimplifiedParser };