#!/usr/bin/env node

/**
 * 测试Output Processor的dual finish reason logging
 * 直接测试OpenAI -> Anthropic转换路径
 */

console.log('🧪 Testing Output Processor Dual Finish Reason Logging...\n');

async function testOutputProcessor() {
  try {
    // 导入必要的模块
    const { AnthropicOutputProcessor } = require('./dist/output/anthropic/processor.js');
    
    console.log('✅ Output processor imported successfully');

    // 创建processor实例
    const processor = new AnthropicOutputProcessor(5999); // 测试端口
    
    // 等待初始化
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n📝 Test Case 1: OpenAI response conversion');
    
    // 模拟OpenAI格式的响应
    const openaiResponse = {
      id: 'chatcmpl-test123',
      object: 'chat.completion',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: '这是一个测试响应。'
        },
        finish_reason: 'stop'  // 🎯 这是原始的OpenAI finish_reason
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    };

    // 模拟请求元数据
    const baseRequest = {
      messages: [{ role: 'user', content: '测试' }],
      model: 'gpt-4',
      metadata: {
        requestId: 'test-req-output-001',
        targetProvider: 'openai',
        originalModel: 'gpt-4'
      }
    };

    console.log(`   Original OpenAI finish_reason: "${openaiResponse.choices[0].finish_reason}"`);
    
    // 处理响应 - 这应该触发dual logging
    const anthropicResponse = await processor.process(openaiResponse, baseRequest);
    
    console.log(`   Converted Anthropic stop_reason: "${anthropicResponse.stop_reason}"`);
    
    console.log('\n📝 Test Case 2: Already Anthropic format (validateAndNormalize)');
    
    // 模拟已经是Anthropic格式的响应
    const anthropicInput = {
      id: 'msg_test456',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '这是Anthropic格式的响应。' }],
      stop_reason: 'end_turn',  // 🎯 这是原始的Anthropic stop_reason
      usage: {
        input_tokens: 15,
        output_tokens: 25
      }
    };

    const baseRequest2 = {
      messages: [{ role: 'user', content: '测试2' }],
      model: 'claude-3-sonnet',
      metadata: {
        requestId: 'test-req-output-002',
        targetProvider: 'anthropic',
        originalModel: 'claude-3-sonnet'
      }
    };

    console.log(`   Input Anthropic stop_reason: "${anthropicInput.stop_reason}"`);
    
    const normalizedResponse = await processor.process(anthropicInput, baseRequest2);
    
    console.log(`   Normalized stop_reason: "${normalizedResponse.stop_reason}"`);

    console.log('\n📝 Test Case 3: Tool calls finish reason');
    
    // 模拟工具调用的OpenAI响应
    const toolCallResponse = {
      id: 'chatcmpl-tool789',
      object: 'chat.completion',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "Beijing"}'
            }
          }]
        },
        finish_reason: 'tool_calls'  // 🎯 这是工具调用的finish_reason
      }],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 30,
        total_tokens: 50
      }
    };

    const baseRequest3 = {
      messages: [{ role: 'user', content: '北京天气如何？' }],
      model: 'gpt-4',
      metadata: {
        requestId: 'test-req-output-003',
        targetProvider: 'openai',
        originalModel: 'gpt-4'
      }
    };

    console.log(`   Tool call finish_reason: "${toolCallResponse.choices[0].finish_reason}"`);
    
    const toolResponse = await processor.process(toolCallResponse, baseRequest3);
    
    console.log(`   Converted tool stop_reason: "${toolResponse.stop_reason}"`);

    // 等待日志写入
    console.log('\n⏳ Waiting for logs to be written...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 检查日志文件
    console.log('\n🔍 Verifying dual logging in finish_reason.log...');
    
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const logDir = path.join(os.homedir(), '.route-claude-code', 'logs', 'port-5999');
    
    if (fs.existsSync(logDir)) {
      const rotationDirs = fs.readdirSync(logDir).filter(dir => 
        dir.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/)
      );
      
      if (rotationDirs.length > 0) {
        const latestDir = rotationDirs.sort().pop();
        const latestLogDir = path.join(logDir, latestDir);
        const finishReasonLogPath = path.join(latestLogDir, 'finish_reason.log');
        
        if (fs.existsSync(finishReasonLogPath)) {
          const logContent = fs.readFileSync(finishReasonLogPath, 'utf-8');
          const logLines = logContent.trim().split('\n');
          
          console.log(`📁 Log file: ${finishReasonLogPath}`);
          console.log(`📊 Total entries: ${logLines.length}`);
          
          // 查找最近3分钟内的记录
          const threeMinutesAgo = Date.now() - (3 * 60 * 1000);
          let recentEntries = [];
          
          logLines.forEach(line => {
            try {
              const entry = JSON.parse(line);
              const entryTime = new Date(entry.timestamp).getTime();
              
              if (entryTime > threeMinutesAgo) {
                recentEntries.push(entry);
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          });
          
          console.log(`\n🕐 Recent entries (last 3 minutes): ${recentEntries.length}`);
          
          let originalCount = 0;
          let convertedCount = 0;
          let mappingCount = 0;
          let singleCount = 0;
          
          console.log('\n📋 Recent dual logging analysis:');
          recentEntries.forEach((entry, index) => {
            const shortMsg = entry.message.substring(0, 80) + (entry.message.length > 80 ? '...' : '');
            
            if (entry.message.includes('[ORIGINAL-SERVER-RESPONSE]')) {
              originalCount++;
              console.log(`   🔵 ${originalCount}: ${shortMsg}`);
            } else if (entry.message.includes('[CONVERTED-ANTHROPIC-FORMAT]')) {
              convertedCount++;
              console.log(`   🟢 ${convertedCount}: ${shortMsg}`);
            } else if (entry.message.includes('[CONVERSION-MAPPING]')) {
              mappingCount++;
              console.log(`   🔄 ${mappingCount}: ${shortMsg}`);
            } else if (entry.message.includes('[SINGLE-')) {
              singleCount++;
              console.log(`   ⚪ ${singleCount}: ${shortMsg}`);
            }
          });
          
          console.log(`\n📈 Analysis Summary:`);
          console.log(`   • Original server responses: ${originalCount}`);
          console.log(`   • Converted formats: ${convertedCount}`);
          console.log(`   • Conversion mappings: ${mappingCount}`);
          console.log(`   • Single reason entries: ${singleCount}`);
          
          // 预期：每个测试用例应该产生3条dual logging记录
          const expectedTriples = 3; // 3个测试用例
          if (originalCount >= expectedTriples && convertedCount >= expectedTriples && mappingCount >= expectedTriples) {
            console.log(`\n🎉 SUCCESS: Output processor dual logging working correctly!`);
            console.log(`   ✅ All conversion paths properly logged`);
            console.log(`   ✅ Original server responses captured`);
            console.log(`   ✅ Converted formats documented`);
            console.log(`   ✅ Mapping relationships recorded`);
          } else {
            console.log(`\n⚠️  ISSUE: Missing some dual logging entries`);
            console.log(`   Expected: ${expectedTriples} of each type`);
            console.log(`   Found: Original=${originalCount}, Converted=${convertedCount}, Mapping=${mappingCount}`);
          }
          
        } else {
          console.log(`❌ No finish_reason.log found`);
        }
      }
    } else {
      console.log(`❌ Log directory not found`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// 运行测试
testOutputProcessor().then(() => {
  console.log('\n🏁 Output processor test completed');
}).catch(error => {
  console.error('\n💥 Test execution failed:', error);
  process.exit(1);
});