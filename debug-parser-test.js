#!/usr/bin/env node

/**
 * 测试解析器对真实CodeWhisperer响应的处理
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');

// 导入解析器函数 (需要使用编译后的版本)
async function testParser() {
  console.log('🔍 测试解析器对真实CodeWhisperer响应的处理');
  
  try {
    // 读取刚才保存的原始响应数据
    const rawBuffer = fs.readFileSync('debug-codewhisperer-raw.bin');
    console.log('📥 读取原始响应:', rawBuffer.length, '字节');
    
    // 使用编译后的解析器
    const { parseEvents } = require('./dist/providers/codewhisperer/parser.js');
    
    console.log('🔧 开始解析...');
    const events = parseEvents(rawBuffer);
    
    console.log('📊 解析结果:');
    console.log('- 事件数量:', events.length);
    
    if (events.length > 0) {
      console.log('✅ 成功解析出事件!');
      events.forEach((event, index) => {
        console.log(`Event ${index + 1}:`, {
          Event: event.Event,
          DataType: typeof event.Data,
          DataPreview: typeof event.Data === 'string' 
            ? event.Data.substring(0, 100) 
            : JSON.stringify(event.Data).substring(0, 100)
        });
      });
    } else {
      console.log('❌ 没有解析出任何事件');
    }
    
    // 如果有事件，测试转换到Anthropic格式
    if (events.length > 0) {
      console.log('\n🔄 测试转换到Anthropic格式...');
      
      try {
        const { convertEventsToAnthropic } = require('./dist/providers/codewhisperer/parser.js');
        const anthropicEvents = convertEventsToAnthropic(events, 'test-request-id');
        
        console.log('📊 Anthropic格式转换结果:');
        console.log('- 事件数量:', anthropicEvents.length);
        
        anthropicEvents.forEach((event, index) => {
          console.log(`Anthropic Event ${index + 1}:`, {
            event: event.event,
            data: event.data
          });
        });
        
        // 测试最终的BaseResponse构建
        const contentParts = [];
        let hasContent = false;
        
        for (const event of anthropicEvents) {
          if (event.event === 'content_block_delta' && event.data?.delta?.text) {
            contentParts.push(event.data.delta.text);
            hasContent = true;
          }
        }
        
        if (hasContent) {
          const fullText = contentParts.join('');
          console.log('\n✅ 重构完整消息:', fullText);
          console.log('✅ 消息长度:', fullText.length, '字符');
        } else {
          console.log('\n❌ 没有找到文本内容');
        }
        
      } catch (convertError) {
        console.log('❌ 转换过程出错:', convertError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试过程出错:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testParser();