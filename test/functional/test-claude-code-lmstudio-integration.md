# Claude Code + LMStudio 集成测试

## 测试用例
验证Claude Code客户端与LMStudio后端的完整集成，包括连接、路由、协议兼容性和工具调用处理

## 测试目标
- 验证Claude Code客户端连接正常
- 确认路由系统正确工作
- 测试OpenAI协议响应处理
- 验证LMStudio工具调用处理功能
- 进行端到端的集成验证

## 测试架构

### 🔧 测试配置
- **LMStudio端口**: 5506
- **配置文件**: config-lmstudio-v3-5506.json
- **测试模型**: qwen3-30b
- **超时设置**: 30秒
- **数据捕获**: 自动捕获请求、响应和错误

### 📋 测试用例集
1. **basic-connection-test**: 基本Claude Code连接测试
2. **simple-tool-call-test**: 简单工具调用（bash echo测试）
3. **complex-tool-call-test**: 复杂多工具调用测试
4. **routing-validation-test**: 路由正确性验证
5. **openai-protocol-compliance-test**: OpenAI协议兼容性验证

## 测试阶段详解

### 🔍 阶段1: 环境验证和准备
**目标**: 确保测试环境就绪
- 创建输出目录结构
- 验证rcc3命令可用性
- 检查LMStudio配置文件存在性
- 验证LMStudio桌面应用状态
- 清理端口冲突

### 🚀 阶段2: 服务启动和健康检查
**目标**: 启动并验证LMStudio路由服务
- 启动LMStudio路由服务（端口5506）
- 等待服务完全就绪
- 执行健康检查（/health端点）
- 获取服务信息（/v1/models端点）

### 🔗 阶段3: Claude Code客户端连接测试
**目标**: 验证客户端连接能力
- 模拟Claude Code客户端连接
- 验证认证和授权机制
- 测试基本通信功能
- 验证协议握手过程

### 🌐 阶段4: 路由正确性验证
**目标**: 确认路由系统正常工作
- 验证请求正确路由到LMStudio后端
- 测试模型选择逻辑
- 验证Provider映射关系
- 测试负载均衡（如适用）

### 📡 阶段5: OpenAI协议响应测试
**目标**: 验证OpenAI协议兼容性
- 测试标准chat completions接口
- 验证流式响应处理
- 检查响应格式兼容性
- 测试错误处理机制

### 🔧 阶段6: LMStudio工具调用验证
**目标**: 验证工具调用完整链路
- 简单工具调用测试（bash命令）
- 复杂工具调用测试（多工具组合）
- 并发工具调用测试
- 工具调用解析准确性验证（目标>=90%）

### 🎯 阶段7: 端到端集成验证
**目标**: 验证完整工作流程
- 完整工作流测试
- 性能基准测试
- 稳定性测试
- 数据完整性验证

## 数据捕获机制

### 📊 自动数据捕获
系统会自动捕获：
- **请求数据**: 发送给LMStudio的原始请求
- **响应数据**: 从LMStudio返回的响应
- **错误数据**: 测试过程中的任何错误
- **性能数据**: 响应时间和吞吐量指标

### 📁 输出目录结构
```
test/output/functional/test-claude-lmstudio-data/
├── {testName}-{timestamp}.json     # 具体测试数据
├── error-{testName}-{timestamp}.json  # 错误日志
├── integration-test-report.md      # 可读性报告
└── {sessionId}.json               # 完整测试报告
```

## 成功标准

### ✅ 阶段成功标准
- **阶段1**: 至少4/6项预检查通过
- **阶段2**: 服务成功启动且健康检查通过
- **阶段3**: 客户端连接和认证成功
- **阶段4**: 路由验证和模型选择正确
- **阶段5**: OpenAI协议响应格式正确
- **阶段6**: 工具调用解析准确性≥90%
- **阶段7**: 端到端工作流完整执行

### 📊 整体成功标准
- 总成功率≥80%（推荐≥90%）
- 关键阶段（2,3,5,6）必须全部通过
- 无关键性错误发生

## 最近执行记录

### 执行时间: 待执行
- **状态**: 新建集成测试
- **执行时长**: 预计6-10分钟
- **日志文件**: 待生成

## 历史执行记录
- 无历史记录

## 相关文件
- **主测试脚本**: test/functional/test-claude-code-lmstudio-integration.js
- **配置目录**: ~/.route-claudecode/config/v3/single-provider/
- **输出目录**: test/output/functional/test-claude-lmstudio-data/

## 使用方法

### 单独运行
```bash
node test/functional/test-claude-code-lmstudio-integration.js
```

### 作为主控测试套件运行
```bash
node run-lmstudio-validation.js
```

### 前置条件
1. LMStudio桌面应用已启动并加载模型
2. rcc3命令已安装并可用
3. 配置文件config-lmstudio-v3-5506.json存在
4. 端口5506可用（会自动清理冲突）

## 预期结果
- 所有7个测试阶段顺利完成
- Claude Code客户端成功连接到LMStudio
- 路由和协议转换正常工作
- 工具调用解析准确性达到90%以上
- 生成完整的集成测试报告

## 故障排除

### 常见问题
1. **服务启动失败**
   - 检查LMStudio桌面应用是否运行
   - 确认端口5506未被其他进程占用
   - 验证配置文件路径和内容

2. **连接测试失败**
   - 检查网络连接
   - 确认防火墙设置
   - 验证认证配置

3. **工具调用失败**
   - 检查模型是否支持工具调用
   - 确认工具定义格式正确
   - 验证响应解析逻辑

4. **性能问题**
   - 检查系统资源使用情况
   - 确认模型加载状态
   - 优化并发请求数量

### 调试建议
- 查看详细的JSON报告了解失败原因
- 检查捕获的请求/响应数据
- 运行单独的测试阶段进行定位
- 开启--debug模式获取更多日志信息