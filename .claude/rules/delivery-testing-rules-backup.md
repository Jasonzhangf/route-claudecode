# 🚀 交付测试标准规则 (Delivery Testing Standards Rules)

## 🎯 交付测试完整报告体系 (Complete Delivery Report System)

### 📊 交付报告结构总览 (Delivery Report Structure Overview)

每次流水线交付必须生成以下完整报告体系：

```
reports/delivery-YYYYMMDD-HHMMSS/
├── 01-unit-test-reports/           # 单元测试报告
├── 02-layer-blackbox-reports/      # 六层架构黑盒测试报告
├── 03-e2e-test-reports/           # 端到端测试报告
├── 04-summary-report/             # 综合总结报告
└── 00-cleanup-log.md              # 报告清理记录
```

### 🧪 1. 单元测试报告 (Unit Test Reports)

#### 📋 流水线完整模块单元测试覆盖

每次交付必须包含以下流水线所有模块的单元测试报告：

##### 1.1 输入层模块单元测试 (Input Layer Module Unit Tests)
```
reports/01-unit-test-reports/input-layer/
├── anthropic-processor-unit-test.md     # Anthropic输入处理器单元测试
├── openai-processor-unit-test.md        # OpenAI输入处理器单元测试
├── request-validation-unit-test.md      # 请求验证单元测试
├── rate-limiting-unit-test.md           # 速率限制单元测试
└── auth-validation-unit-test.md         # 认证验证单元测试
```

**测试覆盖要点**:
- 输入格式验证和标准化
- 请求参数完整性检查
- 错误输入处理和边界条件
- 认证token验证
- 速率限制算法正确性

##### 1.2 路由层模块单元测试 (Routing Layer Module Unit Tests)
```
reports/01-unit-test-reports/routing-layer/
├── provider-selection-unit-test.md      # Provider选择逻辑单元测试
├── model-mapping-unit-test.md           # 模型映射单元测试
├── load-balancing-unit-test.md          # 负载均衡单元测试
├── health-check-unit-test.md            # 健康检查单元测试
└── failover-logic-unit-test.md          # 故障转移逻辑单元测试
```

**测试覆盖要点**:
- 类别驱动路由算法 (default, background, thinking, longcontext, search)
- Round Robin负载均衡准确性
- Provider健康状态检测
- 自动故障转移机制
- 路由决策日志完整性

##### 1.3 预处理器模块单元测试 (Preprocessor Module Unit Tests)
```
reports/01-unit-test-reports/preprocessor-layer/
├── unified-patch-preprocessor-unit-test.md    # 统一补丁预处理器
├── anthropic-format-compatibility-unit-test.md # Anthropic格式兼容性
├── openai-format-compatibility-unit-test.md   # OpenAI格式兼容性  
├── gemini-format-compatibility-unit-test.md   # Gemini格式兼容性
├── modelscope-patch-unit-test.md             # ModelScope补丁系统
├── lmstudio-patch-unit-test.md               # LMStudio补丁系统
└── patch-condition-matching-unit-test.md     # 补丁条件匹配逻辑
```

**重点测试内容 - 预处理器兼容性报告**:
- **条件匹配精度**: Provider、Model、Version多维度匹配准确性
- **格式转换完整性**: 各Provider间格式转换无损性
- **补丁应用效果**: 特定模型兼容性问题修复验证
- **性能影响分析**: 补丁应用对响应时间的影响
- **错误隔离机制**: 补丁失败时的系统稳定性

##### 1.4 Transformer模块单元测试 (Transformer Module Unit Tests)  
```
reports/01-unit-test-reports/transformer-layer/
├── openai-transformer-unit-test.md          # OpenAI协议转换器
├── gemini-transformer-unit-test.md          # Gemini协议转换器
├── anthropic-transformer-unit-test.md       # Anthropic协议转换器
├── response-converter-unit-test.md          # 响应转换器
├── streaming-handler-unit-test.md           # 流式处理器
└── tool-call-processor-unit-test.md         # 工具调用处理器
```

**重点测试内容 - Transformer单元报告**:
- **协议转换准确性**: 不同AI服务协议的双向转换
- **工具调用格式化**: 工具定义和调用结果的正确转换
- **流式数据处理**: 流式响应的实时转换和缓冲管理
- **错误格式标准化**: 不同Provider错误格式的统一转换
- **Token计算一致性**: 跨Provider的Token计算准确性

##### 1.5 Provider模块单元测试 (Provider Module Unit Tests)
```
reports/01-unit-test-reports/provider-layer/
├── codewhisperer-provider-unit-test.md      # CodeWhisperer Provider
├── openai-provider-unit-test.md             # OpenAI Provider
├── gemini-provider-unit-test.md             # Gemini Provider
├── anthropic-provider-unit-test.md          # Anthropic Provider
├── provider-factory-unit-test.md            # Provider工厂
└── connection-management-unit-test.md       # 连接管理
```

**测试覆盖要点**:
- Provider实例创建和配置
- API连接建立和维护
- 请求发送和响应接收
- 连接池管理和复用
- 超时和重试机制

##### 1.6 输出层模块单元测试 (Output Layer Module Unit Tests)
```
reports/01-unit-test-reports/output-layer/
├── anthropic-output-processor-unit-test.md  # Anthropic输出处理器
├── openai-output-processor-unit-test.md     # OpenAI输出处理器
├── response-formatter-unit-test.md          # 响应格式化器
├── error-handler-unit-test.md               # 错误处理器
└── finish-reason-router-unit-test.md        # Finish Reason路由器
```

**重点测试内容 - Finish Reason完整路由报告**:
- **Finish Reason映射**: 不同Provider的结束原因标准化映射
- **状态码转换**: HTTP状态码和AI状态的正确对应
- **错误原因分类**: 本地错误vs远程错误的准确识别
- **客户端兼容性**: 不同客户端的响应格式适配
- **日志记录完整性**: Finish Reason的审计日志记录

#### 📊 单元测试报告标准格式

每个模块单元测试报告必须包含：

```
# [模块名] 单元测试报告

## 测试总览
- **执行时间**: YYYY-MM-DD HH:MM:SS
- **测试版本**: v2.8.x
- **测试环境**: Node.js版本、OS信息
- **总测试用例**: 数量
- **通过率**: 百分比

## 测试覆盖详情
### 功能测试
- [ ] 核心功能1 - 描述 (PASS/FAIL)
- [ ] 核心功能2 - 描述 (PASS/FAIL)
- [ ] ...

### 边界条件测试  
- [ ] 边界条件1 (PASS/FAIL)
- [ ] 边界条件2 (PASS/FAIL)
- [ ] ...

### 错误处理测试
- [ ] 错误场景1 (PASS/FAIL)
- [ ] 错误场景2 (PASS/FAIL)
- [ ] ...

## 性能指标
- **平均响应时间**: Xms
- **内存使用峰值**: XMB
- **CPU使用率**: X%

## 发现问题
- 问题1: 描述、影响、修复状态
- 问题2: 描述、影响、修复状态

## 修复验证
- 修复1: 验证结果
- 修复2: 验证结果

## 测试结论
PASS/FAIL，详细说明
```

### 🏗️ 2. 六层架构单层黑盒测试报告 (Six-Layer Architecture Blackbox Test Reports)

#### 📋 六层架构单层黑盒测试覆盖

每次交付必须包含六层架构的独立黑盒测试报告：

##### 2.1 客户端接入层黑盒测试 (Client Interface Layer Blackbox Test)
```
reports/02-layer-blackbox-reports/01-client-interface/
├── http-api-blackbox-test.md           # HTTP API接口黑盒测试
├── authentication-blackbox-test.md     # 认证机制黑盒测试
├── rate-limiting-blackbox-test.md      # 速率限制黑盒测试
├── request-validation-blackbox-test.md # 请求验证黑盒测试
└── error-response-blackbox-test.md     # 错误响应黑盒测试
```

**黑盒测试要点**:
- 不关心内部实现，只验证输入输出
- API接口规范完全符合OpenAI标准
- 各种异常输入的错误处理
- 并发请求的处理能力
- 响应时间和稳定性

##### 2.2 路由决策层黑盒测试 (Routing Decision Layer Blackbox Test)
```
reports/02-layer-blackbox-reports/02-routing-decision/
├── category-routing-blackbox-test.md   # 类别路由黑盒测试
├── provider-selection-blackbox-test.md # Provider选择黑盒测试
├── load-balancing-blackbox-test.md     # 负载均衡黑盒测试
├── failover-mechanism-blackbox-test.md # 故障转移黑盒测试
└── model-mapping-blackbox-test.md      # 模型映射黑盒测试
```

**黑盒测试要点**:
- 输入：请求类别 → 输出：选中的Provider和模型
- Round Robin算法的外部表现
- 健康检查触发的路由切换
- 不同负载下的路由决策一致性

##### 2.3 预处理层黑盒测试 (Preprocessing Layer Blackbox Test)
```
reports/02-layer-blackbox-reports/03-preprocessing/
├── format-compatibility-blackbox-test.md  # 格式兼容性黑盒测试
├── patch-system-blackbox-test.md          # 补丁系统黑盒测试
├── model-specific-fix-blackbox-test.md    # 模型特定修复黑盒测试
├── request-transformation-blackbox-test.md # 请求转换黑盒测试
└── preprocessing-performance-blackbox-test.md # 预处理性能黑盒测试
```

**黑盒测试要点**:
- 输入：标准请求 → 输出：Provider特定格式请求
- 不同模型的兼容性修复效果
- 补丁应用的自动判断和执行
- 预处理不改变请求的语义内容

##### 2.4 协议转换层黑盒测试 (Protocol Transformation Layer Blackbox Test)
```
reports/02-layer-blackbox-reports/04-protocol-transformation/
├── openai-protocol-blackbox-test.md     # OpenAI协议转换黑盒测试
├── anthropic-protocol-blackbox-test.md  # Anthropic协议转换黑盒测试
├── gemini-protocol-blackbox-test.md     # Gemini协议转换黑盒测试
├── tool-call-format-blackbox-test.md    # 工具调用格式黑盒测试
└── streaming-protocol-blackbox-test.md  # 流式协议转换黑盒测试
```

**黑盒测试要点**:
- 输入：统一格式 → 输出：Provider特定协议
- 工具调用格式的正确转换
- 流式响应的协议适配
- 不同Provider协议差异的透明处理

##### 2.5 Provider连接层黑盒测试 (Provider Connection Layer Blackbox Test)
```
reports/02-layer-blackbox-reports/05-provider-connection/
├── codewhisperer-connection-blackbox-test.md # CodeWhisperer连接黑盒测试
├── openai-compatible-connection-blackbox-test.md # OpenAI兼容连接黑盒测试
├── gemini-connection-blackbox-test.md         # Gemini连接黑盒测试
├── anthropic-connection-blackbox-test.md      # Anthropic连接黑盒测试
└── connection-pooling-blackbox-test.md        # 连接池黑盒测试
```

**黑盒测试要点**:
- 输入：Provider请求 → 输出：AI服务响应
- 连接建立和维护的稳定性
- 超时和重试机制的外部表现
- 连接池的复用效率

##### 2.6 响应后处理层黑盒测试 (Response Post-processing Layer Blackbox Test)
```
reports/02-layer-blackbox-reports/06-response-postprocessing/
├── response-format-blackbox-test.md     # 响应格式黑盒测试
├── error-handling-blackbox-test.md      # 错误处理黑盒测试
├── finish-reason-mapping-blackbox-test.md # 结束原因映射黑盒测试
├── token-calculation-blackbox-test.md   # Token计算黑盒测试
└── client-compatibility-blackbox-test.md # 客户端兼容性黑盒测试
```

**黑盒测试要点**:
- 输入：Provider原始响应 → 输出：标准化客户端响应
- 各种错误的统一格式化
- Finish reason的正确映射
- 不同客户端的响应兼容性

#### 📊 六层架构黑盒测试报告标准格式

每层黑盒测试报告必须包含：

```
# [层级名称] 黑盒测试报告

## 层级功能定义
- **输入接口**: 描述输入数据格式和来源
- **输出接口**: 描述输出数据格式和去向
- **功能职责**: 该层的核心处理职责

## 黑盒测试场景
### 正常场景测试
- [ ] 标准输入 → 期望输出 (PASS/FAIL)
- [ ] 边界输入 → 处理结果 (PASS/FAIL)
- [ ] 大容量输入 → 性能表现 (PASS/FAIL)

### 异常场景测试
- [ ] 错误输入 → 错误处理 (PASS/FAIL)
- [ ] 超时场景 → 超时处理 (PASS/FAIL)
- [ ] 资源不足 → 降级处理 (PASS/FAIL)

### 并发场景测试
- [ ] 并发请求 → 处理一致性 (PASS/FAIL)
- [ ] 高负载 → 性能稳定性 (PASS/FAIL)
- [ ] 资源竞争 → 安全性保证 (PASS/FAIL)

## 性能指标
- **平均处理时间**: Xms
- **最大并发处理**: X requests/sec
- **内存占用**: XMB
- **CPU使用率**: X%

## 接口合约验证
- **输入验证**: 所有输入都符合接口定义
- **输出验证**: 所有输出都符合接口约定
- **错误处理**: 异常情况的处理符合规范
- **向后兼容**: 接口变更不破坏现有功能

## 隔离性验证
- **层级独立性**: 该层可以独立测试和替换
- **依赖最小化**: 对其他层的依赖清晰且最小
- **故障隔离**: 该层故障不影响其他层
- **接口稳定性**: 接口变更有明确的版本控制

## 发现问题
- 问题1: 描述、影响范围、修复计划
- 问题2: 描述、影响范围、修复计划

## 黑盒测试结论
PASS/FAIL，该层是否满足黑盒测试要求
```

### 🌐 3. 端到端测试报告 (End-to-End Test Reports)

#### 📋 端到端测试场景覆盖

每次交付必须包含以下端到端测试报告：

##### 3.1 简单对话端到端测试 (Simple Conversation E2E Test)
```
reports/03-e2e-test-reports/01-simple-conversation/
├── single-turn-conversation-e2e-test.md    # 单轮对话端到端测试
├── provider-switching-e2e-test.md          # Provider切换端到端测试
├── error-recovery-e2e-test.md              # 错误恢复端到端测试
├── response-streaming-e2e-test.md          # 响应流式传输端到端测试
└── performance-baseline-e2e-test.md        # 性能基准端到端测试
```

**简单对话测试要点**:
- 完整的请求-响应链路验证
- 不同Provider的响应质量对比
- 响应时间和稳定性测量
- 客户端兼容性验证

##### 3.2 工具调用端到端测试 (Tool Call E2E Test)
```
reports/03-e2e-test-reports/02-tool-call/
├── function-calling-e2e-test.md            # 函数调用端到端测试
├── tool-definition-transmission-e2e-test.md # 工具定义传输端到端测试
├── tool-execution-result-e2e-test.md       # 工具执行结果端到端测试
├── tool-call-error-handling-e2e-test.md    # 工具调用错误处理端到端测试
└── complex-tool-scenario-e2e-test.md       # 复杂工具场景端到端测试
```

**工具调用测试要点**:
- 工具定义的正确传递和解析
- 工具调用指令的准确生成
- 工具执行结果的正确处理
- 不同Provider工具调用能力对比
- 工具调用错误的恢复机制

##### 3.3 多轮多工具对话端到端测试 (Multi-turn Multi-tool E2E Test)
```
reports/03-e2e-test-reports/03-multi-turn-multi-tool/
├── multi-turn-context-e2e-test.md          # 多轮上下文端到端测试
├── tool-chain-execution-e2e-test.md        # 工具链执行端到端测试
├── context-memory-management-e2e-test.md   # 上下文内存管理端到端测试
├── session-state-persistence-e2e-test.md  # 会话状态持久化端到端测试
└── complex-workflow-e2e-test.md            # 复杂工作流端到端测试
```

**多轮多工具测试要点**:
- 会话上下文的正确维护
- 多个工具的协调执行
- 长会话的内存管理
- 复杂业务场景的端到端验证
- Provider切换时的状态保持

#### 🔬 端到端测试层级设计精确定义 (E2E Test Layer Design Precision)

##### 客户端连接测试 (Client Connection Test) 
- **测试范围**: 客户端 → 路由器 → 预处理器 → Transformer → Provider连接层
- **Mock策略**: **允许Mock第三方AI服务连接**，但基于真实database样本构建响应
- **连接要求**: 必须使用 `rcc code --port <端口>` 真实连接到路由服务器
- **验证标准**: 整链路完整响应(包括多工具测试)视为连接正常
- **测试重点**: 验证系统内部六层流水线的完整性和协议转换正确性

##### Provider连接测试 (Provider Connection Test)
- **测试范围**: Provider连接层 → 真实第三方AI服务
- **Mock策略**: **严禁Mock** - 必须连接真实AI服务API
- **连接要求**: 直接调用AI服务的真实API端点
- **验证标准**: 真实API调用成功并返回有效响应
- **测试重点**: 验证与外部AI服务的实际连通性和API兼容性

##### 测试分层执行原则
```bash
# 客户端连接测试 - 使用Mock AI服务但真实连接内部系统
rcc start --config config-with-mock-ai-responses.json --port 5555 &
rcc code --port 5555  # 真实连接到路由服务器
# 发送测试请求，系统内部处理完整，但AI响应来自database样本

# Provider连接测试 - 真实连接外部AI服务  
rcc start --config config-real-ai-services.json --port 5556 &
# 直接测试Provider与真实AI服务的连接
curl -X POST http://localhost:5556/test-provider-connection
```

#### 📊 端到端测试报告标准格式

每个端到端测试报告必须包含：

```
# [场景名称] 端到端测试报告

## 测试场景定义
- **测试目标**: 验证什么端到端能力
- **测试范围**: 涉及哪些系统组件
- **成功标准**: 什么情况下认为测试成功

## 测试用例执行
### 用例1: [用例名称]
- **输入**: 具体的测试输入
- **预期输出**: 期望的响应结果
- **实际输出**: 实际测试结果
- **测试状态**: PASS/FAIL
- **执行时间**: Xms
- **问题描述**: 如果失败，详细描述问题

### 用例2: [用例名称]
[类似格式]

## 跨Provider对比测试
| Provider | 成功率 | 平均响应时间 | 错误类型 | 备注 |
|----------|--------|-------------|----------|------|
| CodeWhisperer | 100% | 850ms | 无 | 稳定 |
| OpenAI Compatible | 98% | 1200ms | 1次超时 | 基本稳定 |
| Gemini | 95% | 950ms | 1次格式错误 | 需要关注 |
| Anthropic | 100% | 780ms | 无 | 最佳 |

## 性能指标统计
- **总测试用例**: 数量
- **成功用例**: 数量和比例
- **平均响应时间**: Xms
- **95th百分位响应时间**: Xms
- **并发处理能力**: X requests/sec
- **内存使用峰值**: XMB

## 错误分析
### 本地错误 (5xx)
- 错误1: 描述、出现频率、影响
- 错误2: 描述、出现频率、影响

### 远程错误 (4xx/其他)
- 错误1: Provider、错误代码、处理方式
- 错误2: Provider、错误代码、处理方式

## 用户体验评估
- **响应质量**: 输出质量是否符合预期
- **接口一致性**: 不同Provider的响应格式是否一致
- **错误处理**: 错误信息是否清晰有用
- **恢复能力**: 错误后的恢复能力如何

## 端到端测试结论
PASS/FAIL，整个端到端流程是否满足生产要求
```

### 🧹 4. 报告清理和更新机制 (Report Cleanup and Update Mechanism)

#### 📋 报告清理规则

每次生成新的交付报告前，必须执行报告清理：

##### 4.1 清理前检查 (Pre-cleanup Check)
```bash
# 清理脚本必须执行的检查
./cleanup-delivery-reports.sh --check
```

检查项目：
- [ ] 确认当前没有正在进行的测试
- [ ] 备份重要的历史报告数据
- [ ] 验证新测试环境的准备就绪
- [ ] 清理临时文件和日志

##### 4.2 清理执行步骤 (Cleanup Execution Steps)
```bash
# 1. 备份现有报告（如果需要）
./cleanup-delivery-reports.sh --backup

# 2. 清理旧报告目录
./cleanup-delivery-reports.sh --clean

# 3. 初始化新报告结构
./cleanup-delivery-reports.sh --init

# 4. 验证清理结果
./cleanup-delivery-reports.sh --verify
```

##### 4.3 清理记录格式 (Cleanup Log Format)
```
# 报告清理记录 - YYYY-MM-DD HH:MM:SS

## 清理执行信息
- **清理时间**: 2025-08-10 14:30:00
- **清理版本**: v2.8.0
- **执行用户**: 系统/用户名
- **清理原因**: 新版本交付测试

## 清理前状态
- **旧报告目录**: reports/delivery-20250809-143000/
- **旧报告大小**: 125MB
- **旧报告文件数**: 156个
- **重要数据备份**: 已备份至 backup/delivery-reports/20250809/

## 清理操作
- [x] 删除单元测试报告目录
- [x] 删除黑盒测试报告目录  
- [x] 删除端到端测试报告目录
- [x] 删除综合报告目录
- [x] 清理临时文件和日志
- [x] 重置报告计数器

## 清理后状态
- **新报告目录**: reports/delivery-20250810-143000/
- **目录结构完整性**: ✅ 验证通过
- **权限设置**: ✅ 正确配置
- **初始化状态**: ✅ 准备就绪

## 清理问题记录
- 无问题

## 验证检查
- [x] 目录结构正确
- [x] 权限设置正确
- [x] 备份数据完整
- [x] 系统资源释放完全

## 清理结论
✅ 清理成功，系统准备就绪进行新的交付测试
```

#### 📊 报告更新机制 (Report Update Mechanism)

##### 4.4 实时更新机制 (Real-time Update Mechanism)
- **增量更新**: 测试执行过程中实时更新报告内容
- **状态同步**: 测试状态变化立即反映到报告中
- **进度跟踪**: 显示当前测试进度和剩余时间
- **异常通知**: 测试失败时立即更新错误信息

##### 4.5 版本控制机制 (Version Control Mechanism)
- **报告版本**: 每个报告都有版本标识
- **变更历史**: 记录报告内容的变更历史
- **回滚能力**: 可以回滚到之前的报告版本
- **对比功能**: 支持不同版本报告的对比

##### 4.6 自动归档机制 (Auto Archiving Mechanism)
```bash
# 自动归档配置
AUTO_ARCHIVE_ENABLED=true
ARCHIVE_RETENTION_DAYS=30
MAX_ARCHIVE_SIZE=1GB
ARCHIVE_COMPRESSION=gzip
```

归档规则：
- 超过30天的报告自动归档
- 归档大小超过1GB时自动清理最旧的归档
- 重要里程碑版本的报告永久保留
- 归档数据支持快速检索和恢复

## 🎯 交付测试五大核心标准 (Five Core Delivery Standards)

### 1. 🔧 单独供应商配置文件标准 (Isolated Provider Configuration Standard)

#### 配置隔离原则
- **独立配置文件**: 每个Provider必须有专用的配置文件
- **完整路由覆盖**: 所有路由类别都路由到指定Provider，确保单独测试完整性
- **环境隔离**: 每个Provider配置使用独立的认证和端点配置

#### 配置文件命名规范
```
config/delivery-testing/
├── config-codewhisperer-only.json     # 纯CodeWhisperer测试配置
├── config-openai-only.json            # 纯OpenAI Compatible测试配置
├── config-gemini-only.json            # 纯Gemini测试配置
├── config-anthropic-only.json         # 纯Anthropic测试配置
└── config-mixed-validation.json       # 混合Provider验证配置
```

#### 单Provider配置模板
```json
{
  "name": "CodeWhisperer Only - Delivery Testing",
  "description": "Routes ALL categories to CodeWhisperer for isolated testing",
  "server": { "port": 3458 },
  "routing": {
    "default": { "provider": "codewhisperer-test", "model": "CLAUDE_SONNET_4_20250514_V1_0" },
    "background": { "provider": "codewhisperer-test", "model": "CLAUDE_3_5_HAIKU_20241022_V1_0" },
    "thinking": { "provider": "codewhisperer-test", "model": "CLAUDE_SONNET_4_20250514_V1_0" },
    "longcontext": { "provider": "codewhisperer-test", "model": "CLAUDE_SONNET_4_20250514_V1_0" },
    "search": { "provider": "codewhisperer-test", "model": "CLAUDE_SONNET_4_20250514_V1_0" }
  }
}
```

### 2. 🔌 端口隔离测试标准 (Port Isolation Testing Standard)

#### 端口分配规则
- **生产端口**: 3457 (Production)
- **开发端口**: 3456 (Development)
- **测试端口范围**: 3458-3467 (Delivery Testing)

#### Provider专用端口映射
```
3458 - CodeWhisperer Only Testing
3459 - OpenAI Compatible Only Testing  
3460 - Gemini Only Testing
3461 - Anthropic Only Testing
3462 - Mixed Provider Validation
3463 - Performance Testing
3464 - Error Scenario Testing
3465 - Load Testing
3466 - Regression Testing
3467 - Integration Testing
```

#### 端口冲突处理
- **自动检测**: 启动前检查端口占用状态
- **强制清理**: 自动终止占用测试端口的进程
- **健康检查**: 每个测试实例启动后验证端口响应

### 3. 📊 原始数据采集标准 (Raw Data Collection Standard)

#### 数据采集架构
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
└── golden-datasets/            # 黄金标准数据集
    ├── baseline-requests.json
    ├── expected-responses.json
    └── validation-checksums.json
```

#### 数据采集触发机制
- **自动采集**: `--capture-data` 参数启用完整数据采集
- **实时记录**: 每个Provider请求响应的完整链路数据
- **数据校验**: 采集数据的完整性和格式校验
- **版本控制**: 数据集版本管理和回退机制

#### 数据重放验证
```bash
# 使用已采集数据进行E2E测试
./delivery-test.sh --replay golden-datasets/baseline-requests.json
./delivery-test.sh --validate expected-responses.json
```

### 4. 🎭 场景覆盖测试标准 (Scenario Coverage Testing Standard)

#### 核心场景定义
每次交付测试必须覆盖以下场景：

##### A. 工具调用场景 (Tool Calls Scenario)
- **测试目标**: 验证所有Provider的工具调用处理能力
- **测试数据**: 标准工具调用请求集合
- **验证点**: 
  - 工具定义正确传递
  - 工具调用正确执行
  - 工具结果正确返回
  - Token计算准确

##### B. 多轮会话场景 (Multi-turn Conversation Scenario)  
- **测试目标**: 验证会话状态管理和上下文保持
- **测试数据**: 3-5轮连续对话
- **验证点**:
  - 会话上下文保持
  - 消息历史正确传递
  - Provider状态管理
  - 会话ID一致性

##### C. 大输入场景 (Large Input Scenario)
- **测试目标**: 验证大容量输入处理能力
- **测试数据**: 50K+ tokens输入请求  
- **验证点**:
  - 输入截断处理
  - 内存使用控制
  - 超时处理机制
  - 错误恢复能力

##### D. 长回复场景 (Long Response Scenario)
- **测试目标**: 验证长文本响应的流式处理
- **测试数据**: 预期10K+ tokens的响应请求
- **验证点**:
  - 流式响应稳定性
  - 响应完整性检查
  - 内存管理效率
  - 客户端兼容性

#### 场景测试执行流程
```bash
# 单Provider场景测试套件
./delivery-test.sh --provider codewhisperer --scenarios all
./delivery-test.sh --provider openai --scenarios tool-calls,multi-turn
./delivery-test.sh --provider gemini --scenarios large-input,long-response

# 跨Provider场景对比测试
./delivery-test.sh --compare-providers --scenario tool-calls
```

### 5. 🚨 错误分类诊断标准 (Error Classification & Diagnosis Standard)

#### 错误分类体系

##### A. 本地服务器错误 (Local Server Errors) - 5xx
- **错误类型**: 500 Internal Server Error
- **诊断信息**: 
  - 具体Provider名称
  - 失败的模型名称  
  - 错误发生的处理阶段
  - 详细错误堆栈信息
- **处理策略**: 本地代码修复，不进行Provider切换

##### B. 远端Provider错误 (Remote Provider Errors) - 4xx/其他
- **错误类型**: 400, 401, 403, 429, 502, 503, 504
- **诊断信息**:
  - Provider服务状态
  - 具体错误代码和消息
  - 重试次数和间隔
  - 可用的备用Provider
- **处理策略**: Provider故障转移或用户通知

#### 错误诊断标准化输出
```
{
  "error": {
    "category": "local_server_error|remote_provider_error",
    "code": "500|400|401|403|429|502|503|504",
    "provider": "codewhisperer-primary",
    "model": "CLAUDE_SONNET_4_20250514_V1_0", 
    "stage": "routing|transformation|api_call|response_processing",
    "message": "详细的错误描述",
    "details": {
      "requestId": "req-12345",
      "timestamp": "2025-08-01T15:30:00Z",
      "retryCount": 2,
      "stackTrace": "完整的错误堆栈",
      "suggestedAction": "recommended_fix_or_fallback"
    }
  }
}
```

#### 错误处理自动化流程
```bash
# 错误分类和诊断脚本
./error-diagnostic.sh --analyze logs/error-20250801-153000.log
./error-diagnostic.sh --categorize --provider codewhisperer
./error-diagnostic.sh --recommend-fix --error-code 500
```

## 🛠️ 交付测试实施架构 (Delivery Testing Implementation Architecture)

### 配置管理系统

#### 配置生成脚本
```bash
# 生成所有Provider的单独配置
./scripts/generate-delivery-configs.sh

# 生成特定Provider配置
./scripts/generate-delivery-configs.sh --provider codewhisperer --port 3458
```

#### 配置验证脚本
```bash
# 验证配置文件完整性
./scripts/validate-delivery-configs.sh config/delivery-testing/
```

### 🔐 权限审核与执行控制标准 (Permission Audit & Execution Control Standards)

#### 测试前权限审核机制 (Pre-test Permission Audit Mechanism)

每次交付测试开始前，必须执行完整的权限审核流程，确保所有需要的权限都已获得用户真实审批。

##### 权限审核清单 (Permission Audit Checklist)
```
# 测试权限审核清单 - YYYY-MM-DD HH:MM:SS

## 基础系统权限
- [ ] 文件系统读取权限 (配置文件、日志文件、数据库目录)
- [ ] 文件系统写入权限 (测试报告、临时文件、日志输出)
- [ ] 网络访问权限 (连接Provider API、访问外部服务)
- [ ] 进程管理权限 (启动/停止服务器进程)
- [ ] 端口绑定权限 (监听测试端口)

## RCC命令执行权限
- [ ] rcc start 命令执行权限
- [ ] rcc stop 命令执行权限
- [ ] rcc status 命令执行权限
- [ ] rcc config 命令执行权限

## 敏感目录访问权限
- [ ] ~/.route-claude-code/ 目录访问权限
- [ ] ./config/ 目录读写权限
- [ ] ./database/ 目录读写权限
- [ ] ./reports/ 目录读写权限
- [ ] ./scripts/ 目录执行权限

## Provider API访问权限
- [ ] CodeWhisperer API访问权限
- [ ] OpenAI Compatible API访问权限
- [ ] Gemini API访问权限
- [ ] Anthropic API访问权限

## 系统资源使用权限
- [ ] 内存使用权限 (测试期间可能需要较大内存)
- [ ] CPU使用权限 (高负载测试场景)
- [ ] 磁盘空间使用权限 (日志和报告生成)

## 用户审批确认
- [ ] 用户已明确知晓测试范围和可能的影响
- [ ] 用户已授权执行所有必需的操作
- [ ] 用户已确认可以接受测试期间的服务中断(如适用)
```

##### 权限审核执行脚本
```
# 权限审核脚本路径
./scripts/test-permission-audit.js

# 执行权限审核
node ./scripts/test-permission-audit.js --audit --interactive

# 静默权限检查(用于自动化流程)
node ./scripts/test-permission-audit.js --check
```

#### 测试执行控制机制 (Test Execution Control Mechanism)

为了避免测试过程中因权限问题暂停进度，所有测试操作必须在获得完整权限后执行。

##### 执行前检查 (Pre-execution Check)
```
# 检查权限状态
./scripts/test-execution-control.sh --check-permissions

# 验证环境准备状态
./scripts/test-execution-control.sh --verify-environment

# 确认用户审批状态
./scripts/test-execution-control.sh --check-approval
```

##### 自动化执行流程
```
# 完整的自动化测试执行流程
./scripts/test-execution-control.sh --run-full-delivery-test

# 按模块执行测试
./scripts/test-execution-control.sh --run-unit-tests
./scripts/test-execution-control.sh --run-blackbox-tests
./scripts/test-execution-control.sh --run-e2e-tests
```

### 📝 功能脚本预留与维护标准 (Functional Script Reservation & Maintenance Standards)

为应对测试过程中可能需要的修改和意外情况修复，必须预留两个功能脚本，且修改这些脚本时不需要用户二次审批。

#### 脚本预留要求 (Script Reservation Requirements)

##### 1. 测试配置修改脚本 (Test Configuration Modification Script)
```
# 脚本路径
./scripts/delivery-test-config-modifier.js

# 脚本功能
- 动态修改测试配置参数
- 调整Provider设置
- 修改测试场景参数
- 更新路由规则
- 调整负载均衡策略

# 使用示例
node ./scripts/delivery-test-config-modifier.js --update-provider-weight codewhisperer 80
node ./scripts/delivery-test-config-modifier.js --toggle-model codewhisperer CLAUDE_SONNET_4_20250514_V1_0 disable
node ./scripts/delivery-test-config-modifier.js --adjust-rate-limit 429 600
```

##### 2. 测试修复与恢复脚本 (Test Fix & Recovery Script)
```
# 脚本路径
./scripts/delivery-test-recovery.js

# 脚本功能
- 处理测试过程中的意外情况
- 恢复测试环境到稳定状态
- 修复测试数据不一致问题
- 重启失败的测试组件
- 清理卡住的测试进程

# 使用示例
node ./scripts/delivery-test-recovery.js --recover-test-environment
node ./scripts/delivery-test-recovery.js --cleanup-stuck-processes
node ./scripts/delivery-test-recovery.js --reset-test-database
node ./scripts/delivery-test-recovery.js --restore-from-backup latest
```

#### 脚本维护规范 (Script Maintenance Guidelines)

##### 可维护性要求
- 脚本必须具备良好的注释和文档
- 脚本应支持命令行参数和配置文件两种配置方式
- 脚本应提供详细的执行日志
- 脚本应具备错误处理和恢复能力

##### 免审批修改原则
- 对预留功能脚本的修改不需要用户二次审批
- 脚本修改后必须通过自动化测试验证
- 脚本修改应保持向后兼容性
- 脚本修改应记录在版本控制系统中

##### 脚本使用日志
```
# 功能脚本使用日志

## delivery-test-config-modifier.js 使用记录
- 2025-08-10 14:30:00: 调整codewhisperer权重至80%
- 2025-08-10 15:45:00: 禁用gemini模型进行维护

## delivery-test-recovery.js 使用记录  
- 2025-08-10 16:20:00: 清理卡住的测试进程
- 2025-08-10 17:05:00: 恢复测试环境
```

### 🚀 测试执行流程更新 (Updated Test Execution Flow)

#### 完整交付测试流程
```
# 1. 权限审核 (必须获得用户真实审批)
node ./scripts/test-permission-audit.js --audit --interactive

# 2. 环境准备和验证
./scripts/test-execution-control.sh --prepare-environment

# 3. 执行单元测试
./scripts/test-execution-control.sh --run-unit-tests

# 4. 执行黑盒测试  
./scripts/test-execution-control.sh --run-blackbox-tests

# 5. 执行端到端测试
./scripts/test-execution-control.sh --run-e2e-tests

# 6. 生成测试报告
./scripts/test-execution-control.sh --generate-reports

# 7. 清理测试环境
./scripts/test-execution-control.sh --cleanup-environment
```

#### 异常处理流程
```
# 当测试过程中出现意外情况时
# 1. 使用预留的修复脚本处理问题
node ./scripts/delivery-test-recovery.js --recover-test-environment

# 2. 如需要调整配置，使用配置修改脚本
node ./scripts/delivery-test-config-modifier.js --update-setting value

# 3. 继续执行测试流程
./scripts/test-execution-control.sh --continue-tests
```

## 📋 交付测试合规性检查清单 (Delivery Testing Compliance Checklist)

### 权限与审批合规性
- [ ] 所有测试执行前已完成权限审核
- [ ] 用户已明确审批所有必需的操作权限
- [ ] 敏感操作均已获得适当授权
- [ ] 不存在未经审批的权限使用

### 功能脚本合规性
- [ ] 已预留两个功能脚本用于测试修改
- [ ] 功能脚本具备完整的错误处理机制
- [ ] 功能脚本修改不需要二次用户审批
- [ ] 功能脚本已通过基本可用性测试

### 测试流程合规性
- [ ] 测试过程中不会因权限问题暂停进度
- [ ] 预留脚本能够处理测试中的意外情况
- [ ] 所有测试操作均有详细日志记录
- [ ] 测试环境可以在故障后快速恢复

### 报告与文档合规性
- [ ] 权限审核过程已完整记录
- [ ] 功能脚本使用情况已详细记录
- [ ] 测试执行过程中的所有变更均已记录
- [ ] 最终交付报告包含权限和脚本使用信息

## 🚀 实施指南 (Implementation Guide)

### Phase 1: 配置架构建立 (1-2天)
1. 创建delivery-testing配置目录结构
2. 生成所有Provider的单独配置文件
3. 实现配置验证和端口管理脚本
4. 建立数据采集目录架构

### Phase 2: 测试脚本开发 (2-3天)  
1. 开发单Provider测试脚本
2. 实现场景覆盖测试套件
3. 建立错误分类诊断系统
4. 创建数据重放验证机制

### Phase 3: 集成测试验证 (1-2天)
1. 运行完整交付测试流程
2. 验证所有检查清单项目
3. 生成标准化测试报告
4. 修复发现的问题

### Phase 4: 自动化部署 (1天)
1. 集成到CI/CD流程
2. 建立自动化交付验证
3. 实现测试结果通知机制
4. 完善监控和告警系统

---

**规则版本**: v2.6.0  
**维护者**: Jason Zhang  
**最后更新**: 2025-08-01  
**强制执行**: 每次交付前必须100%通过所有检查项