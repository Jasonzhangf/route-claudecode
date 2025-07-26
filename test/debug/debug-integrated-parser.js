#!/usr/bin/env node

/**
 * 测试集成的AWS二进制事件流解析器
 * 验证修复后的parser.ts能正确处理CodeWhisperer响应
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

// Import the compiled parser
const { parseEvents, convertEventsToAnthropic } = require('../dist/providers/codewhisperer/parser');

async function testIntegratedParser() {
  console.log('🧪 测试集成的AWS二进制事件流解析器...\n');

  const responseFile = path.join(__dirname, 'debug-output', 'fixed-streaming-response.bin');
  
  if (!fs.existsSync(responseFile)) {
    console.log('❌ 二进制响应文件不存在，请先运行 debug-codewhisperer-fixed-api.js');
    return;
  }

  const binaryData = fs.readFileSync(responseFile);
  console.log(`📂 读取二进制文件: ${responseFile} (${binaryData.length} bytes)`);

  try {
    // Test the integrated parseEvents function
    console.log('\n🔍 测试parseEvents函数...');
    const sseEvents = parseEvents(binaryData);
    console.log(`✅ 解析出 ${sseEvents.length} 个SSE事件`);
    
    sseEvents.forEach((event, index) => {
      console.log(`   事件 ${index + 1}: ${event.Event} - ${JSON.stringify(event.Data).substring(0, 50)}...`);
    });

    // Test the conversion to Anthropic format
    console.log('\n🔄 测试convertEventsToAnthropic函数...');
    const requestId = 'test-integrated-parser';
    const anthropicEvents = convertEventsToAnthropic(sseEvents, requestId);
    console.log(`✅ 转换出 ${anthropicEvents.length} 个Anthropic事件`);
    
    anthropicEvents.forEach((event, index) => {
      console.log(`   事件 ${index + 1}: ${event.event}`);
      if (event.data && event.data.delta && event.data.delta.text) {
        console.log(`      内容: "${event.data.delta.text}"`);
      }
    });

    // Test message reconstruction
    console.log('\n📝 重构完整消息...');
    let fullMessage = '';
    anthropicEvents.forEach(event => {
      if (event.event === 'content_block_delta' && 
          event.data && event.data.delta && event.data.delta.text) {
        fullMessage += event.data.delta.text;
      }
    });
    
    if (fullMessage) {
      console.log(`✅ 完整消息: "${fullMessage}"`);
    } else {
      console.log('❌ 未能重构出完整消息');
    }

    // Save test results
    const outputFile = path.join(__dirname, 'debug-output', 'integrated-parser-test.json');
    const testResults = {
      timestamp: new Date().toISOString(),
      inputFile: responseFile,
      binaryDataLength: binaryData.length,
      sseEventCount: sseEvents.length,
      anthropicEventCount: anthropicEvents.length,
      fullMessage: fullMessage,
      sseEvents: sseEvents,
      anthropicEvents: anthropicEvents
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 测试结果已保存: ${outputFile}`);

    // Summary
    console.log('\n📊 测试总结:');
    console.log(`   输入: ${binaryData.length} 字节二进制数据`);
    console.log(`   SSE事件: ${sseEvents.length} 个`);  
    console.log(`   Anthropic事件: ${anthropicEvents.length} 个`);
    console.log(`   完整消息: "${fullMessage}"`);
    
    if (fullMessage.includes('API working correctly!')) {
      console.log('✅ 集成解析器工作正常！');
      return true;
    } else {
      console.log('❌ 集成解析器未能正确提取内容');
      return false;
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testIntegratedParser()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { testIntegratedParser };