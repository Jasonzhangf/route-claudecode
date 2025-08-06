#!/usr/bin/env node

/**
 * 测试真实API请求中的dual finish reason logging
 * 使用5508端口(ShuaiHong provider)进行测试
 */

console.log('🧪 Testing Real API Dual Finish Reason Logging...\n');

async function testRealAPI() {
  try {
    console.log('📡 Making test API request to port 5508 (ShuaiHong provider)...');
    
    const fetch = (await import('node-fetch')).default;
    
    // 构造测试请求
    const response = await fetch('http://localhost:5508/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-4-sonnet',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: '请简单回答：什么是AI？'
        }]
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ API request successful');
      console.log(`📝 Response stop_reason: "${result.stop_reason}"`);
      console.log(`💬 Response content: "${result.content[0]?.text?.slice(0, 100)}..."`);
    } else {
      console.log(`❌ API request failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
    }

    // 等待2秒让日志写入完成
    console.log('\n⏳ Waiting for logs to be written...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 检查5508端口的日志
    console.log('\n🔍 Checking port 5508 logs for dual logging entries...');
    
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const logDir = path.join(os.homedir(), '.route-claude-code', 'logs', 'port-5508');
    
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
          
          console.log(`📁 Found finish_reason.log: ${finishReasonLogPath}`);
          console.log(`📊 Total entries: ${logLines.length}`);
          
          // 查找最近5分钟内的日志条目
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          let recentEntries = [];
          
          logLines.forEach((line, index) => {
            try {
              const entry = JSON.parse(line);
              const entryTime = new Date(entry.timestamp).getTime();
              
              if (entryTime > fiveMinutesAgo) {
                recentEntries.push(entry);
              }
            } catch (e) {
              // Ignore invalid JSON lines
            }
          });
          
          console.log(`\n🕐 Recent entries (last 5 minutes): ${recentEntries.length}`);
          
          if (recentEntries.length > 0) {
            console.log('\n📋 Recent dual logging entries:');
            
            let originalCount = 0;
            let convertedCount = 0;
            let mappingCount = 0;
            
            recentEntries.forEach((entry, index) => {
              if (entry.message && entry.message.includes('[ORIGINAL-SERVER-RESPONSE]')) {
                originalCount++;
                console.log(`   🔵 Original: ${entry.message}`);
              } else if (entry.message && entry.message.includes('[CONVERTED-ANTHROPIC-FORMAT]')) {
                convertedCount++;
                console.log(`   🟢 Converted: ${entry.message}`);
              } else if (entry.message && entry.message.includes('[CONVERSION-MAPPING]')) {
                mappingCount++;
                console.log(`   🔄 Mapping: ${entry.message}`);
              }
            });
            
            console.log(`\n📈 Summary:`);
            console.log(`   • Original server responses: ${originalCount}`);
            console.log(`   • Converted formats: ${convertedCount}`);
            console.log(`   • Conversion mappings: ${mappingCount}`);
            
            if (originalCount > 0 && convertedCount > 0 && mappingCount > 0) {
              console.log(`\n🎉 SUCCESS: Real API dual logging is working!`);
              console.log(`   ✅ Original server responses captured`);
              console.log(`   ✅ Format conversions recorded`);
              console.log(`   ✅ Mapping relationships documented`);
            } else {
              console.log(`\n⚠️  PARTIAL: Some dual logging components missing`);
            }
          } else {
            console.log(`\n🔍 No recent entries found. The request might not have triggered dual logging.`);
            console.log(`   This could mean the response didn't require format conversion.`);
          }
          
        } else {
          console.log(`❌ No finish_reason.log found at: ${finishReasonLogPath}`);
        }
      } else {
        console.log(`❌ No rotation directories in: ${logDir}`);
      }
    } else {
      console.log(`❌ Log directory not found: ${logDir}`);
      console.log(`   Make sure port 5508 server is running and has processed requests.`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Hint: Make sure the Claude Code Router is running on port 5508');
      console.log('   You can start it with: rcc start ~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json');
    }
  }
}

// 运行测试
testRealAPI().then(() => {
  console.log('\n🏁 Real API test completed');
}).catch(error => {
  console.error('\n💥 Test execution failed:', error);
  process.exit(1);
});