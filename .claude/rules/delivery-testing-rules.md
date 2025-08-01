# 🚀 交付测试标准规则 (Delivery Testing Standards Rules)

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
```json
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

# 验证Provider连接性
./scripts/validate-provider-connectivity.sh --config config-codewhisperer-only.json
```

### 数据采集系统

#### 数据采集服务
```typescript
// 自动数据采集服务
class DeliveryDataCollector {
  async captureRequest(providerId: string, request: any): Promise<void>
  async captureResponse(providerId: string, response: any): Promise<void>
  async generateGoldenDataset(scenario: string): Promise<void>
  async validateDataIntegrity(): Promise<boolean>
}
```

#### 数据重放系统
```typescript
// 数据重放验证服务
class DeliveryDataReplayer {
  async replayScenario(datasetPath: string): Promise<TestResult>
  async validateExpectedOutcome(expected: any, actual: any): Promise<boolean>
  async generateComparisonReport(): Promise<ComparisonReport>
}
```

### 测试编排系统

#### 主测试脚本 (`delivery-test-master.sh`)
```bash
#!/bin/bash
# 交付测试主脚本

set -e

PROVIDERS=("codewhisperer" "openai" "gemini" "anthropic")
SCENARIOS=("tool-calls" "multi-turn" "large-input" "long-response")
BASE_PORT=3458

# Phase 1: Provider隔离测试
for provider in "${PROVIDERS[@]}"; do
    echo "🧪 Testing Provider: $provider"
    ./single-provider-test.sh --provider "$provider" --port $((BASE_PORT++))
done

# Phase 2: 场景覆盖测试  
for scenario in "${SCENARIOS[@]}"; do
    echo "🎭 Testing Scenario: $scenario"
    ./scenario-coverage-test.sh --scenario "$scenario" --all-providers
done

# Phase 3: 错误处理测试
echo "🚨 Testing Error Handling"
./error-handling-test.sh --all-error-types

# Phase 4: 数据重放验证
echo "📊 Validating with Golden Dataset"
./data-replay-test.sh --golden-dataset

echo "✅ Delivery Testing Complete - All Standards Verified"
```

#### 单Provider测试脚本 (`single-provider-test.sh`)
```bash
#!/bin/bash
# 单Provider隔离测试

PROVIDER=$1
PORT=$2
CONFIG="config/delivery-testing/config-${PROVIDER}-only.json"

# 启动Provider专用实例
./rcc start --config "$CONFIG" --port "$PORT" --daemon &
PID=$!

# 等待服务启动
sleep 5

# 运行完整场景测试套件
./test-runner.sh --target "http://localhost:$PORT" --scenarios all --provider "$PROVIDER"

# 清理
kill $PID
```

### 结果验证系统

#### 测试结果标准化
```json
{
  "deliveryTest": {
    "timestamp": "2025-08-01T15:30:00Z",
    "version": "v2.6.0",
    "standards": {
      "providerIsolation": {
        "status": "PASS|FAIL",
        "providers": {
          "codewhisperer": { "status": "PASS", "scenarios": 4, "errors": 0 },
          "openai": { "status": "PASS", "scenarios": 4, "errors": 0 },
          "gemini": { "status": "FAIL", "scenarios": 3, "errors": 1 },
          "anthropic": { "status": "PASS", "scenarios": 4, "errors": 0 }
        }
      },
      "portIsolation": {
        "status": "PASS",
        "portsUsed": [3458, 3459, 3460, 3461],
        "conflicts": 0
      },
      "dataCollection": {
        "status": "PASS", 
        "datasetsGenerated": 16,
        "dataIntegrity": "100%"
      },
      "scenarioCoverage": {
        "status": "PASS",
        "scenarios": {
          "toolCalls": "PASS",
          "multiTurn": "PASS", 
          "largeInput": "PASS",
          "longResponse": "PASS"
        }
      },
      "errorDiagnosis": {
        "status": "PASS",
        "errorsCategorized": 100,
        "localErrors": 15,
        "remoteErrors": 85
      }
    },
    "summary": {
      "overallStatus": "PASS|FAIL",
      "readinessLevel": "READY_FOR_PRODUCTION|NEEDS_FIXES|CRITICAL_ISSUES",
      "recommendations": [
        "Gemini Provider需要修复工具调用处理",
        "建议增加CodeWhisperer的错误重试机制"
      ]
    }
  }
}
```

## 📋 交付检查清单 (Delivery Checklist)

### 🔲 交付前强制检查项 (Mandatory Pre-Delivery Checklist)

#### Provider隔离测试 (Provider Isolation Testing)
- [ ] CodeWhisperer单独配置测试通过 (所有路由类别 → CodeWhisperer)
- [ ] OpenAI Compatible单独配置测试通过 (所有路由类别 → OpenAI)  
- [ ] Gemini单独配置测试通过 (所有路由类别 → Gemini)
- [ ] Anthropic单独配置测试通过 (所有路由类别 → Anthropic)
- [ ] 每个Provider的专用端口无冲突运行

#### 端口隔离验证 (Port Isolation Validation)
- [ ] 测试端口3458-3467全部可用
- [ ] 多Provider同时运行无端口冲突
- [ ] 服务启动自动端口清理正常工作
- [ ] 健康检查端点响应正常

#### 数据采集完整性 (Data Collection Integrity) 
- [ ] 每个Provider的输入输出数据完整采集
- [ ] 黄金标准数据集生成完成
- [ ] 数据重放E2E测试100%通过
- [ ] 数据完整性校验通过

#### 场景覆盖完整性 (Scenario Coverage Completeness)
- [ ] 工具调用场景 - 所有Provider测试通过
- [ ] 多轮会话场景 - 会话状态管理正常
- [ ] 大输入场景 - 内存和性能表现良好
- [ ] 长回复场景 - 流式响应稳定完整

#### 错误诊断准确性 (Error Diagnosis Accuracy)
- [ ] 本地500错误正确分类和诊断
- [ ] 远端4xx错误正确分类和处理
- [ ] 错误信息包含Provider和模型详情
- [ ] 错误恢复和重试机制工作正常

### 🔲 性能和质量指标 (Performance & Quality Metrics)

#### 响应时间要求 (Response Time Requirements)
- [ ] 单Provider响应时间 < 5秒 (95th percentile)
- [ ] 工具调用响应时间 < 10秒 (95th percentile)  
- [ ] 大输入处理时间 < 30秒 (95th percentile)
- [ ] 多轮会话状态切换 < 1秒

#### 稳定性要求 (Stability Requirements)
- [ ] Provider切换成功率 > 99%
- [ ] 连续运行24小时无内存泄漏
- [ ] 并发请求处理成功率 > 99.5%
- [ ] 错误恢复成功率 > 95%

#### 数据质量要求 (Data Quality Requirements)
- [ ] 数据采集成功率 > 99.9%
- [ ] 数据重放验证准确率 100%
- [ ] 响应内容完整性验证通过
- [ ] Token计算误差 < 1%

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