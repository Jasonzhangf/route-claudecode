/**
 * Module Communication Test Suite
 *
 * 模块间通信功能测试
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ModuleType } from '../../../interfaces/module/base-module';
import { BaseModule } from '../../base-module-impl';

// 测试模块实现
class TestSenderModule extends BaseModule {
  constructor() {
    super('test-sender', 'Test Sender Module', ModuleType.TRANSFORMER, '1.0.0');
  }

  protected async onProcess(input: any): Promise<any> {
    return { 
      ...input, 
      processed: true,
      processedBy: this.getId()
    };
  }
}

class TestReceiverModule extends BaseModule {
  public receivedMessages: any[] = [];

  constructor() {
    super('test-receiver', 'Test Receiver Module', ModuleType.TRANSFORMER, '1.0.0');
  }

  protected async onProcess(input: any): Promise<any> {
    return { 
      ...input, 
      processed: true,
      processedBy: this.getId()
    };
  }

  // 重写消息处理方法来记录接收到的消息
  protected async handleModuleMessage(message: any): Promise<any> {
    this.receivedMessages.push(message);
    return await super.handleModuleMessage(message);
  }
}

describe('Module Communication', () => {
  let senderModule: TestSenderModule;
  let receiverModule: TestReceiverModule;

  beforeEach(async () => {
    senderModule = new TestSenderModule();
    receiverModule = new TestReceiverModule();
    
    await senderModule.start();
    await receiverModule.start();
  });

  afterEach(async () => {
    await senderModule.stop();
    await receiverModule.stop();
    await senderModule.cleanup();
    await receiverModule.cleanup();
  });

  test('should establish module connection', () => {
    senderModule.addConnection(receiverModule);
    
    const connection = senderModule.getConnection('test-receiver');
    expect(connection).toBeDefined();
    expect(connection?.getId()).toBe('test-receiver');
    
    const allConnections = senderModule.getConnections();
    expect(allConnections).toHaveLength(1);
    expect(allConnections[0].getId()).toBe('test-receiver');
  });

  test('should send message between modules', async () => {
    senderModule.addConnection(receiverModule);
    
    const testMessage = { 
      content: 'Hello from sender module',
      type: 'greeting'
    };
    
    const result = await senderModule.sendToModule('test-receiver', testMessage, 'test');
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.processedBy).toBe('test-receiver');
  });

  test('should handle module message listening', async () => {
    // 设置消息监听器
    receiverModule.onModuleMessage((sourceModuleId, message, type) => {
      // 验证接收到的消息
      expect(sourceModuleId).toBe('test-sender');
      expect(message.content).toBe('Hello with listener');
      expect(type).toBe('test-listener');
    });
    
    senderModule.addConnection(receiverModule);
    
    const testMessage = { 
      content: 'Hello with listener',
      type: 'notification'
    };
    
    await senderModule.sendToModule('test-receiver', testMessage, 'test-listener');
  });

  test('should broadcast message to multiple modules', async () => {
    // 创建第二个接收模块
    const receiverModule2 = new TestReceiverModule();
    await receiverModule2.start();
    
    try {
      senderModule.addConnection(receiverModule);
      senderModule.addConnection(receiverModule2);
      
      const testMessage = { 
        content: 'Broadcast message',
        type: 'announcement'
      };
      
      await senderModule.broadcastToModules(testMessage, 'broadcast-test');
      
      // 验证两个模块都收到了广播
      const connections = senderModule.getConnections();
      expect(connections).toHaveLength(2);
    } finally {
      await receiverModule2.stop();
      await receiverModule2.cleanup();
    }
  });

  test('should remove module connection', () => {
    senderModule.addConnection(receiverModule);
    expect(senderModule.getConnections()).toHaveLength(1);
    
    senderModule.removeConnection('test-receiver');
    expect(senderModule.getConnections()).toHaveLength(0);
    
    const connection = senderModule.getConnection('test-receiver');
    expect(connection).toBeUndefined();
  });

  test('should handle communication errors', async () => {
    // 尝试向未连接的模块发送消息
    await expect(
      senderModule.sendToModule('non-existent-module', { content: 'test' })
    ).rejects.toThrow('Module non-existent-module is not connected to test-sender');
  });
});