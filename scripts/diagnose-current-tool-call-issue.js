#!/usr/bin/env node
/**
 * 🔍 诊断当前工具调用响应问题
 * 
 * 分析为什么工具调用后没有继续对话，客户端和服务器都在等待
 */
const http = require('http');

console.log('🔍 [TOOL-CALL-DIAGNOSIS] 开始诊断工具调用响应问题...');

// 简单的工具调用请求
const TOOL_CALL_REQUEST = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: "请帮我查看当前目录下的文件列表"
    }
  ],
  tools: [
    {
      name: "bash",
      description: "Execute bash commands",
      input_schema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute"
          }
        },
        required: ["command"]
      }
    }
  ],
  stream: true
};

async function testToolCallFlow() {
  console.log('📤 发送工具调用请求到端口3456...');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(TOOL_CALL_REQUEST);
    
    const options = {
      hostname: '127.0.0.1',
      port: 3456,
      path: '/v1/messages?beta=true',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'text/event-stream'
      }
    };

    const req = http.request(options, (res) => {
      console.log(`📊 响应状态: ${res.statusCode}`);
      
      if (res.statusCode !== 200) {
        console.error(`❌ HTTP错误: ${res.statusCode}`);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let buffer = '';
      let eventCount = 0;
      let toolCallDetected = false;
      let messageStopReceived = false;
      let conversationEnded = false;
      
      // 设置超时来观察问题
      const timeout = setTimeout(() => {
        console.log('\n⏰ 30秒超时 - 分析当前状态...');
        console.log(`   🔧 检测到工具调用: ${toolCallDetected}`);
        console.log(`   🏁 收到message_stop: ${messageStopReceived}`);
        console.log(`   🔚 对话结束: ${conversationEnded}`);
        console.log(`   📨 总事件数: ${eventCount}`);
        
        if (toolCallDetected && messageStopReceived && !conversationEnded) {
          console.log('\n🚨 问题诊断: 工具调用后收到message_stop，但对话没有继续！');
          console.log('   💡 可能原因: 工具执行结果没有返回给模型继续对话');
        }
        
        resolve();
      }, 30000);

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        
        events.forEach(eventData => {
          if (eventData.trim()) {
            eventCount++;
            const timestamp = new Date().toLocaleTimeString();
            
            // 解析事件
            const lines = eventData.trim().split('\n');
            let event = null;
            let data = null;
            
            lines.forEach(line => {
              if (line.startsWith('event: ')) {
                event = line.substring(7);
              } else if (line.startsWith('data: ')) {
                try {
                  data = JSON.parse(line.substring(6));
                } catch (e) {
                  data = line.substring(6);
                }
              }
            });
            
            if (event && data) {
              console.log(`[${timestamp}] 📨 事件 ${eventCount}: ${event}`);
              
              // 检测关键事件
              if (event === 'content_block_start' && data.content_block?.type === 'tool_use') {
                toolCallDetected = true;
                console.log(`   🔧 检测到工具调用: ${data.content_block.name}`);
              }
              
              if (event === 'message_delta' && data.delta?.stop_reason === 'tool_use') {
                console.log(`   🎯 收到stop_reason: tool_use - 等待工具执行...`);
              }
              
              if (event === 'message_stop') {
                messageStopReceived = true;
                console.log(`   🏁 收到message_stop事件`);
                
                if (toolCallDetected) {
                  console.log(`   🚨 警告: 工具调用后收到message_stop，但可能缺少工具结果处理！`);
                }
              }
            }
          }
        });
      });

      res.on('end', () => {
        clearTimeout(timeout);
        conversationEnded = true;
        console.log('\n📊 流式响应结束');
        console.log(`   🔧 检测到工具调用: ${toolCallDetected}`);
        console.log(`   🏁 收到message_stop: ${messageStopReceived}`);
        console.log(`   📨 总事件数: ${eventCount}`);
        
        if (toolCallDetected && messageStopReceived) {
          console.log('\n🔍 问题分析:');
          console.log('   ✅ 工具调用正确启动');
          console.log('   ✅ 收到message_stop事件');
          console.log('   ❌ 但是对话没有继续 - 这是问题所在！');
          console.log('\n💡 可能的解决方案:');
          console.log('   1. 检查工具执行后是否需要发送工具结果给模型');
          console.log('   2. 确认是否需要继续对话流程');
          console.log('   3. 验证message_stop后的处理逻辑');
        }
        
        resolve();
      });

      res.on('error', (error) => {
        clearTimeout(timeout);
        console.error('💥 响应错误:', error);
        reject(error);
      });
    });

    req.on('error', (error) => {
      console.error('💥 请求错误:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// 执行诊断
async function main() {
  try {
    await testToolCallFlow();
    console.log('\n✅ 诊断完成');
  } catch (error) {
    console.error('💥 诊断失败:', error);
  }
}

if (require.main === module) {
  main();
}