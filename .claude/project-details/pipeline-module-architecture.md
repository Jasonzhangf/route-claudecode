# 流水线模块零接口暴露架构设计

## 1. 架构概述

基于现有代码分析，设计RCC v4.0流水线模块的零接口暴露架构，解决当前依赖混乱、职责不清、硬编码等核心问题。

### 1.1 核心设计原则

- **零接口暴露**: 所有内部方法使用下划线前缀，外部无法访问
- **单一职责**: 每个类只负责一个核心功能
- **依赖注入**: 通过构造函数注入依赖，便于测试和扩展
- **配置驱动**: 所有逻辑通过配置驱动，避免硬编码
- **统一错误处理**: 使用统一的错误类型和处理机制

## 2. 模块架构设计

### 2.1 三大核心组件

```
pipeline/
├── src/
│   ├── pipeline-assembler.ts      # 流水线组装器 (替代UnifiedInitializer)
│   ├── runtime-scheduler.ts       # 运行时调度器 (重构后的RuntimeScheduler)
│   ├── pipeline-manager.ts        # 流水线管理器 (简化后的PipelineManager)
│   ├── types.ts                   # 统一类型定义
│   └── index.ts                   # 模块导出接口
├── tests/
│   ├── pipeline-assembler.test.ts
│   ├── runtime-scheduler.test.ts
│   └── pipeline-manager.test.ts
└── tsconfig.json                  # 模块编译配置
```

### 2.2 组件职责划分

#### PipelineAssembler (流水线组装器)
- **职责**: 负责流水线的初始化和组装
- **输入**: 路由表、流水线配置
- **输出**: 完整的流水线实例集合
- **核心方法**: `assemble()` - 唯一公开接口
- **设计**: 零接口暴露，所有内部逻辑隐藏

#### RuntimeScheduler (运行时调度器)
- **职责**: 负载均衡、请求调度、健康检查
- **输入**: 流水线实例集合
- **输出**: 调度决策和请求分发
- **核心方法**: `schedule()` - 唯一公开接口
- **设计**: 零接口暴露，策略配置驱动

#### PipelineManager (流水线管理器)
- **职责**: 流水线生命周期管理
- **功能**: 注册、注销、状态监控
- **核心方法**: `manage()` - 唯一公开接口
- **设计**: 零接口暴露，事件驱动架构

## 3. 接口设计

### 3.1 PipelineAssembler接口

```typescript
/**
 * 流水线组装结果
 */
export interface AssemblyResult {
  success: boolean;
  pipelines?: Map<string, CompletePipeline>;
  errors: string[];
  warnings: string[];
  stats: {
    totalPipelines: number;
    assemblyTime: number;
    memoryUsage: number;
  };
}

/**
 * 流水线组装器 - 零接口暴露
 */
export class PipelineAssembler {
  /**
   * 组装流水线 - 唯一公开接口
   */
  static async assemble(
    routingTable: RoutingTable,
    pipelineConfigs: PipelineConfig[]
  ): Promise<AssemblyResult>;
  
  // 所有内部方法使用下划线前缀
  private static _validateInputs(...): void;
  private static _createPipelines(...): Map<string, CompletePipeline>;
  private static _assembleLayers(...): PipelineLayer[];
  private static _validateAssembly(...): string[];
}
```

### 3.2 RuntimeScheduler接口

```typescript
/**
 * 调度结果
 */
export interface ScheduleResult {
  success: boolean;
  selectedPipeline?: CompletePipeline;
  reason: string;
  latency: number;
  alternatives: string[];
}

/**
 * 运行时调度器 - 零接口暴露
 */
export class RuntimeScheduler {
  /**
   * 调度请求 - 唯一公开接口
   */
  static async schedule(
    virtualModel: string,
    request: any,
    availablePipelines: Map<string, CompletePipeline>
  ): Promise<ScheduleResult>;
  
  // 所有内部方法使用下划线前缀
  private static _selectStrategy(...): LoadBalanceStrategy;
  private static _filterHealthyPipelines(...): CompletePipeline[];
  private static _calculateWeights(...): Map<string, number>;
  private static _makeScheduleDecision(...): CompletePipeline;
}
```

### 3.3 PipelineManager接口

```typescript
/**
 * 管理结果
 */
export interface ManagementResult {
  success: boolean;
  activeCount: number;
  errors: string[];
  events: PipelineEvent[];
}

/**
 * 流水线管理器 - 零接口暴露
 */
export class PipelineManager {
  /**
   * 管理流水线 - 唯一公开接口
   */
  async manage(
    action: 'register' | 'unregister' | 'monitor',
    pipelines: Map<string, CompletePipeline>
  ): Promise<ManagementResult>;
  
  // 所有内部方法使用下划线前缀
  private _registerPipeline(...): void;
  private _unregisterPipeline(...): void;
  private _monitorHealth(...): PipelineEvent[];
  private _handleLifecycleEvent(...): void;
}
```

## 4. 数据流设计

### 4.1 组装阶段数据流
```
RoutingTable + PipelineConfigs
    ↓
PipelineAssembler.assemble()
    ↓
_validateInputs()
    ↓
_createPipelines() → _assembleLayers()
    ↓
_validateAssembly()
    ↓
AssemblyResult (Map<string, CompletePipeline>)
```

### 4.2 调度阶段数据流
```
VirtualModel + Request + AvailablePipelines
    ↓
RuntimeScheduler.schedule()
    ↓
_selectStrategy() + _filterHealthyPipelines()
    ↓
_calculateWeights() + _makeScheduleDecision()
    ↓
ScheduleResult (Selected Pipeline)
```

### 4.3 管理阶段数据流
```
Action + Pipelines
    ↓
PipelineManager.manage()
    ↓
_registerPipeline() / _unregisterPipeline() / _monitorHealth()
    ↓
_handleLifecycleEvent()
    ↓
ManagementResult (Status + Events)
```

## 5. 错误处理设计

### 5.1 统一错误类型

```typescript
/**
 * 流水线模块错误基类
 */
class PipelineModuleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly component: 'assembler' | 'scheduler' | 'manager',
    public readonly details?: any
  ) {
    super(message);
    this.name = 'PipelineModuleError';
  }
}

/**
 * 组装错误
 */
class PipelineAssemblyError extends PipelineModuleError {
  constructor(message: string, code: string, details?: any) {
    super(message, code, 'assembler', details);
    this.name = 'PipelineAssemblyError';
  }
}
```

### 5.2 错误码标准

```typescript
export const PIPELINE_ERROR_CODES = {
  // 组装器错误
  ASSEMBLY_INVALID_INPUT: 'PA001',
  ASSEMBLY_LAYER_FAILED: 'PA002', 
  ASSEMBLY_VALIDATION_FAILED: 'PA003',
  
  // 调度器错误
  SCHEDULE_NO_PIPELINE: 'PS001',
  SCHEDULE_ALL_UNHEALTHY: 'PS002',
  SCHEDULE_STRATEGY_FAILED: 'PS003',
  
  // 管理器错误
  MANAGER_REGISTRATION_FAILED: 'PM001',
  MANAGER_HEALTH_CHECK_FAILED: 'PM002',
  MANAGER_LIFECYCLE_ERROR: 'PM003'
} as const;
```

## 6. 配置驱动设计

### 6.1 组装器配置

```typescript
export interface AssemblerConfig {
  maxConcurrentAssembly: number;
  layerTimeout: number;
  validationLevel: 'strict' | 'normal' | 'loose';
  enableOptimization: boolean;
  cacheStrategy: 'memory' | 'disk' | 'none';
}
```

### 6.2 调度器配置

```typescript
export interface SchedulerConfig {
  strategy: 'round_robin' | 'weighted' | 'least_connections' | 'random';
  healthCheckInterval: number;
  blacklistThreshold: number;
  weightCalculation: 'latency' | 'success_rate' | 'combined';
}
```

### 6.3 管理器配置

```typescript
export interface ManagerConfig {
  maxPipelines: number;
  monitoringInterval: number;
  eventBufferSize: number;
  autoCleanup: boolean;
  lifecycleHooks: {
    onRegister?: (pipeline: CompletePipeline) => void;
    onUnregister?: (pipelineId: string) => void;
    onHealthChange?: (pipelineId: string, health: HealthStatus) => void;
  };
}
```

## 7. 测试策略

### 7.1 单元测试覆盖

```typescript
// 每个组件的测试覆盖
describe('PipelineAssembler', () => {
  it('should assemble valid pipelines', async () => {
    // 测试正常组装流程
  });
  
  it('should handle invalid inputs gracefully', async () => {
    // 测试错误处理
  });
  
  it('should optimize assembly performance', async () => {
    // 测试性能优化
  });
});
```

### 7.2 集成测试设计

```typescript
// 组件间集成测试
describe('Pipeline Module Integration', () => {
  it('should complete full pipeline lifecycle', async () => {
    // 组装 → 调度 → 管理 完整流程测试
  });
  
  it('should handle component failures gracefully', async () => {
    // 故障恢复测试
  });
});
```

### 7.3 性能基准测试

```typescript
describe('Pipeline Module Performance', () => {
  it('should assemble 100 pipelines within 1 second', async () => {
    // 性能基准测试
  });
  
  it('should handle 1000 concurrent requests', async () => {
    // 并发性能测试
  });
});
```

## 8. 迁移策略

### 8.1 渐进式迁移

1. **第一阶段**: 创建新模块结构，保留旧接口
2. **第二阶段**: 逐步迁移核心功能，提供适配器
3. **第三阶段**: 完全切换到新架构，移除旧代码

### 8.2 兼容性保证

```typescript
// 提供兼容适配器
export class LegacyUnifiedInitializerAdapter {
  static async initialize(config: any): Promise<any> {
    // 调用新的PipelineAssembler
    const result = await PipelineAssembler.assemble(
      config.routingTable, 
      config.pipelineConfigs
    );
    // 转换为旧格式
    return this._convertToLegacyFormat(result);
  }
}
```

### 8.3 回滚机制

- 提供功能开关，可快速切换新旧实现
- 保留完整的回滚脚本和数据备份
- 建立监控指标，自动检测异常并触发回滚

## 9. 监控和调试

### 9.1 性能监控

```typescript
export interface PipelineMetrics {
  assemblyTime: number;
  scheduleLatency: number;
  memoryUsage: number;
  activeConnections: number;
  errorRate: number;
}
```

### 9.2 调试支持

```typescript
export interface PipelineDebugInfo {
  assemblyTrace: string[];
  scheduleDecisionTree: any;
  healthCheckResults: Map<string, HealthStatus>;
  configSnapshot: any;
}
```

## 10. 总结

这个架构设计实现了：

✅ **零接口暴露**: 所有内部实现完全隐藏
✅ **单一职责**: 每个组件职责清晰明确
✅ **配置驱动**: 避免硬编码，提高灵活性
✅ **统一错误处理**: 标准化的错误类型和处理机制
✅ **高性能**: 直接函数调用，避免API序列化开销
✅ **可测试性**: 清晰的依赖注入，100%单元测试覆盖
✅ **可扩展性**: 插件化架构，支持动态扩展
✅ **向后兼容**: 提供适配器，平滑迁移

通过这个设计，RCC v4.0的流水线模块将具备更高的性能、更好的可维护性和更强的扩展能力。