# 测试框架重构设计

## 重构后的测试目录结构

根据新的模块化设计，测试文件应该与对应模块放在同一目录下，而不是集中在统一的tests文件夹中。

### 新的测试目录结构

```
src/
├── config/
│   ├── __tests__/
│   │   ├── config-preprocessor.test.ts
│   │   └── test-outputs/
│   │       ├── config-preprocessor-result.json
│   │       └── routing-table.json
│   ├── config-preprocessor.ts
│   ├── routing-table-types.ts
│   └── index.ts
├── router/
│   ├── __tests__/
│   │   ├── router-preprocessor.test.ts
│   │   └── test-outputs/
│   │       ├── router-preprocessor-result.json
│   │       ├── internal-routing-table.json
│   │       └── pipeline-configs.json
│   ├── router-preprocessor.ts
│   ├── pipeline-router.ts
│   └── index.ts
└── pipeline/
    ├── __tests__/
    │   └── pipeline-lifecycle-manager.test.ts
    └── pipeline-lifecycle-manager.ts
```

## 测试设计原则

### 1. 模块内聚性
- 每个模块的测试文件放在该模块的`__tests__`子目录下
- 测试输出文件放在`test-outputs`子目录下
- 便于模块独立开发和维护

### 2. 一次性预处理器测试
- **ConfigPreprocessor测试**：验证配置文件 → 路由表的转换
- **RouterPreprocessor测试**：验证路由表 → 流水线配置的转换
- 测试零接口暴露设计：只能调用`preprocess()`方法

### 3. 输出表验证
- 保存每个预处理器的完整输出结果
- 验证输出表与输入配置的对应关系
- 确保数据转换的完整性和准确性

## ConfigPreprocessor测试规范

### 测试覆盖范围
```typescript
describe('ConfigPreprocessor', () => {
  // 1. 核心功能测试
  describe('preprocess() - 核心功能测试', () => {
    test('应该成功处理配置文件');
    test('应该正确解析服务器配置');
    test('应该正确解析Provider配置');
    test('应该正确生成路由映射');
  });

  // 2. 输入验证测试
  describe('配置文件验证', () => {
    test('应该拒绝不存在的配置文件');
    test('应该拒绝无效的JSON文件');
  });

  // 3. 对应关系验证
  describe('表项对应关系验证', () => {
    test('每个Provider都应该对应配置文件中的Provider');
    test('每个路由都应该对应配置文件中的路由或自动生成');
    test('服务器配置应该完全匹配');
  });
});
```

### 输出文件规范
- `config-preprocessor-result.json`：完整处理结果
- `routing-table.json`：生成的标准路由表

## RouterPreprocessor测试规范

### 测试覆盖范围
```typescript
describe('RouterPreprocessor', () => {
  // 1. 核心功能测试
  describe('preprocess() - 核心功能测试', () => {
    test('应该成功处理路由表');
    test('应该生成正确的内部路由表结构');
    test('应该生成正确数量的流水线配置');
    test('应该为每个流水线配置生成完整的层定义');
  });

  // 2. 输入验证测试
  describe('输入验证测试', () => {
    test('应该拒绝空的路由表');
    test('应该拒绝没有Provider的路由表');
    test('应该拒绝没有路由的路由表');
  });

  // 3. 对应关系验证
  describe('流水线配置对应关系验证', () => {
    test('每个流水线配置都应该对应一个路由');
    test('lmstudio流水线配置应该正确');
    test('qwen流水线配置应该正确');
  });
});
```

### 输出文件规范
- `router-preprocessor-result.json`：完整处理结果
- `internal-routing-table.json`：内部路由表
- `pipeline-configs.json`：流水线配置数组

## 端到端测试

### 完整数据流测试
```
配置文件 → ConfigPreprocessor → RoutingTable → RouterPreprocessor → 流水线配置
```

### 验证点
1. **数据完整性**：确保每个阶段的数据都完整传递
2. **转换准确性**：验证每个转换步骤的准确性
3. **对应关系**：确保最终输出与原始配置的完整对应

### 端到端输出文件
- `end-to-end-result.json`：包含原始配置和所有处理结果的完整数据

## 测试配置文件

### 主测试配置
```json
{
  "version": "4.1",
  "Providers": [
    {
      "name": "lmstudio",
      "api_base_url": "http://localhost:1234/v1",
      "api_key": "lm-studio",
      "models": ["llama-3.1-8b", "qwen2.5-coder-32b"]
    },
    {
      "name": "qwen", 
      "api_base_url": "https://portal.qwen.ai/v1",
      "api_key": "qwen-auth-1",
      "models": ["qwen3-coder-plus", "qwen-max"]
    }
  ],
  "router": {
    "default": "lmstudio,llama-3.1-8b",
    "coding": "lmstudio,qwen2.5-coder-32b",
    "longContext": "qwen,qwen-max",
    "reasoning": "qwen,qwen3-coder-plus"
  },
  "server": {
    "port": 5506,
    "host": "0.0.0.0", 
    "debug": true
  },
  "APIKEY": "rcc4-proxy-key"
}
```

## 迁移计划

### Phase 1: 创建新测试结构
- [x] 创建ConfigPreprocessor测试
- [x] 创建RouterPreprocessor测试
- [ ] 创建PipelineLifecycleManager测试

### Phase 2: 迁移现有测试
- [ ] 迁移config相关测试到`src/config/__tests__/`
- [ ] 迁移router相关测试到`src/router/__tests__/`
- [ ] 迁移pipeline相关测试到`src/pipeline/__tests__/`

### Phase 3: 清理旧测试
- [ ] 删除`tests/`目录中的单元测试
- [ ] 保留`tests/`目录中的集成测试和E2E测试
- [ ] 更新测试配置文件

## Jest配置更新

### 新的测试路径
```javascript
module.exports = {
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx,js,jsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx,js,jsx}',
    '<rootDir>/tests/**/*.{test,spec}.{ts,tsx,js,jsx}' // 保留集成测试
  ],
  // ...
};
```

这种结构更符合现代的模块化开发实践，每个模块的测试与模块代码紧密结合，便于开发和维护。