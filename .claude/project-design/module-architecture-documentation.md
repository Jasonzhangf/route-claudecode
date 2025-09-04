# RCC v4.0 模块化系统架构文档

## 概述

RCC v4.0 采用先进的模块化架构设计，所有系统组件都基于统一的模块接口规范实现。这种设计提供了高度的可扩展性、可维护性和可测试性。

## 核心组件

### ModuleInterface 接口
所有模块必须实现的基础接口，定义了模块的标准API：

```typescript
interface ModuleInterface {
  // 基础信息
  getId(): string;
  getName(): string;
  getType(): ModuleType;
  getVersion(): string;
  
  // 状态管理
  getStatus(): ModuleStatus;
  getMetrics(): ModuleMetrics;
  
  // 生命周期
  configure(config: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  process(input: any): Promise<any>;
  reset(): Promise<void>;
  cleanup(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
  
  // 模块间通信
  addConnection(module: ModuleInterface): void;
  removeConnection(moduleId: string): void;
  getConnection(moduleId: string): ModuleInterface | undefined;
  getConnections(): ModuleInterface[];
  sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
  broadcastToModules(message: any, type?: string): Promise<void>;
  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
}
```

### BaseModule 抽象基类
提供ModuleInterface的标准实现，所有具体模块都应继承此类：

```typescript
abstract class BaseModule extends EventEmitter implements ModuleInterface {
  // 提供所有接口方法的默认实现
  // 子类只需实现核心处理逻辑 onProcess()
}
```

### ModuleManager 模块管理器
负责模块的注册、管理和生命周期控制：

```typescript
class ModuleManager {
  async registerModule(module: ModuleInterface): Promise<void>;
  getModule(moduleId: string): ModuleInterface | undefined;
  getAllModules(): ModuleInterface[];
  async unregisterModule(moduleId: string): Promise<void>;
  async startAllModules(): Promise<void>;
  async stopAllModules(): Promise<void>;
}
```

### ModuleConnectionManager 连接管理器
管理模块间的连接和通信：

```typescript
class ModuleConnectionManager {
  async connectModules(source: ModuleInterface, target: ModuleInterface): Promise<boolean>;
  async disconnectModules(sourceId: string, targetId: string): Promise<void>;
  getConnection(connectionId: string): ModuleConnection | undefined;
  getAllConnections(): ModuleConnection[];
  isConnected(sourceId: string, targetId: string): boolean;
}
```

## 模块生命周期

每个模块都遵循完整的生命周期：

1. **创建** - 实例化模块对象
2. **配置** - 通过`configure()`方法配置模块参数
3. **启动** - 通过`start()`方法初始化资源
4. **运行** - 通过`process()`方法处理数据
5. **停止** - 通过`stop()`方法释放资源
6. **清理** - 通过`cleanup()`方法彻底清理

## 模块间通信机制

### 直接通信
```typescript
const response = await sourceModule.sendToModule('target-module-id', message);
```

### 广播通信
```typescript
await sourceModule.broadcastToModules(message);
```

### 事件监听
```typescript
targetModule.onModuleMessage((sourceId, message, type) => {
  // 处理来自其他模块的消息
});
```

## 模块类型

系统支持多种模块类型：

```typescript
enum ModuleType {
  VALIDATOR = 'validator',
  TRANSFORMER = 'transformer', 
  PROTOCOL = 'protocol',
  SERVER_COMPATIBILITY = 'server-compatibility',
  COMPATIBILITY = 'compatibility',
  SERVER = 'server',
  ROUTER = 'router',
  PIPELINE = 'pipeline',
  CLIENT = 'client',
  CONFIG = 'config',
  DEBUG = 'debug',
  ERROR_HANDLER = 'error-handler',
  MIDDLEWARE = 'middleware',
  PROVIDER = 'provider',
}
```

## 使用示例

### 创建自定义模块

```typescript
import { BaseModule } from '../base-module-impl';
import { ModuleType } from '../../interfaces/module/base-module';

export class MyCustomModule extends BaseModule {
  constructor(config: any) {
    super(
      'my-module-' + Date.now(),
      'MyCustomModule',
      ModuleType.TRANSFORMER,
      '1.0.0'
    );
  }

  protected async onProcess(input: any): Promise<any> {
    return { ...input, processed: true };
  }
}
```

### 模块管理

```typescript
const moduleManager = new ModuleManager();
const myModule = new MyCustomModule(config);

// 注册模块
await moduleManager.registerModule(myModule);

// 启动模块
await moduleManager.startAllModules();

// 处理数据
const result = await myModule.process({ data: 'test' });

// 停止模块
await moduleManager.stopAllModules();
```

### 模块连接

```typescript
const connectionManager = new ModuleConnectionManager();
const connected = await connectionManager.connectModules(moduleA, moduleB);

if (connected) {
  const response = await moduleA.sendToModule('module-b-id', message);
}
```

## 在RCC v4.0中的应用

### 流水线模块
- Transformer模块：处理数据格式转换
- Protocol模块：处理协议规范
- ServerCompatibility模块：处理服务器兼容性
- Server模块：处理HTTP通信

### 核心功能模块
- 配置模块：系统配置管理
- 路由模块：请求路由逻辑
- 验证模块：输入输出验证
- 错误处理模块：统一错误处理

## 设计原则

1. **零接口暴露** - 模块内部实现完全封装
2. **责任单一** - 每个模块只负责一个特定功能
3. **组合优于继承** - 通过组合实现功能复用
4. **统一生命周期** - 所有模块遵循相同的生命周期
5. **可观测性** - 内置状态监控和性能指标
6. **容错性** - 异常隔离和优雅降级机制

## 测试验证

系统包含完整的测试套件验证模块化架构的正确性：

- 模块注册和检索测试
- 模块连接和断开测试
- 模块生命周期管理测试
- 模块间通信测试
- 完整流水线处理测试

## 总结

RCC v4.0的模块化系统为构建复杂的企业级应用提供了坚实的基础架构，具有良好的扩展性、可维护性和可测试性。