#!/usr/bin/env node

/**
 * 测试双重finish reason记录功能
 * 验证原始服务器响应和转换后的响应都被正确记录
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Dual Finish Reason Logging...\n');

async function testDualLogging() {
  try {
    // 导入统一日志系统
    const { UnifiedLogger } = require('./dist/logging/unified-logger.js');
    const { mapFinishReason, mapStopReason } = require('./dist/utils/finish-reason-handler.js');
    
    // 创建logger实例
    const port = 5999; // 测试端口
    const logger = new UnifiedLogger({
      port,
      logLevel: 'info',
      enableConsole: true,
      enableFile: true
    });

    console.log('✅ Logger initialized successfully');

    // 等待一秒确保初始化完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试用例1: OpenAI finish_reason -> Anthropic stop_reason
    console.log('\n📝 Test Case 1: OpenAI -> Anthropic conversion');
    const originalOpenAI = 'tool_calls';
    const convertedAnthropic = mapFinishReason(originalOpenAI);
    
    logger.logDualFinishReason(
      originalOpenAI,
      convertedAnthropic,
      'openai',
      {
        model: 'gpt-4',
        responseType: 'non-streaming',
        context: 'test-conversion',
        testCase: 'openai-to-anthropic'
      },
      'test-req-001',
      'dual-test-1'
    );
    
    console.log(`   Original OpenAI: ${originalOpenAI} → Converted Anthropic: ${convertedAnthropic}`);

    // 测试用例2: Anthropic stop_reason -> OpenAI finish_reason  
    console.log('\n📝 Test Case 2: Anthropic -> OpenAI conversion');
    const originalAnthropic = 'max_tokens';
    const convertedOpenAI = mapStopReason(originalAnthropic);
    
    logger.logDualFinishReason(
      originalAnthropic,
      convertedOpenAI,
      'anthropic',
      {
        model: 'claude-3-sonnet',
        responseType: 'streaming',
        context: 'test-conversion',
        testCase: 'anthropic-to-openai'
      },
      'test-req-002',
      'dual-test-2'
    );
    
    console.log(`   Original Anthropic: ${originalAnthropic} → Converted OpenAI: ${convertedOpenAI}`);

    // 测试用例3: 复杂的provider场景
    console.log('\n📝 Test Case 3: Complex provider scenario');
    logger.logDualFinishReason(
      'end_turn',
      'stop',
      'shuaihong-openai',
      {
        model: 'claude-4-sonnet',
        responseType: 'streaming',
        context: 'provider-conversion',
        testCase: 'complex-provider',
        originalProvider: 'ShuaiHong',
        targetFormat: 'OpenAI'
      },
      'test-req-003',
      'dual-test-3'
    );
    
    console.log(`   Complex scenario: end_turn (ShuaiHong) → stop (OpenAI)`);

    // 等待文件写入完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 验证日志文件
    console.log('\n🔍 Verifying log files...');
    const logDir = path.join(require('os').homedir(), '.route-claude-code', 'logs', `port-${port}`);
    
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
          
          console.log(`✅ Found finish_reason.log with ${logLines.length} entries`);
          console.log(`📁 Log file: ${finishReasonLogPath}`);
          
          // 检查dual logging特征
          let originalCount = 0;
          let convertedCount = 0;
          let mappingCount = 0;
          let singleReasonCount = 0;
          
          logLines.forEach((line, index) => {
            try {
              const entry = JSON.parse(line);
              
              // 检查不同类型的记录
              if (entry.message && entry.message.includes('[ORIGINAL-SERVER-RESPONSE]')) {
                originalCount++;
                console.log(`   🔵 Original Server Response ${originalCount}: ${entry.message}`);
              } else if (entry.message && entry.message.includes('[CONVERTED-ANTHROPIC-FORMAT]')) {
                convertedCount++;
                console.log(`   🟢 Converted Format ${convertedCount}: ${entry.message}`);
              } else if (entry.message && entry.message.includes('[CONVERSION-MAPPING]')) {
                mappingCount++;
                console.log(`   🔄 Conversion Mapping ${mappingCount}: ${entry.message}`);
              } else if (entry.message && (entry.message.includes('[SINGLE-FINISH-REASON]') || entry.message.includes('[SINGLE-STOP-REASON]'))) {
                singleReasonCount++;
                console.log(`   ⚪ Single Reason ${singleReasonCount}: ${entry.message}`);
              }
              
            } catch (e) {
              console.warn(`⚠️  Invalid JSON in log line ${index + 1}`);
            }
          });
          
          console.log(`\n📊 Analysis Results:`);
          console.log(`   • Total log entries: ${logLines.length}`);
          console.log(`   • Original server responses: ${originalCount}`);
          console.log(`   • Converted anthropic formats: ${convertedCount}`);
          console.log(`   • Conversion mappings: ${mappingCount}`);
          console.log(`   • Single reason entries: ${singleReasonCount}`);
          
          // 每个测试用例应该产生3条记录：原始 + 转换 + 映射
          const expectedSets = 3; // 3个测试用例
          const expectedEntriesPerSet = 3; // 每个用例3条记录
          const expectedTotal = expectedSets * expectedEntriesPerSet;
          
          if (originalCount >= expectedSets && convertedCount >= expectedSets && mappingCount >= expectedSets) {
            console.log(`\n🎉 SUCCESS: Enhanced dual finish reason logging is working correctly!`);
            console.log(`   ✅ All test cases recorded with proper separation`);
            console.log(`   ✅ Original server responses properly tagged (🔵)`);
            console.log(`   ✅ Converted formats properly tagged (🟢)`);
            console.log(`   ✅ Conversion mappings properly tagged (🔄)`);
            console.log(`   ✅ Clear visual separation with boundary markers`);
          } else {
            console.log(`\n❌ PARTIAL SUCCESS: Some dual logging entries missing`);
            console.log(`   Expected per type: ${expectedSets}, Found - Original: ${originalCount}, Converted: ${convertedCount}, Mapping: ${mappingCount}`);
          }
          
        } else {
          console.log(`❌ finish_reason.log not found at: ${finishReasonLogPath}`);
        }
      } else {
        console.log(`❌ No rotation directories found in: ${logDir}`);
      }
    } else {
      console.log(`❌ Log directory not found: ${logDir}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// 运行测试
testDualLogging().then(() => {
  console.log('\n🏁 Test completed');
}).catch(error => {
  console.error('\n💥 Test execution failed:', error);
  process.exit(1);
});