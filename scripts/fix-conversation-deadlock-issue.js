#!/usr/bin/env node

/**
 * 修复对话死锁问题
 * 
 * 问题分析：
 * 1. ConversationQueueManager存在但没有在server.ts中集成
 * 2. 工具调用时message_stop被跳过，但队列管理器没有收到完成通知
 * 3. 导致后续请求永远等待前一个请求完成，形成死锁
 * 
 * 解决方案：
 * 1. 在server.ts中集成ConversationQueueManager
 * 2. 确保工具调用完成时正确通知队列管理器
 * 3. 添加超时机制防止死锁
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复对话死锁问题...');

// 1. 修复server.ts - 集成ConversationQueueManager
function fixServerIntegration() {
  const serverPath = path.join(process.cwd(), 'src/server.ts');
  let content = fs.readFileSync(serverPath, 'utf8');
  
  // 添加导入
  if (!content.includes('getConversationQueueManager')) {
    const importSection = content.match(/(import.*from.*'\.\/utils\/error-handler'.*;\n)/s);
    if (importSection) {
      const newImport = `${importSection[1]}import { getConversationQueueManager } from './session/conversation-queue-manager';\n`;
      content = content.replace(importSection[1], newImport);
      console.log('✅ 添加了ConversationQueueManager导入');
    }
  }
  
  // 在构造函数中初始化队列管理器
  if (!content.includes('this.queueManager')) {
    const constructorMatch = content.match(/(constructor\(config: RouterConfig, serverType\?: string\) \{[\s\S]*?)(this\.logger = getLogger)/);
    if (constructorMatch) {
      const newConstructor = `${constructorMatch[1]}this.queueManager = getConversationQueueManager(config.port || 3000);\n    ${constructorMatch[2]}`;
      content = content.replace(constructorMatch[0], newConstructor);
      console.log('✅ 在构造函数中初始化了队列管理器');
    }
  }
  
  // 添加队列管理器属性声明
  if (!content.includes('private queueManager')) {
    const propertiesMatch = content.match(/(private unifiedPreprocessor:.*;\n)/);
    if (propertiesMatch) {
      const newProperty = `${propertiesMatch[1]}  private queueManager: ReturnType<typeof getConversationQueueManager>;\n`;
      content = content.replace(propertiesMatch[1], newProperty);
      console.log('✅ 添加了队列管理器属性声明');
    }
  }
  
  fs.writeFileSync(serverPath, content);
  console.log('✅ server.ts集成完成');
}

// 2. 修复message_stop处理逻辑
function fixMessageStopHandling() {
  const serverPath = path.join(process.cwd(), 'src/server.ts');
  let content = fs.readFileSync(serverPath, 'utf8');
  
  // 查找message_stop处理部分
  const messageStopPattern = /} else if \(processedChunk\.event === 'message_stop'\) \{[\s\S]*?} else \{/;
  const messageStopMatch = content.match(messageStopPattern);
  
  if (messageStopMatch) {
    const newMessageStopHandling = `} else if (processedChunk.event === 'message_stop') {
          // 🔧 修复：工具调用场景下不发送message_stop，但要通知队列管理器完成
          if (hasToolUse) {
            this.logger.debug('Skipping message_stop for tool_use scenario, but notifying queue completion', { 
              requestId, 
              hasToolUse 
            }, requestId, 'server');
            
            // 通知队列管理器请求完成（即使不发送message_stop）
            this.queueManager.completeRequest(requestId, 'tool_use');
            
            // 不发送message_stop，让对话保持开放状态等待工具执行结果
          } else {
            // 非工具调用场景正常发送message_stop并通知队列完成
            this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
            this.logger.debug('Sent message_stop event for non-tool scenario', { requestId }, requestId, 'server');
            
            // 通知队列管理器请求完成
            this.queueManager.completeRequest(requestId, 'end_turn');
          }
        } else {`;
    
    content = content.replace(messageStopMatch[0], newMessageStopHandling);
    console.log('✅ 修复了message_stop处理逻辑');
  }
  
  fs.writeFileSync(serverPath, content);
}

// 3. 添加请求开始时的队列入队逻辑
function addQueueEnqueueLogic() {
  const serverPath = path.join(process.cwd(), 'src/server.ts');
  let content = fs.readFileSync(serverPath, 'utf8');
  
  // 查找请求处理开始的地方
  const requestStartPattern = /const requestId = uuidv4\(\);[\s\S]*?this\.logger\.info\('Request received'/;
  const requestStartMatch = content.match(requestStartPattern);
  
  if (requestStartMatch) {
    const newRequestStart = `const requestId = uuidv4();
    
    // 🔧 修复：将请求加入对话队列进行顺序处理
    const sessionId = request.headers['x-session-id'] || 'default';
    const conversationId = request.body?.conversation_id || 'default';
    
    try {
      const queueResult = await this.queueManager.enqueueRequest(sessionId, conversationId, true);
      this.logger.debug('Request enqueued successfully', {
        requestId,
        queueRequestId: queueResult.requestId,
        sequenceNumber: queueResult.sequenceNumber
      }, requestId, 'server');
    } catch (error) {
      this.logger.error('Failed to enqueue request', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'server');
      
      // 如果入队失败，直接返回错误
      return reply.status(500).send({
        error: 'Request queue error',
        message: error instanceof Error ? error.message : String(error)
      });
    }

    this.logger.info('Request received'`;
    
    content = content.replace(requestStartMatch[0], newRequestStart);
    console.log('✅ 添加了队列入队逻辑');
  }
  
  fs.writeFileSync(serverPath, content);
}

// 4. 添加错误处理时的队列清理
function addErrorQueueCleanup() {
  const serverPath = path.join(process.cwd(), 'src/server.ts');
  let content = fs.readFileSync(serverPath, 'utf8');
  
  // 查找错误处理部分
  const errorHandlingPattern = /} catch \(error\) \{[\s\S]*?this\.logger\.error\('Request failed'/;
  const errorHandlingMatch = content.match(errorHandlingPattern);
  
  if (errorHandlingMatch) {
    const newErrorHandling = `} catch (error) {
      // 🔧 修复：错误时通知队列管理器请求失败
      this.queueManager.failRequest(requestId, error);
      
      this.logger.error('Request failed'`;
    
    content = content.replace(errorHandlingMatch[0], newErrorHandling);
    console.log('✅ 添加了错误队列清理逻辑');
  }
  
  fs.writeFileSync(serverPath, content);
}

// 5. 修复ConversationQueueManager添加超时机制
function addTimeoutMechanism() {
  const queueManagerPath = path.join(process.cwd(), 'src/session/conversation-queue-manager.ts');
  let content = fs.readFileSync(queueManagerPath, 'utf8');
  
  // 添加waitForCompletion方法
  if (!content.includes('waitForCompletion')) {
    const methodsSection = content.match(/(private getNextSequenceNumber[\s\S]*?}\n)/);
    if (methodsSection) {
      const waitForCompletionMethod = `
  /**
   * 等待对话完成（带超时机制）
   */
  private async waitForCompletion(conversationKey: string, requestId: string): Promise<void> {
    const maxWaitTime = 60000; // 60秒超时
    const checkInterval = 100; // 100ms检查间隔
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        // 检查是否还在处理中
        const isStillProcessing = Array.from(this.processingRequests.values())
          .some(req => \`\${req.sessionId}:\${req.conversationId}\` === conversationKey);
        
        if (!isStillProcessing) {
          logger.debug('Conversation completion detected', {
            conversationKey,
            requestId,
            waitTime: Date.now() - startTime
          }, requestId, 'conversation-queue');
          resolve();
          return;
        }
        
        // 检查超时
        if (Date.now() - startTime > maxWaitTime) {
          logger.warn('Conversation wait timeout, forcing completion', {
            conversationKey,
            requestId,
            waitTime: Date.now() - startTime
          }, requestId, 'conversation-queue');
          
          // 强制清理处理中的请求
          for (const [procRequestId, procRequest] of this.processingRequests.entries()) {
            if (\`\${procRequest.sessionId}:\${procRequest.conversationId}\` === conversationKey) {
              this.processingRequests.delete(procRequestId);
              this.requestStartTimes.delete(procRequestId);
            }
          }
          
          resolve();
          return;
        }
        
        // 继续等待
        setTimeout(checkCompletion, checkInterval);
      };
      
      checkCompletion();
    });
  }

${methodsSection[1]}`;
      
      content = content.replace(methodsSection[1], waitForCompletionMethod);
      console.log('✅ 添加了waitForCompletion超时机制');
    }
  }
  
  // 修复processNextInQueue方法，添加waitForCompletion调用
  const processNextPattern = /if \(isAlreadyProcessing\) \{[\s\S]*?return;\s*}/;
  const processNextMatch = content.match(processNextPattern);
  
  if (processNextMatch && !content.includes('await this.waitForCompletion')) {
    const newProcessNext = `if (isAlreadyProcessing) {
      logger.debug('Conversation already processing, waiting for completion', {
        conversationKey,
        queueLength: queue.length
      }, 'conversation-queue');
      
      // 等待当前请求完成
      await this.waitForCompletion(conversationKey, 'waiting');
      
      // 重新尝试处理
      this.processNextInQueue(conversationKey);
      return;
    }`;
    
    content = content.replace(processNextMatch[0], newProcessNext);
    console.log('✅ 修复了processNextInQueue等待逻辑');
  }
  
  fs.writeFileSync(queueManagerPath, content);
}

// 执行修复
try {
  fixServerIntegration();
  fixMessageStopHandling();
  addQueueEnqueueLogic();
  addErrorQueueCleanup();
  addTimeoutMechanism();
  
  console.log('\n🎉 对话死锁问题修复完成！');
  console.log('\n修复内容：');
  console.log('1. ✅ 在server.ts中集成ConversationQueueManager');
  console.log('2. ✅ 修复message_stop处理，确保队列管理器收到完成通知');
  console.log('3. ✅ 添加请求入队逻辑，确保顺序处理');
  console.log('4. ✅ 添加错误处理时的队列清理');
  console.log('5. ✅ 添加超时机制防止永久死锁');
  
  console.log('\n🔧 请重新启动服务器测试修复效果');
  
} catch (error) {
  console.error('❌ 修复过程中出现错误:', error);
  process.exit(1);
}