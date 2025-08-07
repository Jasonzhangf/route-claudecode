#!/usr/bin/env node

/**
 * 精确修复：队列管理器超时机制
 */

const fs = require('fs');

console.log('🔧 精确修复队列管理器超时机制...');

const queueManagerPath = 'src/session/conversation-queue-manager.ts';
let content = fs.readFileSync(queueManagerPath, 'utf8');

// 1. 在类属性区域添加超时配置
const classPropertiesPattern = /private completedRequests: Map<string, number> = new Map\(\);\s*private requestStartTimes: Map<string, Date> = new Map\(\);/;
const classPropertiesMatch = content.match(classPropertiesPattern);

if (classPropertiesMatch) {
  const timeoutProperties = `
  // 🔧 紧急修复：超时管理
  private readonly REQUEST_TIMEOUT = 60000; // 60秒请求超时
  private readonly QUEUE_WAIT_TIMEOUT = 30000; // 30秒队列等待超时
  private requestTimeouts: Map<string, NodeJS.Timeout> = new Map();`;
  
  content = content.replace(classPropertiesMatch[0], classPropertiesMatch[0] + timeoutProperties);
  console.log('✅ 添加了超时属性');
}

// 2. 修复processNextInQueue方法中的等待逻辑
const waitingLogicPattern = /if \(isAlreadyProcessing\) \{[\s\S]*?return;\s*}/;
const waitingLogicMatch = content.match(waitingLogicPattern);

if (waitingLogicMatch) {
  const newWaitingLogic = `if (isAlreadyProcessing) {
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
        this.forceCleanupStuckRequests(conversationKey);
        
        // 重新尝试处理
        this.processNextInQueue(conversationKey).catch(error => {
          logger.error('Error in timeout retry', { conversationKey, error }, 'conversation-queue');
        });
      }, this.QUEUE_WAIT_TIMEOUT);
      
      return;
    }`;
  
  content = content.replace(waitingLogicMatch[0], newWaitingLogic);
  console.log('✅ 修复了等待超时逻辑');
}

// 3. 在请求开始处理时设置超时
const requestStartPattern = /this\.processingRequests\.set\(nextRequest\.requestId, nextRequest\);\s*this\.requestStartTimes\.set\(nextRequest\.requestId, new Date\(\)\);/;
const requestStartMatch = content.match(requestStartPattern);

if (requestStartMatch) {
  const newRequestStart = `this.processingRequests.set(nextRequest.requestId, nextRequest);
    this.requestStartTimes.set(nextRequest.requestId, new Date());
    
    // 🔧 紧急修复：设置请求超时
    const requestTimeout = setTimeout(() => {
      logger.warn('Request timeout, forcing completion', {
        requestId: nextRequest.requestId,
        timeout: this.REQUEST_TIMEOUT
      }, nextRequest.requestId, 'conversation-queue');
      
      this.failRequest(nextRequest.requestId, new Error('Request timeout'));
    }, this.REQUEST_TIMEOUT);
    
    this.requestTimeouts.set(nextRequest.requestId, requestTimeout);`;
  
  content = content.replace(requestStartMatch[0], newRequestStart);
  console.log('✅ 添加了请求超时设置');
}

// 4. 在请求完成时清理超时
const completeCleanupPattern = /this\.processingRequests\.delete\(requestId\);\s*this\.requestStartTimes\.delete\(requestId\);/;
const completeCleanupMatch = content.match(completeCleanupPattern);

if (completeCleanupMatch) {
  const newCompleteCleanup = `this.processingRequests.delete(requestId);
    this.requestStartTimes.delete(requestId);
    
    // 🔧 紧急修复：清理请求超时
    const timeout = this.requestTimeouts.get(requestId);
    if (timeout) {
      clearTimeout(timeout);
      this.requestTimeouts.delete(requestId);
    }`;
  
  content = content.replace(completeCleanupMatch[0], newCompleteCleanup);
  console.log('✅ 添加了超时清理逻辑');
}

// 5. 在类的末尾添加强制清理方法
const classEndPattern = /}\s*\/\/ Global conversation queue manager/;
const classEndMatch = content.match(classEndPattern);

if (classEndMatch) {
  const forceCleanupMethod = `
  /**
   * 🔧 紧急修复：强制清理卡住的请求
   */
  private forceCleanupStuckRequests(conversationKey: string): void {
    logger.warn('Force cleaning stuck requests', { conversationKey }, 'conversation-queue');
    
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
      
      this.emit('stuckRequestsCleaned', {
        conversationKey,
        stuckRequests
      });
    }
  }

}`;
  
  content = content.replace(classEndMatch[0], forceCleanupMethod);
  console.log('✅ 添加了强制清理方法');
}

fs.writeFileSync(queueManagerPath, content);
console.log('✅ 队列管理器超时修复完成');

// 创建简单测试
const testScript = `#!/usr/bin/env node
const axios = require('axios');

async function testTimeout() {
  console.log('🧪 测试超时修复...');
  
  const requests = [];
  for (let i = 0; i < 3; i++) {
    requests.push(
      axios.post('http://localhost:3456/v1/messages', {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: \`测试请求 \${i}\` }],
        stream: true
      }, {
        headers: { 
          'Content-Type': 'application/json',
          'x-session-id': 'timeout-test',
          'conversation_id': 'timeout-conversation'
        },
        timeout: 25000,
        responseType: 'stream'
      }).then(response => {
        return new Promise((resolve) => {
          response.data.on('end', () => resolve(\`请求 \${i} 完成\`));
        });
      }).catch(error => \`请求 \${i} 失败: \${error.message}\`)
    );
  }
  
  try {
    const results = await Promise.all(requests);
    console.log('✅ 超时测试结果:', results);
  } catch (error) {
    console.log('❌ 超时测试失败:', error.message);
  }
}

testTimeout().catch(console.error);
`;

fs.writeFileSync('scripts/test-timeout-fix.js', testScript);
fs.chmodSync('scripts/test-timeout-fix.js', '755');
console.log('✅ 测试脚本已创建: scripts/test-timeout-fix.js');

console.log('\n🎉 精确修复完成！');
console.log('下一步: npm run build && 重启服务器 && node scripts/test-timeout-fix.js');