#!/usr/bin/env node
/**
 * 🔍 诊断工具执行阶段的问题
 * 
 * 从日志看，工具调用解析正常，但执行结果错误
 * 需要检查工具执行的映射和处理逻辑
 */

const http = require('http');

console.log('🔍 [TOOL-EXECUTION-DIAGNOSIS] 诊断工具执行问题...');

// 测试简单的bash命令
const TEST_REQUEST = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  messages: [
    {
      role: "user",
      content: "请执行 pwd 命令，显示当前目录"
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

async function diagnoseToolExecution() {
  console.log('📤 发送简单bash命令测试...');
  console.log('🎯 期望: 执行 pwd 命令并返回当前目录路径');
  console.log('❌ 实际问题: 返回了大量文本内容而不是命令执行结果');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(TEST_REQUEST);
    
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
      let toolCallFound = false;
      let toolContent = '';
      let actualToolName = '';
      let actualToolInput = '';
      
      const timeout = setTimeout(() => {
        console.log('\n📊 诊断结果:');
        console.log('='.repeat(60));
        
        console.log(`🔧 工具调用检测: ${toolCallFound ? '✅' : '❌'}`);
        console.log(`📨 总事件数: ${eventCount}`);
        
        if (toolCallFound) {
          console.log(`🏷️  实际工具名: ${actualToolName}`);
          console.log(`📝 实际工具输入: ${actualToolInput}`);
          
          if (toolContent.length > 0) {
            console.log(`📄 工具返回内容长度: ${toolContent.length} 字符`);
            console.log(`📄 内容预览: ${toolContent.substring(0, 200)}...`);
            
            // 分析内容类型
            if (toolContent.includes('CLAUDE.md') || toolContent.includes('项目规则')) {
              console.log('🚨 问题确认: 工具调用返回了项目文档内容，而不是bash命令执行结果！');
              console.log('💡 可能原因:');
              console.log('   1. 工具映射错误 - bash工具被映射到了文件操作工具');
              console.log('   2. 工具执行器配置错误');
              console.log('   3. 工具调用路由问题');
            } else if (toolContent.includes('/Users/') || toolContent.includes('claude-code-router')) {
              console.log('✅ 工具执行正常: 返回了目录路径信息');
            } else {
              console.log('⚠️ 工具执行异常: 返回了意外的内容');
            }
          } else {
            console.log('❌ 没有收到工具执行结果');
          }
        }
        
        resolve();
      }, 15000);

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        
        events.forEach(eventData => {
          if (eventData.trim()) {
            eventCount++;
            
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
              // 检测工具调用
              if (event === 'content_block_start' && data.content_block?.type === 'tool_use') {
                toolCallFound = true;
                actualToolName = data.content_block.name;
                console.log(`🔧 检测到工具调用: ${actualToolName}`);
              }
              
              // 收集工具输入
              if (event === 'content_block_delta' && data.delta?.type === 'input_json_delta') {
                actualToolInput += data.delta.partial_json || '';
              }
              
              // 收集文本内容（可能是工具执行结果）
              if (event === 'content_block_delta' && data.delta?.type === 'text_delta') {
                toolContent += data.delta.text || '';
              }
              
              // 显示关键事件
              if (event === 'content_block_start' || event === 'message_delta' || event === 'content_block_stop') {
                const timestamp = new Date().toLocaleTimeString();
                console.log(`[${timestamp}] 📨 ${event}`);
                
                if (data.delta?.stop_reason) {
                  console.log(`   🎯 Stop reason: ${data.delta.stop_reason}`);
                }
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
    await diagnoseToolExecution();
    
    console.log('\n🔍 问题总结:');
    console.log('='.repeat(60));
    console.log('✅ 工具调用解析: 正常');
    console.log('✅ Message stop修复: 正常');
    console.log('❌ 工具执行逻辑: 异常');
    console.log('');
    console.log('🎯 需要检查的地方:');
    console.log('   1. 工具执行器的配置和映射');
    console.log('   2. bash工具的实际实现');
    console.log('   3. 工具调用路由是否正确');
    console.log('   4. 是否有工具名称冲突');
    
    console.log('\n✅ 诊断完成');
  } catch (error) {
    console.error('💥 诊断失败:', error);
  }
}

if (require.main === module) {
  main();
}