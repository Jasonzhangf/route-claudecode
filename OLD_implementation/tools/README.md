# 🔧 Claude Code Router 测试工具系统

## 📋 概览 (Overview)

这是Claude Code Router项目的统一测试工具管理系统，提供日志解析、数据提取、可视化和分析功能。

### ⚡ 快速开始
```bash
# 查看所有可用工具
ls -la ./tools/

# 查看工具配置
cat ./tools/config.json

# 运行日志解析工具（示例）
./tools/log-parser/server-response-extractor --help

# 生成时序图（示例）
./tools/visualization/sequence-diagram-generator --help
```

## 🏗️ 工具架构 (Architecture)

### 工具分类
- **📊 log-parser/**: 日志解析和数据提取工具
- **📈 visualization/**: 数据可视化和图表生成工具  
- **🔍 data-extraction/**: 专业数据提取和分析工具
- **⚙️ utilities/**: 通用工具和辅助脚本

### 核心工具

#### 1. 日志解析数据库工具
- **工具路径**: `./tools/log-parser/server-response-extractor`
- **功能**: 从3456端口日志解析Provider分类数据
- **输出**: `~/.route-claude-code/providers/[provider-name]/`
- **支持格式**: JSON、CSV、统计报告

#### 2. 时序图生成器
- **工具路径**: `./tools/visualization/sequence-diagram-generator`
- **功能**: 生成HTML格式的交互式时序图
- **特性**: requestID颜色编码、毫秒精度时间戳、交互式详情
- **输出格式**: HTML、SVG、PNG

## 📁 数据存储结构 (Data Storage Structure)

### Provider数据目录
```
~/.route-claude-code/providers/
├── anthropic/
│   ├── long-text/              # 长文本响应 (>2000字符)
│   ├── normal-text/            # 普通文本响应
│   ├── tool-calls/             # 工具调用响应
│   ├── metadata/               # 提取元信息
│   └── README.md               # 数据说明文档
├── codewhisperer/
├── openai/
├── gemini/
└── extraction-logs/            # 工具执行日志
```

### 数据文件命名规范
- **会话数据**: `session-[session-id].json`
- **日汇总**: `daily-summary-YYYY-MM-DD.json`
- **提取日志**: `YYYY-MM-DD-extraction.log`
- **时序图**: `sequence-diagram-[timestamp].html`

## 🎯 核心功能 (Core Features)

### 自动数据分类
- **长文本检测**: 自动识别>2000字符的响应
- **工具调用识别**: 检测tool_calls/function_call模式
- **Provider分类**: 按API提供商自动归类
- **时间序列**: 按时间戳排序和分组

### 实时监控
- **性能统计**: 响应时间、处理时间、队列时间
- **错误追踪**: 失败请求和错误原因分析
- **负载分析**: Provider负载分布和健康状态
- **趋势分析**: 历史数据趋势和模式识别

### 交互式可视化
- **时序图**: 请求-响应完整时间线
- **流程图**: 数据流和处理步骤
- **统计图表**: 性能指标和使用统计
- **错误分析**: 错误分布和根因分析

## ⚙️ 配置管理 (Configuration Management)

### 全局配置 (`config.json`)
```json
{
  "globalSettings": {
    "version": "1.0.0",
    "project": "claude-code-router"
  },
  "paths": {
    "inputLogs": "~/.route-claude-code/logs/",
    "outputData": "~/.route-claude-code/providers/"
  },
  "performance": {
    "maxMemoryMB": 512,
    "timeoutSeconds": 30
  }
}
```

### 工具特定配置
每个工具都有独立的`config.json`文件，继承全局配置并提供特定设置。

## 🔍 与测试框架集成 (Testing Framework Integration)

### STD-8-STEP-PIPELINE集成
- **Step 1-2**: 输入数据捕获和预处理验证
- **Step 3-4**: 路由决策和转换数据分析
- **Step 5**: 原始API响应数据提取
- **Step 6-8**: 响应处理和输出质量验证

### 测试数据流
```
测试执行 → 日志生成 → 数据提取 → 分类存储 → 可视化分析 → 报告生成
```

## 📊 使用示例 (Usage Examples)

### 提取昨天的所有Provider数据
```bash
./tools/log-parser/server-response-extractor \
  --date yesterday \
  --all-providers \
  --output ~/.route-claude-code/providers/
```

### 生成今天的时序图
```bash
./tools/visualization/sequence-diagram-generator \
  --input ~/.route-claude-code/providers/ \
  --date today \
  --output sequence-diagram-$(date +%Y%m%d).html
```

### 分析工具调用性能
```bash
./tools/data-extraction/tool-call-analyzer \
  --provider anthropic \
  --time-range "last-7-days" \
  --metrics performance,errors,success-rate
```

## 🚨 注意事项 (Important Notes)

### 性能限制
- **内存使用**: 每个工具最大512MB内存
- **执行时间**: 处理大文件不超过30秒
- **并发限制**: 同时运行工具不超过3个

### 数据安全
- **敏感信息**: 工具会自动过滤API密钥和认证信息
- **访问权限**: 数据文件使用用户私有权限(600)
- **日志轮转**: 自动清理超过30天的历史数据

### 故障排除
- **工具无响应**: 检查内存使用和磁盘空间
- **数据提取失败**: 验证日志文件格式和权限
- **可视化异常**: 确保浏览器支持现代JavaScript

## 📈 未来规划 (Future Planning)

### v1.1.0 计划功能
- [ ] 实时数据流式处理
- [ ] 机器学习异常检测
- [ ] 自动化报告生成
- [ ] 多格式数据导出

### v1.2.0 计划功能
- [ ] 分布式数据处理
- [ ] 高级分析算法
- [ ] API接口支持
- [ ] 企业级监控集成

## 🔧 开发指南 (Development Guide)

### 新工具开发
1. 在对应分类目录创建工具目录
2. 实现标准接口（--help, --version, --config）
3. 编写完整文档（README.md, CHANGELOG.md）
4. 添加单元测试和集成测试
5. 更新全局配置和文档

### 贡献流程
1. Fork项目并创建功能分支
2. 实现新功能并编写测试
3. 更新相关文档
4. 提交Pull Request
5. 通过代码审查和测试验证

---
**工具系统版本**: v1.0.0  
**项目**: Claude Code Router v2.7.0  
**维护者**: Jason Zhang  
**最后更新**: 2025-08-07  
**文档完整性**: ✅ 完整规范文档  
**集成状态**: ✅ 与STD-8-STEP-PIPELINE完全集成