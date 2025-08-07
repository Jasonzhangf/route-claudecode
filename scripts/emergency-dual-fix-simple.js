#!/usr/bin/env node

/**
 * 紧急双重修复：大文本工具解析 + 顺序处理死锁
 */

const fs = require('fs');

console.log('🚨 紧急双重修复开始...');

// 修复1：队列管理器超时机制
function fixQueueManagerTimeout() {
  console.log('🔧 修复队列管理器超时机制...');
  
  const queueManagerPath = 'src/session/conversation-queue-manager.ts';
  let content = fs.readFileSync(queueManagerPath, 'utf8');
  
  // 添加超时配置
  const timeoutConfig = `
  // 🔧 紧急修复：超时配置
  private readonly REQUEST_TIMEOUT = 60000; // 60秒请求超时
  private readonly QUEUE_WAIT_TIMEOUT = 30000; // 30秒队列等待超时
  private requestTimeouts: Map<string, NodeJS.Timeout> = new Map();
`;

  // 在构造函数后添加
  if (!content.includes('REQUEST_TIMEOUT')) {
    const constructorMatch = content.match(/(constructor\(private port: number\) \{[\s\S]*?})/);
    if (constructorMatch) {
      const insertPos = content.indexOf(constructorMatch[1]) + constructorMatch[1].length;
      content = content.slice(0, insertPos) + '\n' + timeoutConfig + '\n' + content.slice(insertPos);
      console.log('✅ 添加了超时配置');
    }
  }
  
  // 修复processNextInQueue方法
  const processNextPattern = /if \(isAlreadyProcessing\) \{[\s\S]*?return;\s*}/;
  const processNextMatch = content.match(processNextPattern);
  
  if (processNextMatch) {
    const newProcessNext = `if (isAlreadyProcessing) {
      logger.debug('Conversation already processing, setting timeout', {
        conversationKey,
        queueLength: queue.length,
        timeout: this.QUEUE_WAIT_TIMEOUT
      }, 'conversation-queue');
      
      // 🔧 紧急修复：设置等待超时
      setTimeout(() => {
        logger.warn('Queue wait timeout, forcing cleanup', {
          conversationKey,
          timeout: this.QUEUE_WAIT_TIMEOUT
        }, 'conversation-queue');
        
        // 强制清理卡住的请求
        for (const [requestId, request] of this.processingRequests.entries()) {
          if (\`\${request.sessionId}:\${request.conversationId}\` === conversationKey) {
            const startTime = this.requestStartTimes.get(requestId);
            const processingTime = startTime ? Date.now() - startTime.getTime() : 0;
            
            if (processingTime > this.REQUEST_TIMEOUT) {
              logger.warn('Cleaning stuck request', { requestId, processingTime }, 'conversation-queue');
              this.processingRequests.delete(requestId);
              this.requestStartTimes.delete(requestId);
            }
          }
        }
        
        // 重新尝试处理
        this.processNextInQueue(conversationKey).catch(error => {
          logger.error('Error in timeout retry', { conversationKey, error }, 'conversation-queue');
        });
      }, this.QUEUE_WAIT_TIMEOUT);
      
      return;
    }`;
    
    content = content.replace(processNextMatch[0], newProcessNext);
    console.log('✅ 修复了processNextInQueue超时处理');
  }
  
  // 在请求开始时设置超时
  const processStartPattern = /this\.processingRequests\.set\(nextRequest\.requestId, nextRequest\);/;
  content = content.replace(processStartPattern, `
    this.processingRequests.set(nextRequest.requestId, nextRequest);
    
    // 🔧 紧急修复：设置请求超时
    const requestTimeout = setTimeout(() => {
      logger.warn('Request timeout, forcing completion', {
        requestId: nextRequest.requestId,
        timeout: this.REQUEST_TIMEOUT
      }, nextRequest.requestId, 'conversation-queue');
      
      this.failRequest(nextRequest.requestId, new Error('Request timeout'));
    }, this.REQUEST_TIMEOUT);
    
    this.requestTimeouts.set(nextRequest.requestId, requestTimeout);
  `);
  
  // 在请求完成时清理超时
  const completePattern = /this\.processingRequests\.delete\(requestId\);/;
  content = content.replace(completePattern, `
    this.processingRequests.delete(requestId);
    
    // 清理请求超时
    const timeout = this.requestTimeouts.get(requestId);
    if (timeout) {
      clearTimeout(timeout);
      this.requestTimeouts.delete(requestId);
    }
  `);
  
  fs.writeFileSync(queueManagerPath, content);
  console.log('✅ conversation-queue-manager.ts 修复完成');
}

// 修复2：大文本工具调用检测
function fixLargeTextToolCall() {
  console.log('🔧 修复大文本工具调用检测...');
  
  const enhancedClientPath = 'src/providers/openai/enhanced-client.ts';
  let content = fs.readFileSync(enhancedClientPath, 'utf8');
  
  // 添加工具调用检测方法
  const toolDetectionMethod = `
  /**
   * 🔧 紧急修复：检测文本中的工具调用模式
   */
  private detectToolCallInText(text: string): boolean {
    const patterns = [
      /<function_calls>/i,
      /<invoke\\s+name=/i,
      /{"type":\\s*"function"/i,
      /listDirectory|fsWrite|readFile/i
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }
`;

  // 在类中添加检测方法
  if (!content.includes('detectToolCallInText')) {
    const classMatch = content.match(/(export class OpenAIEnhancedClient[\s\S]*?constructor[\s\S]*?})/);
    if (classMatch) {
      const insertPos = content.indexOf(classMatch[1]) + classMatch[1].length;
      content = content.slice(0, insertPos) + '\n' + toolDetectionMethod + '\n' + content.slice(insertPos);
      console.log('✅ 添加了工具调用检测方法');
    }
  }
  
  // 修复finish_reason处理
  const finishReasonPattern = /const finishReason = choice\.finish_reason;/g;
  content = content.replace(finishReasonPattern, `
    let finishReason = choice.finish_reason;
    
    // 🔧 紧急修复：检查是否是被截断的工具调用
    if (finishReason === 'length') {
      const hasToolCall = this.detectToolCallInText(this.accumulatedContent || '');
      if (hasToolCall) {
        this.logger.warn('Detected tool call in length-limited response, changing to tool_calls', {
          originalReason: finishReason
        });
        finishReason = 'tool_calls';
      }
    }
  `);
  
  // 添加内容累积
  if (!content.includes('accumulatedContent')) {
    const accumulationCode = `
  private accumulatedContent: string = '';
  
  private addToAccumulation(text: string): void {
    this.accumulatedContent += text;
    // 限制长度避免内存问题
    if (this.accumulatedContent.length > 8000) {
      this.accumulatedContent = this.accumulatedContent.slice(-6000);
    }
  }
`;
    
    const constructorMatch = content.match(/(constructor[\s\S]*?})/);
    if (constructorMatch) {
      const insertPos = content.indexOf(constructorMatch[1]) + constructorMatch[1].length;
      content = content.slice(0, insertPos) + '\n' + accumulationCode + '\n' + content.slice(insertPos);
      console.log('✅ 添加了内容累积逻辑');
    }
  }
  
  // 在内容处理处添加累积
  content = content.replace(
    /if \(choice\.delta\.content\) \{/g,
    `if (choice.delta.content) {
      this.addToAccumulation(choice.delta.content);`
  );
  
  fs.writeFileSync(enhancedClientPath, content);
  console.log('✅ enhanced-client.ts 修复完成');
}

// 创建简单的验证测试
function createSimpleTest() {
  console.log('🧪 创建验证测试...');
  
  const testScript = `#!/usr/bin/env node
const axios = require('axios');

async function testFix() {
  console.log('🧪 测试修复效果...');
  
  // 测试大文本工具调用
  const largeRequest = {
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 50,
    messages: [{ 
      role: "user", 
      content: "请详细解释JavaScript。".repeat(100) + "\\n现在请使用listDirectory工具查看目录。"
    }],
    tools: [{
      name: "listDirectory",
      description: "List directory",
      input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
    }],
    stream: true
  };
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', largeRequest, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
      responseType: 'stream'
    });
    
    let hasToolUse = false;
    let finishReason = null;
    
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
              hasToolUse = true;
            }
            if (data.delta?.stop_reason) {
              finishReason = data.delta.stop_reason;
            }
          } catch (e) {}
        }
      }
    });
    
    response.data.on('end', () => {
      console.log(\`结果: 工具调用=\${hasToolUse}, finish_reason=\${finishReason}\`);
      if (hasToolUse && finishReason === 'tool_use') {
        console.log('✅ 大文本工具调用修复成功');
      } else {
        console.log('❌ 大文本工具调用仍有问题');
      }
    });
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('❌ 请求超时，可能仍有死锁问题');
    } else {
      console.log(\`❌ 测试失败: \${error.message}\`);
    }
  }
}

testFix().catch(console.error);
`;

  fs.writeFileSync('scripts/test-emergency-fix.js', testScript);
  fs.chmodSync('scripts/test-emergency-fix.js', '755');
  console.log('✅ 测试脚本已创建');
}

// 主函数
function main() {
  try {
    // 备份文件
    const files = [
      'src/session/conversation-queue-manager.ts',
      'src/providers/openai/enhanced-client.ts'
    ];
    
    files.forEach(file => {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, file + '.backup-' + Date.now());
        console.log('📋 备份:', file);
      }
    });
    
    // 执行修复
    fixQueueManagerTimeout();
    fixLargeTextToolCall();
    createSimpleTest();
    
    console.log('\n🎉 紧急修复完成！');
    console.log('\n下一步:');
    console.log('1. npm run build');
    console.log('2. 重启服务器');
    console.log('3. node scripts/test-emergency-fix.js');
    
  } catch (error) {
    console.error('💀 修复失败:', error);
    process.exit(1);
  }
}

main();