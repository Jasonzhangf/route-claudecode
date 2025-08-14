#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 Debug: Checking API request format by intercepting HTTP traffic...\n');

// 启动tcpdump来捕获HTTP请求 
const tcpdump = spawn('sudo', ['tcpdump', '-i', 'lo0', '-A', '-s', '0', 'port', '5509'], {
  stdio: 'pipe'
});

console.log('📡 Starting packet capture...');
console.log('🚨 Note: You might need to enter sudo password\n');

let capturedData = '';
tcpdump.stdout.on('data', (data) => {
  capturedData += data.toString();
});

tcpdump.stderr.on('data', (data) => {
  console.log('tcpdump stderr:', data.toString());
});

// 等待2秒后发送测试请求
setTimeout(() => {
  console.log('🧪 Sending test request...\n');
  
  const testRequest = {
    model: "ZhipuAI/GLM-4.5-Air",
    messages: [
      {
        role: "user",
        content: {
          type: "text", 
          text: "This is a test message with object content format"
        }
      }
    ],
    max_tokens: 50,
    stream: false
  };

  fetch('http://localhost:5509/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-key'
    },
    body: JSON.stringify(testRequest)
  })
  .then(response => response.json())
  .then(result => {
    console.log('📊 API Response Status:', response?.status || 'unknown');
    console.log('📄 API Response:', JSON.stringify(result, null, 2));
    
    // 停止tcpdump并分析数据
    setTimeout(() => {
      tcpdump.kill();
      
      console.log('\n🔍 Analyzing captured HTTP traffic...');
      
      // 查找POST请求数据
      const lines = capturedData.split('\n');
      let foundRequest = false;
      let requestData = '';
      
      for (const line of lines) {
        if (line.includes('POST /v1/messages')) {
          foundRequest = true;
          console.log('🎯 Found API request!');
        }
        
        if (foundRequest && line.includes('"messages"')) {
          requestData = line;
          break;
        }
      }
      
      if (requestData) {
        console.log('📤 Raw API Request Data:');
        console.log(requestData);
        
        // 尝试提取JSON数据
        const jsonMatch = requestData.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('\n📋 Parsed Request JSON:');
            console.log(JSON.stringify(parsed, null, 2));
            
            if (parsed.messages && parsed.messages[0] && parsed.messages[0].content) {
              console.log('\n🔍 Message Content Analysis:');
              console.log('Type:', typeof parsed.messages[0].content);
              console.log('Is Array:', Array.isArray(parsed.messages[0].content));
              console.log('Content:', parsed.messages[0].content);
            }
          } catch (e) {
            console.log('⚠️ Failed to parse JSON:', e.message);
          }
        }
      } else {
        console.log('❌ Could not find request data in captured traffic');
        console.log('🗂️ Full captured data:');
        console.log(capturedData.substring(0, 1000) + '...');
      }
    }, 1000);
    
  })
  .catch(error => {
    console.error('🚨 Request failed:', error.message);
    tcpdump.kill();
  });
  
}, 2000);