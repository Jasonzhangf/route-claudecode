#!/usr/bin/env node
/**
 * 🔍 诊断工具调用解析问题
 * 
 * 检查工具调用的完整流程，包括：
 * 1. 工具调用是否正确发起
 * 2. 工具参数是否正确解析
 * 3. 工具执行是否正常
 * 4. 响应格式是否正确
 */

const http = require('http');

console.log('🔍 [TOOL-CALL-PARSING-DIAGNOSIS] 开始诊断工具调用解析问题...');

const TOOL_CALL_REQUEST = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: "请帮我查看当前目录下的文件列表，使用ls -la命令"
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

async function diagnoseToolCallParsing() {
  console.log('📤 发送工具调用请求...');
  
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
      
      let buffer = '';
      let eventCount = 0;
      let toolCallData = {
        detected: false,
        id: null,
        name: null,
        input: null,
        completeInput: '',
        stopReason: null,
        messageStopReceived: false
      };
      
      const timeout = setTimeout(() => {
        console.log('\n📊 工具调用解析诊断结果:');
        console.log('='.repeat(50));
        
        console.log(`🔧 工具调用检测: ${toolCallData.detected ? '✅' : '❌'}`);
        if (toolCallData.detected) {
          console.log(`   工具ID: ${toolCallData.id}`);
          console.log(`   工具名称: ${toolCallData.name}`);
          console.log(`   完整输入: ${toolCallData.completeInput}`);
          
          try {
            const parsedInput = JSON.parse(toolCallData.completeInput);
            console.log(`   解析后的输入: ${JSON.stringify(parsedInput, null, 2)}`);
            console.log(`   参数解析: ✅`);
          } catch (error) {
            console.log(`   参数解析: ❌ - ${error.message}`);
            console.log(`   原始输入: "${toolCallData.completeInput}"`);
          }
        }
        
        console.log(`🎯 Stop Reason: ${toolCallData.stopReason || '未收到'}`);
        console.log(`🏁 Message Stop: ${toolCallData.messageStopReceived ? '❌ 收到了' : '✅ 未收到'}`);
        console.log(`📨 总事件数: ${eventCount}`);
        
        // 诊断结论
        console.log('\n🔍 诊断结论:');
        if (toolCallData.detected && toolCallData.stopReason === 'tool_use' && !toolCallData.messageStopReceived) {
          if (toolCallData.completeInput && toolCallData.completeInput.trim()) {
            try {
              JSON.parse(toolCallData.completeInput);
              console.log('✅ 工具调用解析完全正常！');
              console.log('   - 工具调用正确检测');
              console.log('   - 参数正确解析');
              console.log('   - Stop reason正确');
              console.log('   - Message stop正确跳过');
            } catch (error) {
              console.log('⚠️ 工具调用检测正常，但参数解析有问题');
              console.log(`   问题: JSON解析失败 - ${error.message}`);
            }
          } else {
            console.log('⚠️ 工具调用检测正常，但参数为空');
          }
        } else {
          console.log('❌ 工具调用解析存在问题');
          if (!toolCallData.detected) console.log('   - 未检测到工具调用');
          if (toolCallData.stopReason !== 'tool_use') console.log('   - Stop reason不正确');
          if (toolCallData.messageStopReceived) console.log('   - 错误发送了message_stop');
        }
        
        resolve();
      }, 20000);

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
              console.log(`[${timestamp}] 📨 ${event}`);
              
              // 检测工具调用开始
              if (event === 'content_block_start' && data.content_block?.type === 'tool_use') {
                toolCallData.detected = true;
                toolCallData.id = data.content_block.id;
                toolCallData.name = data.content_block.name;
                console.log(`   🔧 工具调用开始: ${toolCallData.name} (${toolCallData.id})`);
              }
              
              // 收集工具输入参数
              if (event === 'content_block_delta' && data.delta?.type === 'input_json_delta') {
                toolCallData.completeInput += data.delta.partial_json || '';
                console.log(`   📝 参数片段: "${data.delta.partial_json}"`);
              }
              
              // 检测stop reason
              if (event === 'message_delta' && data.delta?.stop_reason) {
                toolCallData.stopReason = data.delta.stop_reason;
                console.log(`   🎯 Stop Reason: ${toolCallData.stopReason}`);
              }
              
              // 检测message_stop
              if (event === 'message_stop') {
                toolCallData.messageStopReceived = true;
                console.log(`   🏁 Message Stop (不应该出现！)`);
              }
            }
          }
        });
      });

      res.on('end', () => {
        clearTimeout(timeout);
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
    await diagnoseToolCallParsing();
    console.log('\n✅ 诊断完成');
  } catch (error) {
    console.error('💥 诊断失败:', error);
  }
}

if (require.main === module) {
  main();
}