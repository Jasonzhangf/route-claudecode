/**
 * Module Architecture Test
 * 
 * 测试模块化架构的完整实现
 */

import { ModuleManager } from '../module-manager';
import { ModuleConnectionManager } from '../module-connection';
import { BaseModule } from '../../base-module-impl';
import { ModuleType } from '../../../interfaces/module/base-module';

// 创建测试模块类
class TestModuleA extends BaseModule {
  constructor() {
    super('test-module-a', 'TestModuleA', ModuleType.TRANSFORMER, '1.0.0');
  }

  protected async onProcess(input: any): Promise<any> {
    return { ...input, processedBy: 'TestModuleA' };
  }
}

class TestModuleB extends BaseModule {
  constructor() {
    super('test-module-b', 'TestModuleB', ModuleType.PROTOCOL, '1.0.0');
  }

  protected async onProcess(input: any): Promise<any> {
    return { ...input, processedBy: 'TestModuleB' };
  }
}

describe('Module Architecture', () => {
  let moduleManager: ModuleManager;
  let connectionManager: ModuleConnectionManager;
  let moduleA: TestModuleA;
  let moduleB: TestModuleB;

  beforeEach(() => {
    moduleManager = new ModuleManager();
    connectionManager = new ModuleConnectionManager();
    moduleA = new TestModuleA();
    moduleB = new TestModuleB();
  });

  test('should register and retrieve modules', async () => {
    await moduleManager.registerModule(moduleA);
    await moduleManager.registerModule(moduleB);

    const retrievedModuleA = moduleManager.getModule('test-module-a');
    const retrievedModuleB = moduleManager.getModule('test-module-b');

    expect(retrievedModuleA).toBeDefined();
    expect(retrievedModuleB).toBeDefined();
    expect(retrievedModuleA?.getId()).toBe('test-module-a');
    expect(retrievedModuleB?.getId()).toBe('test-module-b');
  });

  test('should connect and disconnect modules', async () => {
    await moduleManager.registerModule(moduleA);
    await moduleManager.registerModule(moduleB);

    const connected = await connectionManager.connectModules(moduleA, moduleB);
    expect(connected).toBe(true);

    const connectionId = 'test-module-a-test-module-b';
    const connection = connectionManager.getConnection(connectionId);
    expect(connection).toBeDefined();
    expect(connection?.status).toBe('connected');
    expect(connection?.sourceModuleId).toBe('test-module-a');
    expect(connection?.targetModuleId).toBe('test-module-b');

    // 验证模块间的连接
    expect(moduleA.getConnection('test-module-b')).toBeDefined();
    expect(moduleB.getConnection('test-module-a')).toBeDefined();

    // 断开连接
    await connectionManager.disconnectModules('test-module-a', 'test-module-b');
    expect(connectionManager.getConnection(connectionId)).toBeUndefined();
  });

  test('should start and stop all modules', async () => {
    await moduleManager.registerModule(moduleA);
    await moduleManager.registerModule(moduleB);

    // 启动所有模块
    await moduleManager.startAllModules();

    expect(moduleA.getStatus().status).toBe('running');
    expect(moduleB.getStatus().status).toBe('running');

    // 停止所有模块
    await moduleManager.stopAllModules();

    expect(moduleA.getStatus().status).toBe('stopped');
    expect(moduleB.getStatus().status).toBe('stopped');
  });

  test('should process data through connected modules', async () => {
    await moduleManager.registerModule(moduleA);
    await moduleManager.registerModule(moduleB);
    await connectionManager.connectModules(moduleA, moduleB);

    // 启动模块
    await moduleManager.startAllModules();

    // 处理数据
    const inputData = { message: 'Hello World' };
    const resultA = await moduleA.process(inputData);
    const resultB = await moduleB.process(resultA);

    expect(resultA.processedBy).toBe('TestModuleA');
    expect(resultB.processedBy).toBe('TestModuleB');
    expect(resultB.message).toBe('Hello World');
  });
});