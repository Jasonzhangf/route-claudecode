# 🚀 Claude Code Router - 交付测试系统使用指南

## 📋 系统概述

交付测试系统是为claude-code-router项目建立的完整5大核心标准验证框架，确保每次交付前所有Provider都能正常工作。

### 🎯 五大核心标准

1. **🔧 单独供应商配置文件标准** - 每个Provider独立配置和完整路由覆盖
2. **🔌 端口隔离测试标准** - Provider专用端口，避免冲突干扰
3. **📊 原始数据采集标准** - 完整的输入输出数据采集和重放验证
4. **🎭 场景覆盖测试标准** - 工具调用、多轮会话、大输入、长回复场景全覆盖
5. **🚨 错误分类诊断标准** - 标准化错误分类和自动诊断建议

## 🏗️ 系统架构

```
claude-code-router/
├── config/delivery-testing/          # 配置文件
│   ├── config-codewhisperer-only.json
│   ├── config-openai-only.json
│   ├── config-gemini-only.json
│   ├── config-anthropic-only.json
│   └── config-mixed-validation.json
├── test/delivery/                     # 测试脚本
│   ├── test-scenario-tool-calls.js
│   ├── test-scenario-multi-turn.js
│   ├── test-scenario-large-input.js
│   ├── error-diagnostic-system.js
│   └── README.md
└── delivery-test-master.sh           # 主测试脚本
```

## 🚀 快速开始

### 1. 完整交付测试

```bash
# 运行完整的5大标准验证
./delivery-test-master.sh

# 清理之前的测试数据后运行
./delivery-test-master.sh --clean

# 查看使用帮助
./delivery-test-master.sh --help
```

### 2. 单Provider测试

```bash
# 只测试CodeWhisperer Provider
./delivery-test-master.sh --provider codewhisperer

# 只测试OpenAI Compatible Provider
./delivery-test-master.sh --provider openai
```

### 3. 单独场景测试

```bash
# 工具调用场景测试
node test/delivery/test-scenario-tool-calls.js

# 多轮对话场景测试
node test/delivery/test-scenario-multi-turn.js

# 大输入场景测试
node test/delivery/test-scenario-large-input.js
```

### 4. 错误诊断

```bash
# 分析错误日志
cd test/delivery
./error-diagnostic-system.js --analyze /path/to/error.log

# 获取特定错误代码的修复建议
./error-diagnostic-system.js --recommend-fix --error-code=500
```

## 📊 测试配置

### Provider端口分配

| Provider | 端口 | 配置文件 |
|----------|------|----------|
| CodeWhisperer | 3458 | config-codewhisperer-only.json |
| OpenAI Compatible | 3459 | config-openai-only.json |
| Gemini | 3460 | config-gemini-only.json |
| Anthropic | 3461 | config-anthropic-only.json |
| Mixed Validation | 3462 | config-mixed-validation.json |

### 测试场景覆盖

#### 🛠️ 工具调用场景
- **简单工具调用**: 单个工具的基础调用测试
- **多工具调用**: 多个工具的复合调用测试
- **复杂Schema工具**: 包含嵌套对象的复杂工具定义测试

#### 💬 多轮对话场景
- **基础多轮对话**: 3轮简单对话测试
- **上下文依赖对话**: 4轮逐步构建的复杂对话
- **复杂推理链**: 5轮深度推理的连续对话

#### 📊 大输入场景
- **中等规模输入**: ~30K tokens的代码分析请求
- **大规模输入**: ~60K tokens的文档生成请求
- **超大规模输入**: ~100K tokens的代码库分析请求

#### 🔄 长回复场景
- **结构化长回复**: 复杂数据结构的详细回复
- **代码生成回复**: 大量代码的生成回复
- **文档生成回复**: 完整技术文档的生成回复

## 📈 数据采集和存储

### 数据存储结构

```
~/.route-claude-code/database/delivery-testing/
├── providers/
│   ├── codewhisperer/
│   │   ├── requests/           # 输入请求数据
│   │   ├── responses/          # 原始响应数据
│   │   └── processed/          # 处理后数据
│   ├── openai-compatible/
│   ├── gemini/
│   └── anthropic/
├── scenarios/
│   ├── tool-calls/             # 工具调用场景数据
│   ├── multi-turn/             # 多轮对话数据
│   ├── large-input/            # 大输入数据
│   └── long-response/          # 长回复数据
├── error-diagnostics/          # 错误诊断数据
└── reports/                    # 测试报告
```

### 数据重放验证

```bash
# 使用已采集数据进行E2E测试
./delivery-test.sh --replay golden-datasets/baseline-requests.json

# 验证预期响应
./delivery-test.sh --validate expected-responses.json
```

## 🚨 错误分类和诊断

### 错误分类体系

#### 本地服务器错误 (5xx)
- **500 Internal Server Error**: 代码逻辑错误，需要立即修复
- **502 Bad Gateway**: 代理配置问题
- **503 Service Unavailable**: 服务不可用，需要重启
- **504 Gateway Timeout**: 上游超时问题

#### 远端Provider错误 (4xx)
- **400 Bad Request**: 请求格式错误
- **401 Unauthorized**: 认证失败，需要刷新凭据
- **403 Forbidden**: 权限不足
- **429 Too Many Requests**: 速率限制，需要退避重试

#### 网络错误
- **ECONNREFUSED**: 连接被拒绝，检查网络连接
- **ENOTFOUND**: DNS解析失败
- **ETIMEDOUT**: 连接超时
- **ECONNRESET**: 连接重置

### 自动诊断建议

系统会自动生成：
- **错误分类**: 自动识别错误类型和严重程度
- **影响评估**: 分析错误对系统的影响范围
- **修复建议**: 提供具体的修复步骤和命令
- **重试策略**: 判断是否可以重试及重试策略

## 📋 交付检查清单

### 🔲 Provider隔离测试
- [ ] CodeWhisperer单独配置测试通过
- [ ] OpenAI Compatible单独配置测试通过
- [ ] Gemini单独配置测试通过
- [ ] Anthropic单独配置测试通过
- [ ] 每个Provider的专用端口无冲突运行

### 🔲 端口隔离验证
- [ ] 测试端口3458-3467全部可用
- [ ] 多Provider同时运行无端口冲突
- [ ] 服务启动自动端口清理正常工作
- [ ] 健康检查端点响应正常

### 🔲 数据采集完整性
- [ ] 每个Provider的输入输出数据完整采集
- [ ] 黄金标准数据集生成完成
- [ ] 数据重放E2E测试100%通过
- [ ] 数据完整性校验通过

### 🔲 场景覆盖完整性
- [ ] 工具调用场景 - 所有Provider测试通过
- [ ] 多轮会话场景 - 会话状态管理正常
- [ ] 大输入场景 - 内存和性能表现良好
- [ ] 长回复场景 - 流式响应稳定完整

### 🔲 错误诊断准确性
- [ ] 本地500错误正确分类和诊断
- [ ] 远端4xx错误正确分类和处理
- [ ] 错误信息包含Provider和模型详情
- [ ] 错误恢复和重试机制工作正常

## 📊 测试报告解读

### 测试结果状态
- **PASSED**: 测试通过，功能正常
- **FAILED**: 测试失败，需要修复
- **PARTIAL**: 部分通过，存在问题但不影响基本功能

### 性能指标
- **响应时间**: Provider响应请求的平均时间
- **Token处理速度**: 每秒处理的token数量
- **内存效率**: 大输入处理时的内存使用情况
- **成功率**: 各种场景的成功处理比例

### 质量评估
- **上下文保持**: 多轮对话中的上下文连贯性
- **工具调用准确性**: 工具调用的成功执行率
- **响应完整性**: 响应内容的完整性和正确性
- **错误恢复能力**: 遇到错误时的恢复能力

## 🔧 故障排除

### 常见问题

#### 1. Provider启动失败
```bash
# 检查端口占用
lsof -i :3458

# 检查配置文件
node -e "console.log(JSON.parse(require('fs').readFileSync('config/delivery-testing/config-codewhisperer-only.json')))"

# 检查服务日志
tail -f ~/.route-claude-code/logs/delivery-testing/delivery-codewhisperer-3458.log
```

#### 2. 测试超时
```bash
# 增加测试超时时间
export TEST_TIMEOUT=300000  # 5分钟

# 检查网络连接
curl -I https://codewhisperer.us-east-1.amazonaws.com
```

#### 3. 数据采集失败
```bash
# 检查数据目录权限
ls -la ~/.route-claude-code/database/delivery-testing/

# 手动创建目录
mkdir -p ~/.route-claude-code/database/delivery-testing/providers/codewhisperer
```

#### 4. 认证错误
```bash
# 刷新AWS SSO token
aws sso login --profile kiro-auth

# 检查环境变量
echo $ANTHROPIC_API_KEY
echo $GEMINI_API_KEY
```

## 🚀 持续集成集成

### GitHub Actions集成

```yaml
name: Delivery Testing
on: [push, pull_request]

jobs:
  delivery-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: ./delivery-test-master.sh
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

### 本地开发集成

```bash
# 添加到pre-commit hook
echo "./delivery-test-master.sh --provider codewhisperer" >> .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## 📚 最佳实践

### 1. 测试频率
- **每次发布前**: 运行完整的5大标准测试
- **功能开发后**: 运行相关Provider的测试
- **配置更改后**: 运行配置验证和端口隔离测试

### 2. 数据管理
- **定期清理**: 清理超过30天的测试数据
- **备份重要数据**: 保留黄金标准数据集
- **版本控制**: 对重要测试数据进行版本管理

### 3. 错误处理
- **立即处理critical错误**: 500错误和认证错误
- **定期检查medium错误**: 性能和配置问题
- **监控low级别错误**: 作为系统优化参考

---

**文档版本**: v2.6.0  
**维护者**: Jason Zhang  
**最后更新**: 2025-08-01  

如有问题或建议，请查看项目的CLAUDE.md文件或创建issue。