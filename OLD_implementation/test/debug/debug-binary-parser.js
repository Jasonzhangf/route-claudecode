#!/usr/bin/env node

/**
 * AWS二进制事件流解析器
 * 正确解析CodeWhisperer的二进制响应格式
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

class AWSBinaryEventParser {
  parseEvents(binaryData) {
    const events = [];
    let offset = 0;
    
    console.log(`🔍 开始解析二进制数据，总长度: ${binaryData.length} bytes`);
    
    while (offset < binaryData.length) {
      try {
        const event = this.parseEventAtOffset(binaryData, offset);
        if (event) {
          events.push(event.data);
          offset = event.nextOffset;
          console.log(`✅ 解析事件 ${events.length}: ${JSON.stringify(event.data).substring(0, 100)}...`);
        } else {
          console.log(`❌ 在偏移 ${offset} 处解析失败，跳出循环`);
          break;
        }
      } catch (error) {
        console.log(`❌ 解析错误在偏移 ${offset}:`, error.message);
        break;
      }
    }
    
    console.log(`📊 总共解析出 ${events.length} 个事件`);
    return events;
  }

  parseEventAtOffset(buffer, offset) {
    if (offset + 12 > buffer.length) {
      return null; // 不足以包含最小的消息头
    }

    // AWS Event Stream format:
    // 4 bytes: total message length
    // 4 bytes: headers length  
    // 4 bytes: CRC of prelude
    // headers
    // payload
    // 4 bytes: message CRC

    const totalLength = buffer.readUInt32BE(offset);
    const headersLength = buffer.readUInt32BE(offset + 4);
    const preludeCRC = buffer.readUInt32BE(offset + 8);

    console.log(`📋 消息头信息: 总长度=${totalLength}, 头部长度=${headersLength}, 预置CRC=${preludeCRC.toString(16)}`);

    if (offset + totalLength > buffer.length) {
      console.log(`❌ 消息长度超出缓冲区大小`);
      return null;
    }

    // 跳过预置（12字节）和读取头部
    const headersStart = offset + 12;
    const headers = this.parseHeaders(buffer, headersStart, headersLength);
    
    // 读取负载
    const payloadStart = headersStart + headersLength;
    const payloadLength = totalLength - 12 - headersLength - 4; // 减去预置和尾部CRC
    const payload = buffer.slice(payloadStart, payloadStart + payloadLength);
    
    console.log(`📦 负载信息: 长度=${payloadLength}, 内容=${payload.toString().substring(0, 50)}...`);

    const eventData = {
      headers: headers,
      payload: payload.toString('utf8'),
      payloadRaw: payload
    };

    // 尝试解析JSON负载
    try {
      eventData.payloadJSON = JSON.parse(eventData.payload);
    } catch (e) {
      // 负载不是JSON，保持原样
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
      // 头部格式：
      // 1 byte: header name length
      // N bytes: header name (UTF-8)
      // 1 byte: header value type (7 = string, 8 = byte array, etc.)
      // 2 bytes: header value length
      // N bytes: header value

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

      console.log(`📝 头部: ${name} = ${value}`);
    }

    return headers;
  }
}

async function testBinaryParser() {
  console.log('🧪 测试AWS二进制事件流解析器...\n');

  const responseFile = path.join(__dirname, 'debug-output', 'fixed-streaming-response.bin');
  
  if (!fs.existsSync(responseFile)) {
    console.log('❌ 二进制响应文件不存在，请先运行 debug-codewhisperer-fixed-api.js');
    return;
  }

  const binaryData = fs.readFileSync(responseFile);
  console.log(`📂 读取二进制文件: ${responseFile} (${binaryData.length} bytes)`);

  const parser = new AWSBinaryEventParser();
  const events = parser.parseEvents(binaryData);

  console.log(`\n📊 解析结果:`);
  console.log(`   总事件数: ${events.length}`);
  
  events.forEach((event, index) => {
    console.log(`\n事件 ${index + 1}:`);
    console.log(`   头部:`, event.headers);
    console.log(`   负载:`, event.payload);
    if (event.payloadJSON) {
      console.log(`   JSON:`, event.payloadJSON);
    }
  });

  // 保存解析结果
  const outputFile = path.join(__dirname, 'debug-output', 'parsed-events.json');
  fs.writeFileSync(outputFile, JSON.stringify(events, null, 2));
  console.log(`\n💾 解析结果已保存: ${outputFile}`);

  // 分析内容
  const contentEvents = events.filter(e => e.payloadJSON && e.payloadJSON.content);
  if (contentEvents.length > 0) {
    console.log(`\n✅ 找到 ${contentEvents.length} 个包含内容的事件:`);
    contentEvents.forEach((event, index) => {
      console.log(`   ${index + 1}. "${event.payloadJSON.content}"`);
    });
  } else {
    console.log(`\n❌ 未找到包含内容的事件`);
  }
}

// 运行测试
if (require.main === module) {
  testBinaryParser().catch(console.error);
}

module.exports = { AWSBinaryEventParser };