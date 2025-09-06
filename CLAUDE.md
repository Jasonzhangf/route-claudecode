## 🧪 重构后的测试框架设计 (REFACTORED TEST FRAMEWORK)

### 🎯 测试框架重构目标

基于一次性预处理器架构的新测试框架，支持：

1. **模块内聚测试**：每个模块的测试放在模块目录下的`__tests__`文件夹
2. **预处理器单元测试**：专门测试ConfigPreprocessor和RouterPreprocessor的零接口暴露设计
3. **输出表验证测试**：验证每个输出表与配置文件的完整对应关系
4. **端到端数据流测试**：完整的配置文件 → 路由表 → 流水线配置流程测试
5. **转换功能测试**：专门针对 Anthropic 到 OpenAI 格式转换的测试
6. **自动化比较验证**：RCC v4.0 与 Claude Code Router 结果对比

### 📁 新的测试目录结构

```
src/
├── config/
│   ├── __tests__/
│   │   ├── config-preprocessor.test.ts     # ConfigPreprocessor单元测试
│   │   └── test-outputs/                   # 测试输出目录
│   │       ├── config-preprocessor-result.json
│   │       ├── routing-table.json
│   │       └── end-to-end-result.json
│   ├── config-preprocessor.ts              # 一次性配置预处理器
│   └── routing-table-types.ts              # 路由表类型定义
├── router/
│   ├── __tests__/
│   │   ├── router-preprocessor.test.ts     # RouterPreprocessor单元测试
│   │   └── test-outputs/                   # 测试输出目录
│   │       ├── router-preprocessor-result.json
│   │       ├── internal-routing-table.json
│   │       └── pipeline-configs.json
│   ├── router-preprocessor.ts              # 一次性路由器预处理器
│   └── pipeline-router.ts                  # 重构后的流水线路由器
├── __tests__/                              # 转换测试用例目录
│   ├── basic-transformer.test.ts           # 基本转换测试
│   ├── tool-calling-transformer.test.ts    # 工具调用转换测试
│   ├── streaming-protocol.test.ts          # 流式协议转换测试
│   └── complex-scenarios.test.ts           # 复杂场景测试
└── pipeline/
    ├── __tests__/
    │   └── pipeline-lifecycle-manager.test.ts
    └── pipeline-lifecycle-manager.ts
```

### 🔬 预处理器测试规范

#### ConfigPreprocessor测试覆盖
- **配置文件解析**：支持简单格式和v4格式
- **Provider信息转换**：验证每个Provider的完整信息转换
- **路由映射生成**：确保所有路由（显式+自动生成）的正确性
- **服务器配置映射**：验证服务器配置的完整对应
- **错误处理**：测试无效配置文件的拒绝机制
- **零接口暴露**：验证只能调用`preprocess()`方法

#### RouterPreprocessor测试覆盖
- **路由表输入验证**：确保输入数据的完整性验证
- **内部路由表生成**：验证PipelineRoute结构的正确性
- **流水线配置生成**：确保每个路由都有对应的流水线配置
- **六层流水线架构**：验证每个流水线的6层结构完整性
- **优先级处理**：确保路由优先级的正确排序
- **零接口暴露**：验证只能调用`preprocess()`方法

### 🔁 转换测试规范

#### 基本转换测试 (basic-transformer.test.ts)
- **简单消息转换**：验证基础用户消息的转换
- **系统消息处理**：验证系统消息到system role的转换
- **多轮对话转换**：验证多轮对话结构的保持
- **参数保留验证**：验证temperature、max_tokens等参数的保留

#### 工具调用转换测试 (tool-calling-transformer.test.ts)
- **工具定义转换**：验证tools到functions的转换
- **工具使用转换**：验证tool_use到tool_calls的转换
- **工具结果转换**：验证tool_result到tool role的转换

#### 流式协议测试 (streaming-protocol.test.ts)
- **流式请求处理**：验证stream参数的正确处理
- **流式参数保留**：验证流式传输时其他参数的保留

#### 复杂场景测试 (complex-scenarios.test.ts)
- **嵌套内容块处理**：验证复杂content结构的处理
- **混合内容与工具调用**：验证同时包含内容和工具的场景
- **复杂工具使用序列**：验证多步骤工具调用的转换

### 📊 输出表验证标准

#### 必须保存的测试输出文件
1. **config-preprocessor-result.json**：ConfigPreprocessor完整处理结果
2. **routing-table.json**：生成的标准路由表
3. **router-preprocessor-result.json**：RouterPreprocessor完整处理结果
4. **internal-routing-table.json**：内部路由表（PipelineRoute格式）
5. **pipeline-configs.json**：流水线配置数组
6. **end-to-end-result.json**：端到端完整数据流结果

#### 对应关系验证要求
- **Provider对应**：每个输出Provider必须对应配置文件中的Provider
- **路由对应**：每个路由必须对应配置文件中的显式路由或自动生成规则
- **服务器配置对应**：输出的服务器配置必须完全匹配输入配置
- **流水线对应**：每个流水线配置必须对应一个有效的路由映射
- **数据完整性**：确保处理过程中没有数据丢失或错误转换

### 🔄 自动化测试和比较系统

#### 测试执行流程
```bash
# 启动测试环境
./scripts/start-test-environment.sh

# 运行所有测试
npm run test:all

# 生成比较报告（与 Claude Code Router 对比）
npm run test:compare

# 验证自动修复功能
npm run test:verify

# 停止测试环境
./scripts/stop-test-environment.sh
```

#### 比较验证功能
- **结果对比**：自动比较 RCC v4.0 与 Claude Code Router 的转换结果
- **差异分析**：生成详细的差异报告
- **匹配率统计**：计算转换结果的匹配率
- **修复建议**：基于差异自动生成修复建议

### 🧪 测试配置文件规范

#### 标准测试配置：`/Users/fanzhang/.route-claudecode/config.json`
```json
{
  "version": "4.1",
  "Providers": [
    {
      "name": "lmstudio",
      "priority": 1,
      "api_base_url": "http://localhost:1234/v1",
      "api_key": "lm-studio",
      "models": ["llama-3.1-8b", "qwen2.5-coder-32b"]
    },
    {
      "name": "qwen",
      "priority": 2,
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

### 🏃‍♂️ 测试执行流程

#### 单模块测试
```bash
# ConfigPreprocessor测试
npx jest src/config/__tests__/config-preprocessor.test.ts --verbose

# RouterPreprocessor测试
npx jest src/router/__tests__/router-preprocessor.test.ts --verbose

# 转换功能测试
npm run test:basic
npm run test:tools
npm run test:streaming
npm run test:complex
```

#### 完整测试流程
```bash
# 编译TypeScript代码
npm run build

# 运行所有单元测试
npm test

# 运行转换测试套件
npm run test:all

# 生成比较报告
npm run test:compare

# 检查测试输出
ls -la src/config/__tests__/test-outputs/
ls -la src/router/__tests__/test-outputs/
ls -la test-results/
```

### ✅ 测试成功标准

#### 必须满足的条件
- **编译通过**：所有TypeScript代码无编译错误
- **测试通过**：所有单元测试100%通过
- **输出文件生成**：所有必需的输出文件成功生成
- **对应关系验证**：输出表与配置文件的完全对应
- **数据完整性**：端到端数据流的完整性验证
- **零接口暴露验证**：确认只能访问预处理器的公开方法
- **转换准确性**：Anthropic到OpenAI转换的准确性验证
- **兼容性验证**：与Claude Code Router的兼容性验证

#### 性能要求
- **ConfigPreprocessor处理时间**：< 50ms
- **RouterPreprocessor处理时间**：< 30ms
- **端到端处理时间**：< 100ms
- **转换响应时间**：< 50ms
- **输出文件大小**：合理的JSON格式，便于分析

### 📋 测试迁移计划

#### Phase 1: 新测试结构建立 ✅
- [x] 创建ConfigPreprocessor单元测试
- [x] 创建RouterPreprocessor单元测试
- [x] 建立模块内测试目录结构
- [x] 创建转换测试用例
- [x] 实现自动化测试脚本

#### Phase 2: 现有测试迁移
- [ ] 迁移config相关测试到`src/config/__tests__/`
- [ ] 迁移router相关测试到`src/router/__tests__/`
- [ ] 迁移pipeline相关测试到对应模块

#### Phase 3: 测试框架清理
- [ ] 清理`tests/`目录中的重复单元测试
- [ ] 保留集成测试和E2E测试在`tests/`目录
- [ ] 更新Jest配置以支持新的测试路径

这种模块内聚的测试结构更符合现代开发实践，每个模块的测试与代码紧密结合，便于独立开发和维护，同时确保了一次性预处理器架构的测试完整性。新增的转换测试和自动化比较系统确保了RCC v4.0与Claude Code Router的兼容性。

详细文档请参考：
- [测试模块设计文档](.claude/project-details/modules/testing/README.md)
- [RCC v4.0 测试框架文档](.claude/project-details/modules/testing/test-framework-v4.md)
- [重构后的测试框架设计](.claude/project-details/modules/testing/refactored-test-framework.md)
- [测试系统索引](.claude/project-details/modules/testing/INDEX.md)