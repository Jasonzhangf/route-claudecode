/**
 * Complete Module System Test
 * 
 * 测试完整的模块化系统，包括模块注册、连接、通信和生命周期管理
 */

import { ModuleManager } from '../module-manager';
import { ModuleConnectionManager } from '../module-connection';
import { BaseModule } from '../../base-module-impl';
import { ModuleType, ModuleInterface } from '../../../interfaces/module/base-module';

// 创建不同类型的测试模块
class TransformerModule extends BaseModule {
  constructor() {
    super('transformer-1', 'TransformerModule', ModuleType.TRANSFORMER, '1.0.0');
  }

  protected async onProcess(input: any): Promise<any> {
    return { ...input, transformed: true, processedBy: this.getName() };
  }
}

class ProtocolModule extends BaseModule {
  constructor() {
    super('protocol-1', 'ProtocolModule', ModuleType.PROTOCOL, '1.0.0');
  }

  protected async onProcess(input: any): Promise<any> {
    return { ...input, protocolHandled: true, processedBy: this.getName() };
  }
}

class ServerModule extends BaseModule {
  constructor() {
    super('server-1', 'ServerModule', ModuleType.SERVER, '1.0.0');
  }

  protected async onProcess(input: any): Promise<any> {
    return { ...input, serverResponse: 'OK', processedBy: this.getName() };
  }
}

describe('Complete Module System', () => {
  let moduleManager: ModuleManager;
  let connectionManager: ModuleConnectionManager;
  let transformer: TransformerModule;
  let protocol: ProtocolModule;
  let server: ServerModule;

  beforeEach(() => {
    moduleManager = new ModuleManager();
    connectionManager = new ModuleConnectionManager();
    transformer = new TransformerModule();
    protocol = new ProtocolModule();
    server = new ServerModule();
  });

  test('should create and register all module types', async () => {
    await moduleManager.registerModule(transformer);
    await moduleManager.registerModule(protocol);
    await moduleManager.registerModule(server);

    const allModules = moduleManager.getAllModules();
    expect(allModules).toHaveLength(3);

    const moduleIds = allModules.map(module => module.getId());
    expect(moduleIds).toContain('transformer-1');
    expect(moduleIds).toContain('protocol-1');
    expect(moduleIds).toContain('server-1');

    const moduleTypes = allModules.map(module => module.getType());
    expect(moduleTypes).toContain(ModuleType.TRANSFORMER);
    expect(moduleTypes).toContain(ModuleType.PROTOCOL);
    expect(moduleTypes).toContain(ModuleType.SERVER);
  });

  test('should establish full pipeline connection', async () => {
    await moduleManager.registerModule(transformer);
    await moduleManager.registerModule(protocol);
    await moduleManager.registerModule(server);

    // 建立流水线连接: Transformer -> Protocol -> Server
    const transformerToProtocol = await connectionManager.connectModules(transformer, protocol);
    const protocolToServer = await connectionManager.connectModules(protocol, server);

    expect(transformerToProtocol).toBe(true);
    expect(protocolToServer).toBe(true);

    // 验证连接
    expect(connectionManager.isConnected('transformer-1', 'protocol-1')).toBe(true);
    expect(connectionManager.isConnected('protocol-1', 'server-1')).toBe(true);

    // 验证模块间的直接连接
    expect(transformer.getConnection('protocol-1')).toBeDefined();
    expect(protocol.getConnection('transformer-1')).toBeDefined();
    expect(protocol.getConnection('server-1')).toBeDefined();
    expect(server.getConnection('protocol-1')).toBeDefined();
  });

  test('should process data through complete pipeline', async () => {
    await moduleManager.registerModule(transformer);
    await moduleManager.registerModule(protocol);
    await moduleManager.registerModule(server);
    await connectionManager.connectModules(transformer, protocol);
    await connectionManager.connectModules(protocol, server);

    // 启动所有模块
    await moduleManager.startAllModules();

    // 验证所有模块都已启动
    expect(transformer.getStatus().status).toBe('running');
    expect(protocol.getStatus().status).toBe('running');
    expect(server.getStatus().status).toBe('running');

    // 通过完整流水线处理数据
    const inputData = { 
      message: 'Test data',
      userId: 'user-123',
      timestamp: Date.now()
    };

    const transformedData = await transformer.process(inputData);
    const protocolData = await protocol.process(transformedData);
    const serverResponse = await server.process(protocolData);

    // 验证处理结果
    expect(transformedData.transformed).toBe(true);
    expect(transformedData.processedBy).toBe('TransformerModule');
    
    expect(protocolData.protocolHandled).toBe(true);
    expect(protocolData.processedBy).toBe('ProtocolModule');
    
    expect(serverResponse.serverResponse).toBe('OK');
    expect(serverResponse.processedBy).toBe('ServerModule');
    
    expect(serverResponse.message).toBe('Test data');
    expect(serverResponse.userId).toBe('user-123');
  });

  test('should handle module lifecycle properly', async () => {
    await moduleManager.registerModule(transformer);
    await moduleManager.registerModule(protocol);

    // 启动模块
    await moduleManager.startAllModules();
    expect(transformer.getStatus().status).toBe('running');
    expect(protocol.getStatus().status).toBe('running');

    // 停止单个模块
    await transformer.stop();
    expect(transformer.getStatus().status).toBe('stopped');
    expect(protocol.getStatus().status).toBe('running');

    // 重启模块
    await transformer.start();
    expect(transformer.getStatus().status).toBe('running');

    // 停止所有模块
    await moduleManager.stopAllModules();
    expect(transformer.getStatus().status).toBe('stopped');
    expect(protocol.getStatus().status).toBe('stopped');
  });

  test('should handle module communication', async () => {
    await moduleManager.registerModule(transformer);
    await moduleManager.registerModule(protocol);
    await connectionManager.connectModules(transformer, protocol);

    // 启动模块
    await moduleManager.startAllModules();

    // 测试模块间直接通信
    const message = { type: 'ping', data: 'hello' };
    const result = await transformer.sendToModule('protocol-1', message);
    
    // 由于BaseModule中的sendToModule实现，这里会返回成功响应
    expect(result).toBeDefined();
  });

  test('should get module metrics and status', async () => {
    await moduleManager.registerModule(transformer);
    await moduleManager.startAllModules();

    // 处理一些数据来生成指标
    await transformer.process({ test: 'data1' });
    await transformer.process({ test: 'data2' });

    const status = transformer.getStatus();
    const metrics = transformer.getMetrics();

    expect(status.id).toBe('transformer-1');
    expect(status.name).toBe('TransformerModule');
    expect(status.type).toBe(ModuleType.TRANSFORMER);
    expect(status.status).toBe('running');
    expect(status.health).toBeDefined();

    expect(metrics.requestsProcessed).toBeGreaterThan(0);
    // 平均处理时间可能为0（如果处理太快），所以改为检查是否为数字
    expect(typeof metrics.averageProcessingTime).toBe('number');
    expect(metrics.errorRate).toBe(0); // 没有错误
  });

  test('should clean up modules properly', async () => {
    await moduleManager.registerModule(transformer);
    await moduleManager.registerModule(protocol);
    await connectionManager.connectModules(transformer, protocol);

    // 启动模块
    await moduleManager.startAllModules();

    // 注销模块
    await moduleManager.unregisterModule('transformer-1');
    
    // 验证模块已被移除
    const remainingModules = moduleManager.getAllModules();
    expect(remainingModules).toHaveLength(1);
    expect(remainingModules[0].getId()).toBe('protocol-1');
  });
});