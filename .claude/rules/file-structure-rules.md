# 📁 文件结构规则 (File Structure Rules)

## 🏗️ 项目目录结构标准 (Project Directory Standards)

### 根目录结构
```
claude-code-router/
├── .claude/                    # 规则管理系统
│   ├── rules/                  # 分类规则文件
│   └── project-details/        # 详细技术文档
├── src/                        # 源代码 (六层架构)
├── test/                       # 测试系统 (按功能分类)
├── tools/                      # 长期维护测试工具 (⭐ NEW)
├── docs/                       # 项目文档
├── examples/                   # 示例和参考实现
├── config/                     # 配置文件模板
├── scripts/                    # 工具脚本
└── dist/                       # 构建输出
```

### 核心目录详解

#### .claude/ - 规则管理系统
```
.claude/
├── rules/
│   ├── programming-rules.md           # 核心编程规范
│   ├── architecture-rules.md          # 架构设计规则
│   ├── testing-system-rules.md        # 测试框架规范
│   ├── file-structure-rules.md        # 文件组织规范
│   ├── deployment-rules.md            # 部署和发布规则
│   └── memory-system-rules.md         # 知识管理规则
└── project-details/
    ├── provider-implementations/      # 各Provider实现细节
    ├── routing-strategies/            # 路由策略文档
    ├── testing-strategies/           # 测试策略文档
    └── performance-analysis/         # 性能分析报告
```

#### tools/ - 长期维护测试工具 (⭐ NEW)
```
tools/
├── config.json                       # 全局工具配置
├── README.md                          # 工具系统总览
├── log-parser/                        # 日志解析工具集
│   ├── server-response-extractor/     # 服务器响应数据提取器
│   ├── provider-data-classifier/      # Provider数据分类器
│   └── time-series-analyzer/         # 时序数据分析器
├── visualization/                     # 可视化工具集
│   ├── sequence-diagram-generator/    # 时序图生成器
│   ├── request-flow-visualizer/       # 请求流程可视化器
│   └── performance-charts/           # 性能图表生成器
├── data-extraction/                   # 数据提取工具集
│   ├── provider-response-parser/      # Provider响应解析器
│   ├── tool-call-analyzer/           # 工具调用分析器
│   └── finish-reason-tracker/        # 完成原因追踪器
└── utilities/                         # 通用工具集
    ├── config-validator/             # 配置验证器
    ├── test-data-generator/          # 测试数据生成器
    └── performance-profiler/         # 性能分析器
```

**工具目录强制规范**:
- **统一管理**: 所有长期维护的测试工具必须放在 `tools/` 目录
- **分类组织**: 按功能分类到子目录（log-parser, visualization, data-extraction, utilities）
- **标准化**: 每个工具都有独立目录和完整文档
- **集成性**: 所有工具支持统一配置和调用方式

## 🎯 六层架构源码组织 (Six-Layer Source Organization)

### src/ 目录结构
```
src/
├── input/                      # 输入格式模块
│   ├── anthropic/             # Anthropic格式处理
│   │   ├── index.ts           # 模块入口
│   │   ├── processor.ts       # 请求处理器
│   │   └── validator.ts       # 格式验证器
│   ├── openai/                # OpenAI格式处理 (Mock)
│   └── gemini/                # Gemini格式处理 (Mock)
├── routing/                   # 模型路由模块
│   ├── engine.ts              # 核心路由引擎
│   ├── provider-manager.ts    # Provider管理器
│   ├── provider-expander.ts   # Provider扩展器
│   └── index.ts              # 路由模块入口
├── output/                    # 输出格式模块
│   ├── anthropic/             # Anthropic格式输出
│   └── openai/                # OpenAI格式输出
├── providers/                 # 提供商模块
│   ├── anthropic/             # Anthropic Provider
│   ├── codewhisperer/         # CodeWhisperer Provider
│   ├── openai/                # OpenAI Provider
│   ├── gemini/                # Gemini Provider
│   └── common/                # 通用工具
├── utils/                     # 工具模块
├── types/                     # 类型定义
└── server.ts                  # 服务器入口
```

### Provider模块组织规范

每个Provider必须包含以下标准文件：
```
providers/[provider-name]/
├── index.ts          # Provider入口和接口实现
├── client.ts         # HTTP客户端和API调用
├── auth.ts           # 认证和Token管理
├── converter.ts      # 格式转换器
├── parser.ts         # 响应解析器
└── types.ts          # Provider专用类型定义
```

## 🧪 测试目录组织规范 (Test Directory Standards)

### test/ 目录结构
```
test/
├── functional/              # 功能测试
│   ├── test-[功能].js       # 功能测试脚本
│   └── test-[功能].md       # 对应测试文档
├── integration/             # 集成测试
├── pipeline/               # 流水线测试
│   ├── test-step[N]-[功能].js  # 6步流水线测试
│   └── run-pipeline.sh     # 流水线运行器
├── performance/            # 性能测试
├── unit/                   # 单元测试
├── debug/                  # 调试测试
│   ├── debug-[问题].js     # 调试脚本
│   ├── debug-[问题].md     # 调试记录
│   └── debug-output/       # 调试输出数据
└── docs/                   # 测试文档
```

### 测试文件命名规范
- **功能测试**: `test-[一句话功能描述].js/md`
- **流水线测试**: `test-step[1-6]-[步骤功能].js/md`
- **组件测试**: `test-[组件名]-[功能].js/md`
- **调试脚本**: `debug-[问题关键词].js/md`
- **性能测试**: `test-[组件]-performance.js/md`

## 📝 配置文件组织 (Configuration File Organization)

### 配置文件位置
```
项目根目录/
├── config.sample.json          # 配置模板
├── config.production.json      # 生产环境配置
└── config/
    ├── test-config.json        # 测试配置
    └── comparison-config.json  # 对比测试配置

用户配置目录/
~/.route-claude-code/
├── config.json                 # 主配置文件
├── logs/                       # 日志目录
└── database/                   # 数据捕获目录
```

### 配置文件命名规范
- **环境配置**: `config.[环境].json`
- **功能配置**: `[功能]-config.json`
- **测试配置**: `test-[场景]-config.json`

## 📋 文档组织规范 (Documentation Standards)

### docs/ 目录结构
```
docs/
├── API-KEY-ROTATION.md         # API密钥轮换文档
├── LOAD_BALANCING.md          # 负载均衡文档
├── MULTI_PROVIDER_ROUTING.md  # 多Provider路由文档
├── TOOL_CALL_FIX.md           # 工具调用修复文档
└── [功能]-strategy.md          # 各功能策略文档
```

### 文档命名规范
- **技术文档**: `[功能名称].md` (全大写，下划线分隔)
- **策略文档**: `[策略名]-strategy.md`
- **修复文档**: `[问题名]-fix.md`
- **分析报告**: `[分析对象]-analysis.md`

## 🔧 脚本和工具组织 (Scripts and Tools Organization)

### 根目录脚本
```
项目根目录/
├── build.sh              # 构建脚本
├── start-dev.sh          # 开发启动脚本
├── test-runner.sh        # 测试运行器
├── install-local.sh      # 本地安装脚本
├── rcc                   # 主命令行工具
└── fix-and-test.sh       # 修复和测试一体化脚本
```

### 脚本命名规范
- **构建脚本**: `build[-环境].sh`
- **启动脚本**: `start-[模式].sh`
- **测试脚本**: `test-[功能].sh`
- **工具脚本**: `[功能]-[操作].sh`

## 📦 构建输出组织 (Build Output Organization)

### dist/ 目录结构
```
dist/
├── cli.js              # 主CLI入口 (可执行)
├── server.js           # 服务器入口
├── [模块]/             # 各模块编译输出
└── types/              # 类型定义文件
```

### 构建文件规范
- **主入口**: `cli.js` (必须包含shebang头)
- **模块输出**: 保持源码目录结构
- **类型文件**: `.d.ts` 类型定义文件

## 🗄️ 数据存储组织 (Data Storage Organization)

### 数据目录结构
```
~/.route-claude-code/database/
├── captures/              # 实时数据捕获
│   └── YYYY-MM-DD/       # 按日期组织
├── pipeline-tests/        # 流水线测试数据
├── [provider-name]/       # 按Provider分类
├── daily-aggregates/      # 日聚合数据
└── archives/              # 长期归档
```

### 数据文件命名
- **捕获数据**: `session-[session-id]-[request-id].json`
- **测试数据**: `[test-name]-[timestamp].json`
- **聚合数据**: `[provider]-[date]-aggregate.json`
- **归档数据**: `[date]-[type]-archive.tar.gz`

## 🚨 文件创建规则 (File Creation Rules)

### 强制规则
1. **禁止创建冗余文件**: 优先编辑现有文件而非创建新文件
2. **禁止主动创建文档**: 除非用户明确要求，否则不创建.md文件
3. **遵循命名规范**: 所有新文件必须遵循既定命名规范
4. **维护目录结构**: 新文件必须放在正确的目录位置

### 文件创建检查清单
- [ ] 检查是否已有类似功能的文件可以编辑
- [ ] 确认文件名符合命名规范
- [ ] 验证文件位置符合目录结构规范
- [ ] 添加必要的文件头信息（作者、版本等）

### 项目所有权声明
所有新创建的文件必须包含项目所有权声明：
```typescript
/**
 * Project: claude-code-router
 * Owner: Jason Zhang
 * Created: [创建日期]
 * Version: v2.6.0+
 */
```

## 🔍 文件维护规则 (File Maintenance Rules)

### 代码文件维护
- **行数限制**: 单文件不超过500行代码
- **函数长度**: 单函数不超过50行代码
- **导入管理**: 保持导入语句的整洁和有序
- **注释维护**: 关键逻辑必须有清晰注释

### 配置文件维护
- **版本同步**: 配置文件版本与项目版本同步
- **示例更新**: 配置模板文件及时更新
- **敏感信息**: 绝不在配置模板中包含真实凭据

### 文档文件维护
- **内容同步**: 文档内容与实际代码实现同步
- **链接检查**: 定期检查文档中的链接有效性
- **格式统一**: 使用统一的Markdown格式规范

---
**文件结构版本**: v2.6.0  
**维护者**: Jason Zhang  
**最后更新**: 2025-08-01