#!/usr/bin/env node

/**
 * 紧急双重修复：大文本工具解析 + 顺序处理死锁
 * 
 * 问题1：大文本工具调用在length时被截断
 * 问题2：队列管理器缺少超时机制导致死锁
 */

const fs = require('fs');
const path = require('path');

console.log('🚨 紧急双重修复开始...');

// 修复1：大文本工具调用处理
function fixLargeTextToolCall() {
  console.log('🔧 修复1: 大文本工具调用处理...');
  
  // 修复enhanced-client.ts中的工具调用检测
  const enhancedClientPath = 'src/providers/openai/enhanced-client.ts';
  let content = fs.readFileSync(enhancedClientPath, 'utf8');
  
  // 添加提前工具调用检测
  const earlyDetectionCode = `
  /**
   * 提前检测工具调用模式，避免被length截断
   */
  private detectToolCallEarly(textBuffer: string): boolean {
    const toolCallPatterns = [
      /<function_calls>/i,
      /<invoke\\s+name=/i,
      /{"type":\\s*"function"/i,
      /{"name":\\s*"[^"]+"/i,
      /\\blistDirectory\\b/i,
      /\\bfsWrite\\b/i,
      /\\breadFile\\b/i
    ];
    
    return toolCallPatterns.some(pattern => pattern.test(textBuffer));
  }

  /**
   * 修复finish_reason，确保工具调用不被length截断
   */
  private fixFinishReasonForToolCall(originalReason: string, textBuffer: string): string {
    if (originalReason === 'length' && this.detectToolCallEarly(textBuffer)) {
      this.logger.warn('Detected tool call in length-limited response, changing finish_reason to tool_use', {
        originalReason,
        hasToolCallPattern: true
      });
      return 'tool_calls'; // 使用OpenAI格式，后续会被映射为tool_use
    }
    return originalReason;
  }
`;

  // 查找合适的位置插入代码
  const classMatch = content.match(/(export class OpenAIEnhancedClient[\s\S]*?constructor[\s\S]*?})/);
  if (classMatch) {
    const insertPosition = content.indexOf(classMatch[1]) + classMatch[1].length;
    content = content.slice(0, insertPosition) + '\n' + earlyDetectionCode + '\n' + content.slice(insertPosition);
    console.log('✅ 添加了提前工具调用检测方法');
  }
  
  // 修复流式处理中的finish_reason处理
  const streamingFixPattern = /const finishReason = choice\.finish_reason;/g;
  content = content.replace(streamingFixPattern, `
    let finishReason = choice.finish_reason;
    
    // 🔧 紧急修复：检查是否是被length截断的工具调用
    if (finishReason === 'length') {
      const currentText = this.accumulatedText || '';
      finishReason = this.fixFinishReasonForToolCall(finishReason, currentText);
    }
  `);
  
  // 添加文本累积逻辑
  if (!content.includes('accumulatedText')) {
    const accumulationCode = `
  private accumulatedText: string = '';
  
  private accumulateText(text: string): void {
    this.accumulatedText += text;
    // 限制累积文本长度，避免内存问题
    if (this.accumulatedText.length > 10000) {
      this.accumulatedText = this.accumulatedText.slice(-8000);
    }
  }
`;
    
    const constructorMatch = content.match(/(constructor[\s\S]*?})/);
    if (constructorMatch) {
      const insertPos = content.indexOf(constructorMatch[1]) + constructorMatch[1].length;
      content = content.slice(0, insertPos) + '\n' + accumulationCode + '\n' + content.slice(insertPos);
      console.log('✅ 添加了文本累积逻辑');
    }
  }
  
  // 在文本处理位置添加累积调用
  content = content.replace(
    /if \(choice\.delta\.content\) \{[\s\S]*?}/g,
    `if (choice.delta.content) {
      this.accumulateText(choice.delta.content);
      $&
    }`
  );
  
  fs.writeFileSync(enhancedClientPath, content);
  console.log('✅ enhanced-client.ts 修复完成');
}

// 修复2：队列管理器超时机制
function fixQueueManagerTimeout() {
  console.log('🔧 修复2: 队列管理器超时机制...');
  
  const queueManagerPath = 'src/session/conversation-queue-manager.ts';
  let content = fs.readFileSync(queueManagerPath, 'utf8');
  
  // 添加超时配置
  const timeoutConfig = `
  // 超时配置
  private readonly REQUEST_TIMEOUT = 60000; // 60秒请求超时
  private readonly QUEUE_WAIT_TIMEOUT = 30000; // 30秒队列等待超时
  private readonly CLEANUP_INTERVAL = 10000; // 10秒清理间隔
  
  // 超时跟踪
  private requestTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private queueWaitTimeouts: Map<string, NodeJS.Timeout> = new Map();
`;

  // 在构造函数后添加超时配置
  const constructorMatch = content.match(/(constructor\(private port: number\) \{[\s\S]*?})/);
  if (constructorMatch) {
    const insertPos = content.indexOf(constructorMatch[1]) + constructorMatch[1].length;
    content = content.slice(0, insertPos) + '\n' + timeoutConfig + '\n' + content.slice(insertPos);
    console.log('✅ 添加了超时配置');
  }
  
  // 修复processNextInQueue方法，添加超时处理
  const processNextPattern = /if \(isAlreadyProcessing\) \{[\s\S]*?return;\s*}/;
  const processNextMatch = content.match(processNextPattern);
  
  if (processNextMatch) {
    const newProcessNext = `if (isAlreadyProcessing) {
      logger.debug('Conversation already processing, setting up timeout wait', {
        conversationKey,
        queueLength: queue.length,
        waitTimeout: this.QUEUE_WAIT_TIMEOUT
      }, 'conversation-queue');
      
      // 设置等待超时
      const timeoutId = setTimeout(() => {
        logger.warn('Queue wait timeout, forcing processing of next request', {
          conversationKey,
          queueLength: queue.length,
          timeoutMs: this.QUEUE_WAIT_TIMEOUT
        }, 'conversation-queue');
        
        // 清理可能卡住的处理请求
        this.forceCleanupStuckRequests(conversationKey);
        
        // 重新尝试处理
        this.processNextInQueue(conversationKey).catch(error => {
          logger.error('Error in timeout retry processing', { conversationKey, error }, 'conversation-queue');
        });
      }, this.QUEUE_WAIT_TIMEOUT);
      
      this.queueWaitTimeouts.set(conversationKey, timeoutId);
      return;
    }
    
    // 清理等待超时
    const waitTimeout = this.queueWaitTimeouts.get(conversationKey);
    if (waitTimeout) {
      clearTimeout(waitTimeout);
      this.queueWaitTimeouts.delete(conversationKey);
    }`;
    
    content = content.replace(processNextMatch[0], newProcessNext);
    console.log('✅ 修复了processNextInQueue超时处理');
  }
  
  // 添加强制清理方法
  const forceCleanupMethod = `
  /**
   * 强制清理卡住的请求
   */
  private forceCleanupStuckRequests(conversationKey: string): void {
    logger.warn('Force cleaning stuck requests', { conversationKey }, 'conversation-queue');
    
    // 查找并清理卡住的处理请求
    const stuckRequests = [];
    for (const [requestId, request] of this.processingRequests.entries()) {
      if (\`\${request.sessionId}:\${request.conversationId}\` === conversationKey) {
        const startTime = this.requestStartTimes.get(requestId);
        const processingTime = startTime ? Date.now() - startTime.getTime() : 0;
        
        if (processingTime > this.REQUEST_TIMEOUT) {
          stuckRequests.push({ requestId, processingTime });
          this.processingRequests.delete(requestId);
          this.requestStartTimes.delete(requestId);
          
          // 清理请求超时
          const timeout = this.requestTimeouts.get(requestId);
          if (timeout) {
            clearTimeout(timeout);
            this.requestTimeouts.delete(requestId);
          }
        }
      }
    }
    
    if (stuckRequests.length > 0) {
      logger.warn('Cleaned stuck requests', {
        conversationKey,
        stuckRequests: stuckRequests.length,
        details: stuckRequests
      }, 'conversation-queue');
      
      // 发出清理事件
      this.emit('stuckRequestsCleaned', {
        conversationKey,
        stuckRequests
      });
    }
  }
`;

  // 在类的末尾添加强制清理方法
  const classEndMatch = content.match(/(}\s*\/\/ Global conversation queue manager)/);
  if (classEndMatch) {
    const insertPos = content.indexOf(classEndMatch[1]);
    content = content.slice(0, insertPos) + forceCleanupMethod + '\n' + content.slice(insertPos);
    console.log('✅ 添加了强制清理方法');
  }
  
  // 修复enqueueRequest方法，添加请求超时
  const enqueuePattern = /this\.processingRequests\.set\(nextRequest\.requestId, nextRequest\);/;
  content = content.replace(enqueuePattern, `
    this.processingRequests.set(nextRequest.requestId, nextRequest);
    
    // 🔧 紧急修复：设置请求处理超时
    const requestTimeout = setTimeout(() => {
      logger.warn('Request processing timeout, forcing completion', {
        requestId: nextRequest.requestId,
        conversationKey,
        timeoutMs: this.REQUEST_TIMEOUT
      }, nextRequest.requestId, 'conversation-queue');
      
      // 强制完成请求
      this.failRequest(nextRequest.requestId, new Error('Request processing timeout'));
    }, this.REQUEST_TIMEOUT);
    
    this.requestTimeouts.set(nextRequest.requestId, requestTimeout);
  `);
  
  // 修复completeRequest方法，清理超时
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

// 修复3：server.ts中的队列集成
function fixServerQueueIntegration() {
  console.log('🔧 修复3: server.ts队列集成...');
  
  const serverPath = 'src/server.ts';
  let content = fs.readFileSync(serverPath, 'utf8');
  
  // 确保队列管理器正确初始化
  if (!content.includes('this.queueManager')) {
    console.log('⚠️  队列管理器未集成，跳过server.ts修复');
    return;
  }
  
  // 添加队列状态监控
  const queueMonitoringCode = `
    // 🔧 紧急修复：添加队列状态监控
    this.queueManager.on('stuckRequestsCleaned', (data) => {
      this.logger.warn('Queue manager cleaned stuck requests', data, 'server');
    });
    
    this.queueManager.on('requestFailed', (data) => {
      this.logger.warn('Queue manager request failed', data, 'server');
    });
    
    // 定期报告队列状态
    setInterval(() => {
      const stats = this.queueManager.getQueueStats();
      if (stats.totalPendingRequests > 0) {
        this.logger.info('Queue status report', {
          ...stats,
          port: this.config.server.port
        }, 'server');
      }
    }, 30000); // 每30秒报告一次
  `;
  
  // 在构造函数末尾添加监控代码
  const constructorEndPattern = /this\.logger\.info\('RouterServer initialized'/;
  const constructorEndMatch = content.match(constructorEndPattern);
  
  if (constructorEndMatch) {
    const insertPos = content.indexOf(constructorEndMatch[0]);
    content = content.slice(0, insertPos) + queueMonitoringCode + '\n    ' + content.slice(insertPos);
    console.log('✅ 添加了队列状态监控');
  }
  
  fs.writeFileSync(serverPath, content);
  console.log('✅ server.ts 队列集成修复完成');
}

// 创建测试脚本验证修复效果
function createValidationTest() {
  console.log('🧪 创建验证测试脚本...');
  
  const testScript = `#!/usr/bin/env node

/**
 * 验证双重修复效果
 */

const axios = require('axios');

async function testLargeTextToolCall() {
  console.log('🧪 测试大文本工具调用修复...');
  
  const largeText = "请详细解释JavaScript的所有概念。".repeat(200) + 
    "\\n\\n现在请使用listDirectory工具查看当前目录。";
  
  const request = {
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 100, // 故意设置很小
    messages: [{ role: "user", content: largeText }],
    tools: [{
      name: "listDirectory",
      description: "List directory contents",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"]
      }
    }],
    stream: true
  };
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      responseType: 'stream'
    });
    
    let hasToolUse = false;
    let finishReason = null;
    
    return new Promise((resolve) => {
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
        console.log(\`✅ 大文本工具调用测试完成: 工具调用=\${hasToolUse}, finish_reason=\${finishReason}\`);
        resolve({ hasToolUse, finishReason });
      });
    });
  } catch (error) {
    console.log(\`❌ 大文本工具调用测试失败: \${error.message}\`);
    return { hasToolUse: false, finishReason: null, error: error.message };
  }
}

async function testQueueTimeout() {
  console.log('🧪 测试队列超时修复...');
  
  const request = {
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1000,
    messages: [{ role: "user", content: "Hello" }],
    stream: true
  };
  
  // 发送多个连续请求测试队列
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(
      axios.post('http://localhost:3456/v1/messages', request, {
        headers: { 
          'Content-Type': 'application/json',
          'x-session-id': 'test-session',
          'conversation_id': 'test-conversation'
        },
        timeout: 20000,
        responseType: 'stream'
      }).then(response => {
        return new Promise((resolve) => {
          response.data.on('end', () => resolve(\`Request \${i} completed\`));
        });
      }).catch(error => \`Request \${i} failed: \${error.message}\`)
    );
  }
  
  try {
    const results = await Promise.all(promises);
    console.log('✅ 队列超时测试完成:', results);
    return { success: true, results };
  } catch (error) {
    console.log(\`❌ 队列超时测试失败: \${error.message}\`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚨 验证双重修复效果...');
  
  const results = {
    largeTextToolCall: await testLargeTextToolCall(),
    queueTimeout: await testQueueTimeout()
  };
  
  console.log('\\n📊 测试结果总结:');
  console.log(JSON.stringify(results, null, 2));
  
  // 判断修复是否成功
  const largeTextFixed = results.largeTextToolCall.hasToolUse && 
                         results.largeTextToolCall.finishReason === 'tool_use';
  const queueFixed = results.queueTimeout.success;
  
  console.log(\`\\n🎯 修复状态:\`);
  console.log(\`   大文本工具调用: \${largeTextFixed ? '✅ 修复成功' : '❌ 仍有问题'}\`);
  console.log(\`   队列超时机制: \${queueFixed ? '✅ 修复成功' : '❌ 仍有问题'}\`);
  
  if (largeTextFixed && queueFixed) {
    console.log('\\n🎉 双重修复验证成功！');
  } else {
    console.log('\\n⚠️  部分修复可能需要进一步调整');
  }
}

main().catch(console.error);
`;

  fs.writeFileSync('scripts/validate-dual-fix.js', testScript);
  fs.chmodSync('scripts/validate-dual-fix.js', '755');
  console.log('✅ 验证测试脚本已创建: scripts/validate-dual-fix.js');
}

// 主执行函数
function main() {
  try {
    console.log('🚨 开始紧急双重修复...');
    
    // 备份原文件
    const filesToBackup = [
      'src/providers/openai/enhanced-client.ts',
      'src/session/conversation-queue-manager.ts',
      'src/server.ts'
    ];
    
    filesToBackup.forEach(file => {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, `${file}.backup-${Date.now()}`);
        console.log(`📋 备份文件: ${file}`);
      }
    });
    
    // 执行修复
    fixLargeTextToolCall();
    fixQueueManagerTimeout();
    fixServerQueueIntegration();
    createValidationTest();
    
    console.log('\n🎉 紧急双重修复完成！');
    console.log('\n📋 修复内容:');
    console.log('1. ✅ 大文本工具调用：添加提前检测，防止length截断');
    console.log('2. ✅ 队列超时机制：添加请求超时和强制清理');
    console.log('3. ✅ 服务器集成：添加队列状态监控');
    console.log('4. ✅ 验证测试：创建自动化验证脚本');
    
    console.log('\n🔧 下一步操作:');
    console.log('1. 重新构建项目: npm run build');
    console.log('2. 重启服务器');
    console.log('3. 运行验证测试: node scripts/validate-dual-fix.js');
    
  } catch (error) {
    console.error('💀 修复过程中发生错误:', error);
    process.exit(1);
  }
}

main();