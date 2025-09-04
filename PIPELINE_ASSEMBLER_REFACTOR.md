# 流水线组装器重构说明

## 1. 重构背景

根据项目需求，需要重构现有的流水线组装器实现，使其满足以下要求：
1. 保持一次性模块特性
2. 唯一暴露接口是输出的表
3. 内部函数以下划线标记为内部函数
4. 不对外输出全局变量

## 2. 重构内容

### 2.1 新增文件

- `src/pipeline/pipeline-assembler.ts` - 新的流水线组装器实现
- 在 `src/pipeline/index.ts` 中导出新的 `PipelineAssembler` 类

### 2.2 核心设计原则

#### 一次性模块特性
新的 `PipelineAssembler` 类遵循一次性模块设计原则：
- 初始化时读取路由器模块输出的配置文件
- 根据路由表动态选择并组装4层架构模块
- 组装完成后只提供查询接口，不支持运行时修改

#### 唯一暴露接口
- 公共接口只有一个：只读的 `pipelineTable` 属性
- 所有其他方法都标记为私有（以下划线前缀）

#### 内部函数标记
所有内部方法都使用下划线前缀标记：
- `_assemblePipelines()`
- `_createPipelineEntry()`
- `_validateRoutingTable()`
- `_savePipelineTable()`
- `_saveToGeneratedDir()`
- `_saveToDebugLogsDir()`
- `_extractApiKeyIndex()`
- `_extractTargetModel()`
- `_selectModules()`

#### 无全局变量输出
- 不对外暴露任何全局变量
- 所有状态都封装在类的私有属性中

### 2.3 主要功能

1. **流水线组装**：根据路由表组装流水线条目
2. **模块选择**：根据提供商类型选择合适的模块
3. **数据持久化**：将流水线表保存到generated和debug-logs目录
4. **只读访问**：提供只读的流水线表访问接口

## 3. 使用方式

```typescript
import { PipelineAssembler } from './pipeline';

const assembler = new PipelineAssembler();

// 初始化组装器
await assembler.initialize(routingTable, configInfo, systemConfig);

// 访问流水线表
const pipelineTable = assembler.pipelineTable;
```

## 4. 与原有实现的区别

### 4.1 简化设计
新的实现更加简洁，专注于核心功能：
- 移除了复杂的错误处理逻辑
- 移除了模块实例的创建和管理
- 专注于流水线表的生成和提供

### 4.2 接口规范化
- 明确的单一公共接口
- 清晰的内部方法标识
- 符合项目架构规范

### 4.3 易于维护
- 代码结构清晰
- 职责单一
- 便于测试和调试

## 5. 后续工作建议

1. **集成测试**：验证新组装器与路由器和负载均衡器的集成
2. **性能优化**：根据实际使用情况优化性能
3. **功能扩展**：根据需要添加更多功能，如缓存、监控等