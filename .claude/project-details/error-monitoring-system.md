# 错误监控系统 - v2.7.0

## 系统概览

Claude Code Router v2.7.0引入了企业级的错误监控系统，专注于工具调用错误的实时检测、捕获和分析。

## 核心架构

### 1. PipelineDebugger
**文件位置**: `src/debug/pipeline-debugger.ts`

**核心职责**:
- 端口特定的日志管理
- 时间轮转的目录结构
- 工具调用错误检测和记录
- 原始数据流保存

### 2. 多层级检测系统

#### 检测覆盖范围
```
输入层 → 路由层 → 输出层 → 提供商层
   ↓        ↓       ↓        ↓
   ✅      [TODO]   ✅       ✅
```

**已实现的检测点**:
- **输出处理器**: `AnthropicOutputProcessor`
- **流式处理器**: `StreamingTransformer`  
- **提供商层**: `EnhancedOpenAIClient`

## 错误检测机制

### 1. 工具调用模式检测
```typescript
const toolCallPatterns = [
  // Tool call signatures
  /\{\s*"type"\s*:\s*"tool_use"/i,
  /\{\s*"name"\s*:\s*"[a-zA-Z_][a-zA-Z0-9_]*"/i,
  /\{\s*"function"\s*:/i,
  // Tool call keywords
  /tool_call/i,
  /function_call/i,
  // JSON structures
  /\{\s*"id"\s*:\s*"call_/i,
  /\{\s*"index"\s*:\s*\d+/i
];
```

### 2. 错误分类系统
| 错误类型 | 描述 | 检测位置 |
|----------|------|----------|
| `tool_call_parsing` | JSON解析失败 | Provider层 |
| `tool_call_conversion` | 格式转换错误 | Transformer层 |
| `tool_call_text_area` | 文本区域出现工具字样 | Output层 |
| `raw_stream_analysis` | 原始流分析错误 | 全层级 |

### 3. 实时检测流程
```
文本输入 → 模式匹配 → 错误分类 → 数据捕获 → 日志记录
   ↓           ↓          ↓          ↓          ↓
  实时       正则表达式   错误类型   原始数据   文件存储
```

## 日志存储结构

### 1. 目录架构
```
~/.route-claude-code/logs/
├── port-3456/                 # 开发环境
├── port-5508/                 # ShuaiHong服务
│   ├── 2025-08-02T12-30-00/   # 5分钟轮转目录
│   │   ├── tool-call-error-*.json
│   │   ├── streaming-session-*.json
│   │   └── failure-*.json
│   ├── tool-call-errors.jsonl # 汇总错误日志
│   └── failures.jsonl         # 汇总失败日志
└── ...
```

### 2. 错误记录格式
```json
{
  "timestamp": "2025-08-02T12:34:56.789Z",
  "requestId": "req_abc123",
  "errorType": "tool_call_text_area",
  "errorMessage": "Tool call detected in text area: /tool_call/i",
  "rawChunk": "original problematic data...",
  "parsedData": {...},
  "transformationStage": "output-processing",
  "provider": "anthropic-output",
  "model": "claude-4-sonnet",
  "port": 5508
}
```

## 集成实现

### 1. 输出处理器集成
**文件**: `src/output/anthropic/processor.ts`

```typescript
export class AnthropicOutputProcessor implements OutputProcessor {
  private pipelineDebugger: PipelineDebugger;

  constructor(port: number = 3456) {
    this.pipelineDebugger = new PipelineDebugger(port);
  }

  private checkForToolCallsInText(text: string, requestId: string, stage: string): void {
    this.pipelineDebugger.detectToolCallError(
      text,
      requestId,
      stage,
      'anthropic-output',
      'unknown'
    );
  }
}
```

### 2. 流式处理器集成
**文件**: `src/transformers/streaming.ts`

```typescript
// 文本内容检测
if (choice.delta.content && choice.delta.content.length > 0) {
  this.pipelineDebugger.detectToolCallError(
    choice.delta.content,
    this.requestId,
    'streaming-text-delta',
    'streaming-transformer',
    this.model
  );
}
```

## 监控特性

### 1. 永久开启机制
- **不依赖debug开关**: 无论服务如何启动都会监控
- **自动初始化**: 每个端口自动创建监控实例
- **静默运行**: 不影响正常业务流程

### 2. 数据完整性保障
- **原始数据保存**: 完整保留problematic chunks
- **上下文信息**: 请求ID、处理阶段、时间戳
- **分析能力**: 支持离线深度分析

### 3. 性能优化
- **异步记录**: 不阻塞主要业务流程
- **批量处理**: 高效的文件I/O操作
- **自动清理**: 定期清理过期日志

## 使用指南

### 1. 日志查看
```bash
# 查看特定端口的工具错误
tail -f ~/.route-claude-code/logs/port-5508/tool-call-errors.jsonl

# 查看最新的错误详情
ls -lt ~/.route-claude-code/logs/port-5508/*/tool-call-error-*.json | head -5

# 分析错误模式
grep "tool_call_text_area" ~/.route-claude-code/logs/port-5508/tool-call-errors.jsonl
```

### 2. 故障诊断
1. **检查错误类型分布**: 分析`errorType`字段
2. **追踪问题请求**: 使用`requestId`跟踪完整流程
3. **原始数据分析**: 查看`rawChunk`中的原始数据
4. **时间模式分析**: 查看错误发生的时间分布

### 3. 性能监控
- **错误率统计**: 计算工具调用失败比例
- **恢复时间**: 监控错误后的恢复情况
- **影响范围**: 评估错误对用户体验的影响

## 扩展计划

### 1. 短期目标
- [ ] 输入层错误检测集成
- [ ] 路由层错误检测集成
- [ ] 实时错误告警机制

### 2. 长期目标
- [ ] 机器学习错误预测
- [ ] 自动错误修复建议
- [ ] 性能指标可视化

## 配置选项

### 1. 轮转设置
- **时间间隔**: 5分钟（可配置）
- **保留期限**: 24小时（可配置）
- **文件大小限制**: 自动管理

### 2. 检测敏感度
- **模式匹配**: 可扩展的正则表达式
- **阈值设置**: 可调整的检测敏感度
- **过滤规则**: 支持白名单机制

这个监控系统为Claude Code Router提供了生产级的稳定性保障，确保工具调用相关的问题能够被及时发现和处理。