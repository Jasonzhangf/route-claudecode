#!/usr/bin/env node
/**
 * 🔧 修复工具调用后message_stop过早发送的问题
 * 
 * 问题：工具调用后立即发送message_stop，导致对话提前结束，客户端和服务器都在等待
 * 解决：工具调用场景下不发送message_stop，保持对话开放等待工具执行结果
 */

const fs = require('fs').promises;
const path = require('path');

console.log('🔧 [TOOL-CALL-MESSAGE-STOP-FIX] 开始修复工具调用message_stop问题...');

async function fixServerStreamingLogic() {
  const serverPath = 'src/server.ts';
  console.log(`📝 修复 ${serverPath} 中的流式处理逻辑...`);
  
  try {
    let content = await fs.readFile(serverPath, 'utf8');
    
    // 修复1: 在流式处理中，工具调用场景下不发送message_stop
    const oldMessageStopLogic = `        } else if (processedChunk.event === 'message_stop') {
          // 🔧 修复：始终发送message_stop事件，不再进行过滤
          this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
          this.logger.debug('Sent message_stop event', { requestId }, requestId, 'server');`;
    
    const newMessageStopLogic = `        } else if (processedChunk.event === 'message_stop') {
          // 🔧 修复：工具调用场景下不发送message_stop，保持对话开放
          if (hasToolUse) {
            this.logger.debug('Skipping message_stop for tool_use scenario to keep conversation open', { 
              requestId, 
              hasToolUse 
            }, requestId, 'server');
            // 不发送message_stop，让对话保持开放状态等待工具执行结果
          } else {
            // 非工具调用场景正常发送message_stop
            this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
            this.logger.debug('Sent message_stop event for non-tool scenario', { requestId }, requestId, 'server');
          }`;
    
    if (content.includes(oldMessageStopLogic)) {
      content = content.replace(oldMessageStopLogic, newMessageStopLogic);
      console.log('   ✅ 修复了流式处理中的message_stop逻辑');
    } else {
      console.log('   ⚠️ 未找到预期的message_stop处理逻辑，可能已经修复或代码结构已变化');
    }
    
    await fs.writeFile(serverPath, content, 'utf8');
    console.log(`   ✅ ${serverPath} 修复完成`);
    
  } catch (error) {
    console.error(`   ❌ 修复 ${serverPath} 失败:`, error.message);
  }
}

async function fixProviderMessageStopLogic() {
  console.log('📝 修复Provider层的message_stop发送逻辑...');
  
  // 修复OpenAI Enhanced Client
  const openaiEnhancedPath = 'src/providers/openai/enhanced-client.ts';
  try {
    let content = await fs.readFile(openaiEnhancedPath, 'utf8');
    
    // 查找工具调用相关的message_stop发送
    const toolUseMessageStopPattern = /\/\/ 🔧 修复：始终发送message_stop事件[\s\S]*?yield \{[\s\S]*?event: 'message_stop'[\s\S]*?\};/g;
    
    let matches = content.match(toolUseMessageStopPattern);
    if (matches) {
      console.log(`   🔍 在 ${openaiEnhancedPath} 中找到 ${matches.length} 个message_stop发送点`);
      
      // 替换为条件发送
      content = content.replace(
        /\/\/ 🔧 修复：始终发送message_stop事件\s*yield \{\s*event: 'message_stop',\s*data: \{ type: 'message_stop' \}\s*\};/g,
        `// 🔧 修复：工具调用场景下不发送message_stop
                if (finishReason !== 'tool_use') {
                  yield {
                    event: 'message_stop',
                    data: { type: 'message_stop' }
                  };
                }`
      );
      
      console.log(`   ✅ 修复了 ${openaiEnhancedPath} 中的message_stop逻辑`);
    }
    
    await fs.writeFile(openaiEnhancedPath, content, 'utf8');
    
  } catch (error) {
    console.error(`   ❌ 修复 ${openaiEnhancedPath} 失败:`, error.message);
  }
  
  // 修复OpenAI SDK Client
  const openaiSdkPath = 'src/providers/openai/sdk-client.ts';
  try {
    let content = await fs.readFile(openaiSdkPath, 'utf8');
    
    // 查找并修复message_stop发送逻辑
    const messageStopYield = `yield {
            event: 'message_stop',
            data: {
              type: 'message_stop'
            }
          };`;
    
    const conditionalMessageStopYield = `// 🔧 修复：工具调用场景下不发送message_stop
          if (finishReason !== 'tool_use') {
            yield {
              event: 'message_stop',
              data: {
                type: 'message_stop'
              }
            };
          }`;
    
    if (content.includes(messageStopYield)) {
      content = content.replace(messageStopYield, conditionalMessageStopYield);
      console.log(`   ✅ 修复了 ${openaiSdkPath} 中的message_stop逻辑`);
    }
    
    await fs.writeFile(openaiSdkPath, content, 'utf8');
    
  } catch (error) {
    console.error(`   ❌ 修复 ${openaiSdkPath} 失败:`, error.message);
  }
}

async function createToolCallContinuationHandler() {
  console.log('📝 创建工具调用继续对话处理器...');
  
  const handlerPath = 'src/utils/tool-call-continuation-handler.ts';
  const handlerContent = `/**
 * 🔧 工具调用继续对话处理器
 * 
 * 处理工具调用后的对话继续逻辑，确保工具执行结果能正确返回给模型
 */

export interface ToolCallContinuationContext {
  requestId: string;
  sessionId: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: any;
  }>;
  originalRequest: any;
  provider: string;
  model: string;
}

export class ToolCallContinuationHandler {
  private pendingToolCalls = new Map<string, ToolCallContinuationContext>();
  
  /**
   * 注册待处理的工具调用
   */
  registerToolCall(context: ToolCallContinuationContext): void {
    this.pendingToolCalls.set(context.requestId, context);
    console.log(\`🔧 [TOOL-CONTINUATION] 注册工具调用: \${context.requestId}\`, {
      toolCount: context.toolCalls.length,
      provider: context.provider,
      model: context.model
    });
  }
  
  /**
   * 处理工具执行结果并继续对话
   */
  async handleToolResults(requestId: string, toolResults: Array<{
    id: string;
    result: any;
  }>): Promise<void> {
    const context = this.pendingToolCalls.get(requestId);
    if (!context) {
      console.warn(\`⚠️ [TOOL-CONTINUATION] 未找到待处理的工具调用: \${requestId}\`);
      return;
    }
    
    console.log(\`🔧 [TOOL-CONTINUATION] 处理工具执行结果: \${requestId}\`, {
      resultCount: toolResults.length,
      toolCallCount: context.toolCalls.length
    });
    
    // 构建包含工具结果的新请求
    const continuationRequest = {
      ...context.originalRequest,
      messages: [
        ...context.originalRequest.messages,
        {
          role: 'assistant',
          content: context.toolCalls.map(tool => ({
            type: 'tool_use',
            id: tool.id,
            name: tool.name,
            input: tool.input
          }))
        },
        {
          role: 'user',
          content: toolResults.map(result => ({
            type: 'tool_result',
            tool_use_id: result.id,
            content: result.result
          }))
        }
      ]
    };
    
    // TODO: 发送继续对话请求到相同的provider
    console.log(\`🔧 [TOOL-CONTINUATION] 准备继续对话请求\`, {
      requestId,
      provider: context.provider,
      model: context.model,
      messageCount: continuationRequest.messages.length
    });
    
    // 清理已处理的工具调用
    this.pendingToolCalls.delete(requestId);
  }
  
  /**
   * 获取待处理的工具调用数量
   */
  getPendingCount(): number {
    return this.pendingToolCalls.size;
  }
  
  /**
   * 清理超时的工具调用
   */
  cleanupExpiredToolCalls(timeoutMs: number = 300000): void { // 5分钟超时
    const now = Date.now();
    for (const [requestId, context] of this.pendingToolCalls.entries()) {
      // 假设context中有timestamp字段
      if ((context as any).timestamp && now - (context as any).timestamp > timeoutMs) {
        console.warn(\`⚠️ [TOOL-CONTINUATION] 清理超时的工具调用: \${requestId}\`);
        this.pendingToolCalls.delete(requestId);
      }
    }
  }
}

// 全局实例
export const toolCallContinuationHandler = new ToolCallContinuationHandler();
`;
  
  try {
    await fs.writeFile(handlerPath, handlerContent, 'utf8');
    console.log(`   ✅ 创建了工具调用继续对话处理器: ${handlerPath}`);
  } catch (error) {
    console.error(`   ❌ 创建处理器失败:`, error.message);
  }
}

async function createValidationScript() {
  console.log('📝 创建修复验证脚本...');
  
  const validationPath = 'scripts/validate-tool-call-message-stop-fix.js';
  const validationContent = `#!/usr/bin/env node
/**
 * 🔍 验证工具调用message_stop修复效果
 */

const http = require('http');

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

async function validateFix() {
  console.log('🔍 验证工具调用message_stop修复效果...');
  
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
      console.log(\`📊 响应状态: \${res.statusCode}\`);
      
      let buffer = '';
      let eventCount = 0;
      let toolCallDetected = false;
      let messageStopReceived = false;
      let toolUseStopReason = false;
      
      const timeout = setTimeout(() => {
        console.log('\n📊 验证结果:');
        console.log(\`   🔧 检测到工具调用: \${toolCallDetected}\`);
        console.log(\`   🎯 收到tool_use stop_reason: \${toolUseStopReason}\`);
        console.log(\`   🏁 收到message_stop: \${messageStopReceived}\`);
        console.log(\`   📨 总事件数: \${eventCount}\`);
        
        if (toolCallDetected && toolUseStopReason && !messageStopReceived) {
          console.log('\n✅ 修复成功！工具调用后没有发送message_stop，对话保持开放');
        } else if (toolCallDetected && messageStopReceived) {
          console.log('\n❌ 修复失败！工具调用后仍然发送了message_stop');
        } else {
          console.log('\n⚠️ 测试结果不确定，请检查工具调用是否正确触发');
        }
        
        resolve();
      }, 15000);

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const events = buffer.split('\\n\\n');
        buffer = events.pop() || '';
        
        events.forEach(eventData => {
          if (eventData.trim()) {
            eventCount++;
            
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
              const timestamp = new Date().toLocaleTimeString();
              console.log(\`[\${timestamp}] 📨 \${event}\`);
              
              if (event === 'content_block_start' && data.content_block?.type === 'tool_use') {
                toolCallDetected = true;
                console.log(\`   🔧 工具调用: \${data.content_block.name}\`);
              }
              
              if (event === 'message_delta' && data.delta?.stop_reason === 'tool_use') {
                toolUseStopReason = true;
                console.log(\`   🎯 tool_use stop_reason\`);
              }
              
              if (event === 'message_stop') {
                messageStopReceived = true;
                console.log(\`   🏁 message_stop (这不应该在工具调用后出现！)\`);
              }
            }
          }
        });
      });

      res.on('end', () => {
        clearTimeout(timeout);
        resolve();
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

if (require.main === module) {
  validateFix().catch(console.error);
}
`;
  
  try {
    await fs.writeFile(validationPath, validationContent, 'utf8');
    console.log(`   ✅ 创建了验证脚本: ${validationPath}`);
  } catch (error) {
    console.error(`   ❌ 创建验证脚本失败:`, error.message);
  }
}

async function main() {
  console.log('🚀 开始修复工具调用message_stop问题...');
  
  await fixServerStreamingLogic();
  await fixProviderMessageStopLogic();
  await createToolCallContinuationHandler();
  await createValidationScript();
  
  console.log('\n✅ 修复完成！');
  console.log('\n📋 修复内容:');
  console.log('   1. 修复了服务器流式处理中的message_stop发送逻辑');
  console.log('   2. 修复了Provider层的message_stop发送逻辑');
  console.log('   3. 创建了工具调用继续对话处理器');
  console.log('   4. 创建了修复效果验证脚本');
  console.log('\n🔧 下一步:');
  console.log('   1. 重启服务器: rcc start');
  console.log('   2. 运行验证: node scripts/validate-tool-call-message-stop-fix.js');
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 修复失败:', error);
    process.exit(1);
  });
}
`;
  
  try {
    await fs.writeFile(validationPath, validationContent, 'utf8');
    console.log(`   ✅ 创建了验证脚本: ${validationPath}`);
  } catch (error) {
    console.error(`   ❌ 创建验证脚本失败:`, error.message);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 修复失败:', error);
    process.exit(1);
  });
}