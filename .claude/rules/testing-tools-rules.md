# 🔧 测试工具规则 (Testing Tools Rules)

## 🎯 核心原则 (Core Principles)

### 强制规则 (MANDATORY RULES)
1. **统一工具管理**: 所有长期维护的测试工具必须放在 `./tools` 目录下，不允许分散在其他位置
2. **功能特化**: 每个工具专注于单一功能，避免功能重复和耦合
3. **标准化接口**: 所有工具支持统一的调用方式和配置格式
4. **完整文档**: 每个工具都必须包含完整的说明文档和使用示例
5. **与测试框架集成**: 所有工具必须与STD-8-STEP-PIPELINE测试框架集成

### 设计原则 (DESIGN PRINCIPLES)
- **细菌式编程**: 小巧、模块化、自包含
- **零硬编码**: 所有配置通过文件管理，不允许硬编码
- **高性能**: 处理大型日志文件不超过30秒，峰值内存不超过512MB
- **用户友好**: 提供清晰的错误信息和使用指导

## 📁 工具目录架构 (Tools Directory Architecture)

### 强制目录结构
```
tools/
├── config.json                        # 全局工具配置文件
├── README.md                           # 工具系统总览文档
├── DEVELOPMENT.md                      # 工具开发指南
├── log-parser/                         # 日志解析工具集
│   ├── server-response-extractor/      # 服务器响应数据提取器
│   │   ├── index.js                   # 主程序入口
│   │   ├── config.json                # 工具配置
│   │   ├── README.md                  # 工具说明
│   │   ├── CHANGELOG.md               # 版本历史
│   │   └── lib/                       # 核心库文件
│   ├── provider-data-classifier/       # Provider数据分类器
│   └── time-series-analyzer/          # 时序数据分析器
├── visualization/                      # 可视化工具集
│   ├── sequence-diagram-generator/     # 时序图生成器
│   │   ├── index.js                   # 主程序入口
│   │   ├── config.json                # 工具配置
│   │   ├── README.md                  # 工具说明
│   │   ├── templates/                 # HTML模板
│   │   └── assets/                    # 静态资源
│   ├── request-flow-visualizer/        # 请求流程可视化器
│   └── performance-charts/            # 性能图表生成器
├── data-extraction/                    # 数据提取工具集
│   ├── provider-response-parser/       # Provider响应解析器
│   ├── tool-call-analyzer/            # 工具调用分析器
│   └── finish-reason-tracker/         # 完成原因追踪器
└── utilities/                          # 通用工具集
    ├── config-validator/              # 配置验证器
    ├── test-data-generator/           # 测试数据生成器
    └── performance-profiler/          # 性能分析器
```

### 工具实现标准 (Tool Implementation Standards)

#### 标准文件结构
每个工具目录必须包含：
```
[tool-name]/
├── index.js                    # 主程序入口 (必需)
├── config.json                 # 工具配置文件 (必需)
├── README.md                   # 工具说明文档 (必需)
├── CHANGELOG.md                # 版本更新记录 (必需)
├── package.json                # 依赖管理文件 (可选)
├── lib/                        # 核心库文件 (可选)
├── templates/                  # 模板文件 (可选)
├── assets/                     # 静态资源 (可选)
└── tests/                      # 单元测试 (推荐)
```

#### 主程序入口规范 (`index.js`)
```javascript
#!/usr/bin/env node

/**
 * Project: claude-code-router
 * Tool: [工具名称]
 * Owner: Jason Zhang
 * Created: [创建日期]
 * Version: 1.0.0
 */

// 标准化的命令行接口
const args = process.argv.slice(2);

// 支持标准化参数
if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
}

// 主程序逻辑
async function main() {
    try {
        // 工具核心逻辑
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

main();
```

#### 配置文件规范 (`config.json`)
```json
{
  "tool": {
    "name": "[工具名称]",
    "version": "1.0.0",
    "description": "[工具描述]",
    "author": "Jason Zhang"
  },
  "settings": {
    "inputPath": "~/.route-claude-code/logs/",
    "outputPath": "~/.route-claude-code/providers/",
    "maxMemory": "512MB",
    "timeout": 30000,
    "logLevel": "info"
  },
  "extraction": {
    "providers": ["anthropic", "codewhisperer", "openai", "gemini"],
    "categories": ["long-text", "normal-text", "tool-calls"],
    "timeFormat": "ISO8601",
    "batchSize": 1000
  }
}
```

## 🎯 核心工具规范 (Core Tools Specifications)

### 1. 日志解析数据库工具 (`tools/log-parser/server-response-extractor`)

#### 功能描述
从3456端口日志解析经过provider归类的数据，实现自动化数据提取和分类存储。

#### 核心功能要求
- **日志文件解析**: 支持多种日志格式，自动识别日志结构
- **Provider分类**: 按Provider自动分类数据（anthropic、codewhisperer、openai、gemini）
- **内容分类**: 按响应类型分类（长文本、普通文本、工具调用）
- **时间序列**: 按时间顺序组织数据，支持时间范围查询
- **数据存储**: 保存至 `~/.route-claude-code/providers` 目录
- **文档生成**: 自动生成README说明数据格式和内容

#### 数据提取规则
```json
{
  "extractionRules": {
    "logPatterns": {
      "requestStart": "\\[REQUEST\\].*requestId:\\s*(\\S+)",
      "responseEnd": "\\[RESPONSE\\].*requestId:\\s*(\\S+)",
      "providerMatch": "provider:\\s*(\\w+)",
      "modelMatch": "model:\\s*([\\w\\-\\.]+)",
      "finishReason": "finish_reason:\\s*(\\w+)"
    },
    "contentClassification": {
      "longText": { "minLength": 2000 },
      "toolCalls": { "hasPattern": "tool_calls|function_call" },
      "normalText": { "default": true }
    },
    "timeExtraction": {
      "format": "YYYY-MM-DD HH:mm:ss.SSS",
      "timezone": "UTC"
    }
  }
}
```

#### 输出数据格式
```json
{
  "metadata": {
    "extractionInfo": {
      "toolPath": "./tools/log-parser/server-response-extractor",
      "version": "1.0.0",
      "extractedAt": "2025-08-07T10:30:00Z",
      "sourceLog": "/path/to/source.log",
      "totalRecords": 1543,
      "processingTime": "12.5s"
    },
    "statistics": {
      "byProvider": {
        "anthropic": 456,
        "codewhisperer": 389,
        "openai": 412,
        "gemini": 286
      },
      "byCategory": {
        "long-text": 234,
        "normal-text": 987,
        "tool-calls": 322
      }
    }
  },
  "data": [
    {
      "sessionId": "sess-001",
      "requestId": "req-12345",
      "provider": "anthropic",
      "model": "claude-3-sonnet-20240229",
      "category": "tool-calls",
      "timestamp": "2025-08-07T10:25:00.123Z",
      "request": {
        "method": "POST",
        "endpoint": "/v1/messages",
        "headers": { "content-type": "application/json" },
        "body": { /* 请求内容 */ }
      },
      "response": {
        "status": 200,
        "headers": { "content-type": "application/json" },
        "body": { /* 响应内容 */ },
        "finishReason": "tool_use",
        "processingTime": 2.3
      },
      "routing": {
        "category": "default",
        "selectedProvider": "anthropic",
        "routingTime": 0.1
      }
    }
  ]
}
```

### 2. 时序图生成工具 (`tools/visualization/sequence-diagram-generator`)

#### 功能描述
根据日志解析数据生成HTML格式的交互式时序图，显示完整的请求-响应时序关系。

#### 核心功能要求
- **时序解析**: 解析日志中的请求-响应时序关系
- **HTML生成**: 生成交互式HTML时序图
- **时间标记**: 精确到毫秒的时间戳标记
- **颜色编码**: 按requestID使用唯一颜色标识
- **交互功能**: 支持点击查看详细数据
- **性能指标**: 显示各阶段耗时统计
- **错误标识**: 失败请求红色高亮显示

#### 时序图生成配置
```json
{
  "visualization": {
    "theme": "light",
    "colorScheme": "automatic",
    "timeAxis": {
      "precision": "millisecond",
      "format": "HH:mm:ss.SSS"
    },
    "requestTracking": {
      "colorByRequestId": true,
      "maxColors": 20,
      "errorColor": "#FF0000"
    },
    "interactivity": {
      "clickToExpand": true,
      "hoverDetails": true,
      "zoomEnabled": true
    }
  }
}
```

#### HTML模板结构
```html
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Router - Request Sequence Diagram</title>
    <style>/* 样式定义 */</style>
    <script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>
    <div id="diagram-container">
        <div id="timeline"></div>
        <div id="requests"></div>
        <div id="details-panel"></div>
    </div>
    <script>
        // 时序图渲染逻辑
    </script>
</body>
</html>
```

#### 时序图特性要求
- **时间轴**: 水平时间轴，支持缩放和平移
- **请求线程**: 垂直线程显示不同请求
- **颜色编码**: 每个requestID使用唯一颜色
- **交互提示**: 鼠标悬停显示详细信息
- **性能指标**: 显示响应时间、排队时间、处理时间
- **错误处理**: 失败请求特殊标识和错误信息

## 📋 数据存储规范 (Data Storage Standards)

### Provider数据目录结构
```
~/.route-claude-code/providers/
├── anthropic/
│   ├── long-text/
│   │   ├── 2025-08-07/
│   │   │   ├── session-001.json
│   │   │   ├── session-002.json
│   │   │   └── daily-summary.json
│   │   └── README.md
│   ├── normal-text/
│   ├── tool-calls/
│   ├── metadata/
│   │   ├── extraction-info.json
│   │   ├── statistics.json
│   │   └── data-schema.json
│   └── README.md
├── codewhisperer/
├── openai/
├── gemini/
└── extraction-logs/
    ├── 2025-08-07-extraction.log
    └── error-logs/
```

### 数据文件命名规范
- **会话数据**: `session-[session-id].json`
- **日汇总**: `daily-summary-YYYY-MM-DD.json`
- **提取日志**: `YYYY-MM-DD-extraction.log`
- **错误日志**: `error-YYYY-MM-DD-HH-mm.log`
- **配置快照**: `config-snapshot-[timestamp].json`

### README文档模板
每个provider目录和子目录都必须包含README.md：

```markdown
# [Provider Name] Data Collection

## 工具信息
- **工具路径**: ./tools/log-parser/server-response-extractor
- **版本**: 1.0.0
- **最后更新**: 2025-08-07T10:30:00Z

## 数据格式
### 会话数据结构
\`\`\`json
{
  "sessionId": "会话标识符",
  "requestId": "请求标识符",
  "provider": "提供商名称",
  "model": "模型名称",
  "category": "数据类别",
  "timestamp": "时间戳",
  "request": "请求内容",
  "response": "响应内容"
}
\`\`\`

## 数据统计
- **总记录数**: 1,234
- **时间范围**: 2025-08-01 to 2025-08-07
- **平均响应时间**: 2.3s
- **成功率**: 99.2%

## 使用说明
1. 数据按日期分组存储
2. 每日自动生成汇总文件
3. 支持按时间范围查询
4. 提供完整的错误日志跟踪
```

## 🔍 工具集成规范 (Tool Integration Standards)

### 与STD-8-STEP-PIPELINE集成

#### 集成点定义
- **Step 1-2**: 输入数据提取和预处理验证
- **Step 3-4**: 路由和请求转换数据分析
- **Step 5**: 原始API响应数据捕获
- **Step 6-8**: 响应处理和输出数据验证

#### 数据流集成
```javascript
// 测试流水线中的工具调用示例
const extractor = require('./tools/log-parser/server-response-extractor');
const visualizer = require('./tools/visualization/sequence-diagram-generator');

// Step 5: 捕获原始API响应
const capturedData = await extractor.captureAPIResponse(step5Output);

// Step 8: 生成时序图
const sequenceDiagram = await visualizer.generateDiagram(capturedData);
```

### 命令行集成规范

#### 统一调用接口
```bash
# 标准调用格式
./tools/[category]/[tool-name] [options]

# 示例调用
./tools/log-parser/server-response-extractor --input /path/to/log --output /path/to/data
./tools/visualization/sequence-diagram-generator --data /path/to/data --output diagram.html

# 全局配置支持
./tools/log-parser/server-response-extractor --config ./tools/config.json

# 帮助信息
./tools/log-parser/server-response-extractor --help
```

#### 标准参数支持
所有工具必须支持：
- `--help, -h`: 显示帮助信息
- `--version, -v`: 显示版本信息
- `--config, -c`: 指定配置文件
- `--verbose`: 详细输出模式
- `--dry-run`: 预演模式，不执行实际操作
- `--output, -o`: 指定输出路径

## 🚨 质量保证规则 (Quality Assurance Rules)

### 代码质量要求
- **ESLint合规**: 使用项目统一的ESLint配置
- **单元测试**: 关键功能必须有单元测试覆盖
- **错误处理**: 完整的错误捕获和恢复机制
- **日志记录**: 结构化的日志输出，支持不同级别
- **性能要求**: 处理大文件不超过30秒，内存使用不超过512MB

### 文档质量要求
- **API文档**: 清晰的函数和参数说明
- **使用示例**: 包含完整的使用示例
- **故障排除**: 常见问题和解决方案
- **更新记录**: 详细的版本更新历史

### 测试要求
```bash
# 每个工具的测试套件
tools/[tool-name]/tests/
├── unit/                   # 单元测试
├── integration/           # 集成测试
├── performance/          # 性能测试
└── fixtures/             # 测试数据
```

## 📊 监控和维护 (Monitoring and Maintenance)

### 性能监控指标
- **处理速度**: 每秒处理记录数
- **内存使用**: 峰值和平均内存消耗
- **错误率**: 处理失败率和错误类型分布
- **响应时间**: 工具执行时间分布

### 维护检查清单
- [ ] 定期检查工具配置文件有效性
- [ ] 验证数据存储路径和权限
- [ ] 更新工具文档和示例
- [ ] 执行性能回归测试
- [ ] 检查与STD-8-STEP-PIPELINE的集成状态

## 🔄 版本管理和更新 (Version Management)

### 版本号规范
使用语义化版本号：`MAJOR.MINOR.PATCH`
- **MAJOR**: 不兼容的API变更
- **MINOR**: 向后兼容的功能新增
- **PATCH**: 向后兼容的问题修复

### 更新流程
1. **开发阶段**: 在独立分支进行工具开发
2. **测试验证**: 运行完整测试套件
3. **文档更新**: 更新README和CHANGELOG
4. **集成测试**: 验证与测试框架的集成
5. **发布部署**: 合并到主分支并标记版本

### 兼容性保证
- **向后兼容**: 新版本必须兼容现有数据格式
- **配置迁移**: 提供配置文件自动迁移工具
- **数据转换**: 支持历史数据格式转换
- **渐进升级**: 支持逐步升级而非强制升级

---
**测试工具规则版本**: v1.0.0  
**维护者**: Jason Zhang  
**最后更新**: 2025-08-07  
**与测试框架版本兼容**: STD-8-STEP-PIPELINE v3.0