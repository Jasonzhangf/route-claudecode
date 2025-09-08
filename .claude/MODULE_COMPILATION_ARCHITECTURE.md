# RCC v4.0 模块编译架构规范

## 1. 模块编译架构

### 1.1 编译输出结构
```
dist/
├── config/                    # 配置模块
│   ├── index.d.ts             # 模块入口声明文件
│   ├── index.js               # 模块入口JavaScript文件
│   ├── config-preprocessor.d.ts  # 配置预处理器声明
│   ├── config-preprocessor.js    # 配置预处理器实现
│   ├── routing-table-types.d.ts  # 路由表类型声明
│   └── routing-table-types.js    # 路由表类型实现
├── router/                    # 路由模块
│   ├── index.d.ts             # 模块入口声明文件
│   ├── index.js               # 模块入口JavaScript文件
│   ├── router-preprocessor.d.ts  # 路由预处理器声明
│   ├── router-preprocessor.js    # 路由预处理器实现
│   ├── pipeline-router.d.ts   # 流水线路由器声明
│   └── pipeline-router.js     # 流水线路由器实现
├── pipeline/                  # 流水线模块
│   ├── index.d.ts             # 模块入口声明文件
│   ├── index.js               # 模块入口JavaScript文件
│   ├── pipeline-assembler.d.ts  # 流水线组装器声明
│   ├── pipeline-assembler.js    # 流水线组装器实现
│   ├── pipeline-assembler-interface.d.ts  # 流水线组装器接口声明
│   └── pipeline-assembler-interface.js    # 流水线组装器接口实现
└── modules/                   # 其他模块...
```

### 1.2 编译配置要求

#### TypeScript配置要点
- 启用declaration选项生成.d.ts声明文件
- 启用declarationMap选项生成声明映射文件
- 启用sourceMap选项生成源映射文件
- 使用严格模式确保类型安全
- 排除测试文件和node_modules目录

## 2. 模块标准化接口

### 2.1 配置模块接口
```typescript
// 配置模块导出接口
export { ConfigPreprocessor } from './config-preprocessor';
export * from './routing-table-types';
export const CONFIG_MODULE_VERSION: string;
```

### 2.2 路由模块接口
```typescript
// 路由模块导出接口
export { RouterPreprocessor } from './router-preprocessor';
export type { PipelineConfig, PipelineLayer, RouterPreprocessResult } from './router-preprocessor';
export { PipelineRouter } from './pipeline-router';
export type { PipelineRoute, PipelineRoutingDecision } from './pipeline-router';
export const ROUTER_MODULE_VERSION: string;
```

### 2.3 流水线模块接口
```typescript
// 流水线模块导出接口
export { PipelineAssembler } from './pipeline-assembler';
export { UnifiedInitializer, RuntimeScheduler, PipelineManager, PipelineModule } from './index';
export type { PipelineAssemblerInterface } from './pipeline-assembler-interface';
export type { UnifiedInitializerConfig, InitializationResult } from './unified-initializer';
export type { RuntimeSchedulerConfig, ScheduleRequest, ScheduleResponse } from './runtime-scheduler';
export type { CompletePipeline, CompletePipelineConfig, PipelineTableData, PipelineTableEntry } from './pipeline-manager-types';
export const PIPELINE_MODULE_VERSION: string;
```

## 3. 模块编译脚本

### 3.1 标准化构建脚本要点
- 清理之前的构建输出
- 使用TypeScript编译器生成JavaScript和声明文件
- 验证输出文件完整性
- 生成npm包文件
- 清理临时文件

### 3.2 模块验证脚本要点
- 验证JavaScript和声明文件是否存在
- 检查文件大小是否正常
- 验证声明文件内容完整性
- 确保模块接口正确导出

## 4. 实现细节

### 4.1 零实现暴露原则
- 只对外提供编译后的.js和.d.ts文件
- 原始.ts实现文件完全隐藏
- 通过声明文件暴露类型接口
- 其他模块只能通过声明文件了解接口

### 4.2 模块隔离
- 每个模块独立编译
- 模块间通过声明文件进行类型交互
- 实现代码完全隔离
- 支持模块独立部署和更新

## 5. 编译输出验证

编译完成后，每个模块应包含：
- index.js: 模块主入口JavaScript文件
- index.d.ts: 模块主入口声明文件
- 相关功能的.js和.d.ts文件对
- 正确的类型定义和接口导出