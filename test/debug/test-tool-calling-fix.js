#!/usr/bin/env node

/**
 * 测试工具调用多轮对话修复
 * 验证工具调用完成后是否正确发送stop_reason: 'tool_use'来触发继续
 */

const http = require('http');

async function testToolCallingContinuation() {
  console.log('\n🧪 测试工具调用多轮对话修复...\n');

  const testRequest = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user", 
        content: "请帮我创建一个todo列表，包含以下任务：学习JavaScript、阅读技术文档、写代码示例。然后再搜索一下最新的前端开发趋势。"
      }
    ],
    tools: [
      {
        name: "TodoWrite", 
        description: "Create todo items",
        input_schema: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string" },
                  status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  id: { type: "string" }
                },
                required: ["content", "status", "priority", "id"]
              }
            }
          },
          required: ["todos"]
        }
      },
      {
        name: "WebSearch",
        description: "Search the web for information",
        input_schema: {
          type: "object", 
          properties: {
            query: { type: "string" },
            num_results: { type: "number" }
          },
          required: ["query"]
        }
      }
    ],
    stream: true
  };

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(testRequest);
    
    const options = {
      hostname: 'localhost',
      port: 5507, // ModelScope OpenAI port
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'x-api-key': 'test-key'
      }
    };

    console.log(`📡 发送请求到 http://localhost:5507/v1/messages`);
    console.log(`📋 请求内容: ${JSON.stringify({...testRequest, tools: `[${testRequest.tools.length} tools]`}, null, 2)}`);

    const req = http.request(options, (res) => {
      console.log(`📊 响应状态: ${res.statusCode}`);
      console.log(`📋 响应头:`, res.headers);

      let rawData = '';
      let events = [];
      let stopReasonCount = 0;
      let messageStopCount = 0;
      let toolUseBlocks = 0;

      res.on('data', (chunk) => {
        rawData += chunk;
        console.log(`📦 接收数据块: ${chunk.length} bytes`);
        
        // 解析SSE事件
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              events.push(data);
              
              // 检查stop_reason - 更全面的检查
              let foundStopReason = null;
              if (data.delta && data.delta.stop_reason) {
                foundStopReason = data.delta.stop_reason;
              } else if (data.message && data.message.stop_reason) {
                foundStopReason = data.message.stop_reason;
              } else if (data.stop_reason) {
                foundStopReason = data.stop_reason;
              }
              
              if (foundStopReason) {
                stopReasonCount++;
                console.log(`🔴 发现stop_reason: ${foundStopReason} (在${data.type || 'unknown'}事件中)`);
                
                if (foundStopReason === 'tool_use') {
                  console.log(`✅ 正确的工具调用stop_reason！`);
                }
              }
              
              // 检查message_stop事件
              if (data.type === 'message_stop') {
                messageStopCount++;
                console.log(`🛑 发现message_stop事件 (第${messageStopCount}次)`);
              }
              
              // 检查工具调用块
              if (data.type === 'content_block_start' && data.content_block && data.content_block.type === 'tool_use') {
                toolUseBlocks++;
                console.log(`🔧 发现工具调用块: ${data.content_block.name} (第${toolUseBlocks}个)`);
              }
              
            } catch (e) {
              // 忽略非JSON数据
            }
          }
        }
      });

      res.on('end', () => {
        console.log('\n📋 分析结果:');
        console.log(`- 总事件数: ${events.length}`);
        console.log(`- stop_reason数量: ${stopReasonCount}`);
        console.log(`- message_stop数量: ${messageStopCount}`);
        console.log(`- 工具调用块数: ${toolUseBlocks}`);
        
        // 检查修复效果
        let analysisResult = {
          success: false,
          issues: [],
          improvements: []
        };
        
        if (toolUseBlocks > 0) {
          console.log(`✅ 检测到工具调用`);
          analysisResult.improvements.push('检测到工具调用');
          
          if (stopReasonCount > 0) {
            console.log(`✅ 有stop_reason事件 (${stopReasonCount}个)`);
            analysisResult.improvements.push(`有stop_reason事件 (${stopReasonCount}个)`);
            
            if (messageStopCount > 0) {
              console.log(`✅ 有message_stop事件 (${messageStopCount}个) - 应该能触发继续`);
              analysisResult.improvements.push(`有message_stop事件 (${messageStopCount}个)`);
              analysisResult.success = true;
            } else {
              console.log(`❌ 缺少message_stop事件 - 可能无法触发继续`);
              analysisResult.issues.push('缺少message_stop事件');
            }
          } else {
            console.log(`❌ 缺少stop_reason - 无法触发工具调用继续`);
            analysisResult.issues.push('缺少stop_reason');
          }
        } else {
          console.log(`⚠️  没有检测到工具调用 - 可能模型没有选择调用工具`);
          analysisResult.issues.push('没有检测到工具调用');
        }

        console.log('\n🎯 修复效果评估:');
        if (analysisResult.success) {
          console.log('✅ 修复成功 - 工具调用应该能正确触发多轮对话');
        } else {
          console.log('❌ 修复未完全生效');
          analysisResult.issues.forEach(issue => console.log(`  - ${issue}`));
        }

        resolve({
          statusCode: res.statusCode,
          events: events.length,
          stopReasonCount,
          messageStopCount,
          toolUseBlocks,
          analysisResult,
          rawDataLength: rawData.length
        });
      });
    });

    req.on('error', (err) => {
      console.error('❌ 请求错误:', err.message);
      reject(err);
    });

    req.on('timeout', () => {
      console.error('⏰ 请求超时');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(30000); // 30秒超时
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    const result = await testToolCallingContinuation();
    console.log('\n📊 最终结果:', result);
    
    // 保存测试结果
    const fs = require('fs');
    const testResult = {
      timestamp: new Date().toISOString(),
      test: 'tool-calling-continuation-fix',
      result: result,
      success: result.analysisResult.success
    };
    
    fs.writeFileSync('/tmp/test-tool-calling-fix.json', JSON.stringify(testResult, null, 2));
    console.log('\n💾 测试结果已保存到 /tmp/test-tool-calling-fix.json');
    
    process.exit(result.analysisResult.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}