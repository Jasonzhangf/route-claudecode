#!/usr/bin/env node

/**
 * 测试我们修复后的解析器
 */

const fs = require('fs');
const path = require('path');

// 使用之前保存的原始响应数据
const rawResponseFile = 'debug-codewhisperer-raw-2025-07-26T14-38-26-427Z.bin';

if (!fs.existsSync(rawResponseFile)) {
  console.error('❌ 原始响应文件不存在:', rawResponseFile);
  console.log('请先运行: node debug-codewhisperer-raw-response.js');
  process.exit(1);
}

async function testParser() {
  console.log('🔍 测试修复后的解析器...\n');
  
  const rawResponse = fs.readFileSync(rawResponseFile);
  console.log(`📁 加载原始响应: ${rawResponse.length} bytes`);
  
  try {
    // 动态导入我们的解析器
    const { parseEvents, parseNonStreamingResponse, convertEventsToAnthropic } = await import('./src/providers/codewhisperer/parser.ts');
    
    console.log('\n🔍 步骤1: 解析AWS二进制事件...');
    const events = parseEvents(rawResponse);
    console.log(`解析到 ${events.length} 个AWS事件:`);
    events.forEach((event, i) => {
      console.log(`  [${i}] ${event.Event}:`, JSON.stringify(event.Data, null, 2));
    });
    
    console.log('\n🔍 步骤2: 转换为Anthropic格式...');
    const anthropicEvents = convertEventsToAnthropic(events, 'test-parser');
    console.log(`转换为 ${anthropicEvents.length} 个Anthropic事件:`);
    anthropicEvents.forEach((event, i) => {
      console.log(`  [${i}] ${event.event}:`, JSON.stringify(event.data, null, 2));
    });
    
    console.log('\n🔍 步骤3: 解析非流式响应...');
    const contexts = parseNonStreamingResponse(rawResponse, 'test-parser');
    console.log(`解析到 ${contexts.length} 个context:`);
    contexts.forEach((context, i) => {
      console.log(`  [${i}]`, JSON.stringify(context, null, 2));
    });
    
    // 检查是否有文本内容
    const textContexts = contexts.filter(c => c.type === 'text' && c.text && c.text.trim());
    if (textContexts.length > 0) {
      console.log('\n✅ 成功！找到文本内容:');
      textContexts.forEach((context, i) => {
        console.log(`  [${i}] "${context.text}"`);
      });
    } else {
      console.log('\n❌ 仍然没有文本内容');
    }
    
  } catch (error) {
    console.error('❌ 解析器测试失败:', error.message);
    console.error(error.stack);
  }
}

testParser();