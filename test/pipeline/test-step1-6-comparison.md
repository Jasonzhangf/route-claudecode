# Demo2 Six-Step Process Comparison Test

## 测试用例
Replicate demo2 six-step process to compare with our current system and identify where API 400 errors occur

## 测试目标
通过完整重现demo2的六步处理流程，与当前系统进行对比分析，定位API 400错误的具体原因，确保每个环节都能正确处理请求和响应。

## 测试步骤详解

### Step 1: Input Processing
**目标**: 测试完整的API请求链路通畅性
- **输入**: 原始Anthropic API请求 (model, messages, max_tokens)
- **输出**: 完整API响应数据 → 保存到 `step1-output.json`
- **验证点**: 
  - 请求是否成功发送到本地系统 (localhost:3456)
  - 是否收到响应
  - 响应格式是否正确
- **失败指示**: API链路中断、服务器错误、网络问题

### Step 2: Routing Logic
**目标**: 验证模型路由逻辑正确性
- **输入**: `step1-output.json` 的请求和响应数据
- **输出**: 路由分析结果 → 保存到 `step2-output.json`
- **验证点**:
  - 输入模型是否正确识别类别 (default/background/thinking/longcontext/search)
  - 是否路由到正确的provider (codewhisperer-primary)
  - 是否映射到正确的目标模型 (CLAUDE_SONNET_4_20250514_V1_0)
- **失败指示**: 路由规则错误、模型映射失败、provider选择错误

### Step 3: Request Transformation
**目标**: 单独验证transformer转换逻辑
- **输入**: `step2-output.json` 的路由数据
- **输出**: 转换测试结果 → 保存到 `step3-output.json`
- **验证点**:
  - Anthropic请求 → CodeWhisperer请求转换是否正确
  - Profile ARN是否正确设置
  - Conversation ID是否为有效UUID格式
  - Model映射是否正确 ("claude-sonnet-4-20250514" → "CLAUDE_SONNET_4_20250514_V1_0")
  - Content字段是否正确提取
- **失败指示**: Transformer逻辑错误、格式转换失效、内容丢失

### Step 4: Raw API Response  
**目标**: 直接测试真实的CodeWhisperer API响应
- **输入**: Step3的demo2格式请求
- **输出**: 原始CodeWhisperer API响应 → 保存到 `step4-output.json`
- **验证点**:
  - CodeWhisperer API是否可达
  - 是否返回有效响应 (HTTP 200)
  - 响应格式是否为预期的二进制SSE格式
  - Token认证是否成功
- **失败指示**: API服务不可用、认证失败、响应格式错误、空内容

### Step 5: Parser Input
**目标**: 验证parser接收到的真实数据
- **输入**: `step4-output.json` 的真实API响应
- **输出**: Parser实际接收数据分析 → 保存到 `step5-output.json`
- **验证点**:
  - 二进制数据是否正确接收
  - AWS二进制帧结构是否完整
  - 帧头信息是否正确 (总长度、头长度)
  - 帧数量和大小是否合理
- **失败指示**: 数据传递中断、结构损坏、帧格式错误

### Step 6: Final Output
**目标**: 对比最终输出和系统整体表现
- **输入**: 所有前5步的结果数据
- **输出**: 完整对比分析报告 → 保存到 `step6-output.json`
- **验证点**:
  - 我们的系统vs直接调用CodeWhisperer的成功率对比
  - 响应格式一致性检查
  - 错误类型分析和原因定位
  - 性能和准确性对比
- **失败指示**: 系统性能不一致、响应格式不匹配、错误处理不当

## Demo2关键实现对比

### Model Mapping (from demo2/main.go)
```go
var ModelMap = map[string]string{
  "claude-sonnet-4-20250514": "CLAUDE_SONNET_4_20250514_V1_0",
  "claude-3-5-haiku-20241022": "CLAUDE_SONNET_4_20250514_V1_0",
  // ... 其他映射
}
```

### Request Structure (from buildCodeWhispererRequest)
```go
cwReq := CodeWhispererRequest{
  ProfileArn: "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  ConversationState: {
    ChatTriggerType: "MANUAL",
    ConversationId: generateUUID(),
    CurrentMessage: {
      UserInputMessage: {
        Content: getMessageContent(anthropicReq.Messages[len(anthropicReq.Messages)-1].Content),
        ModelId: modelId,
        Origin: "AI_EDITOR",
        UserInputMessageContext: {
          ToolResults: []
        }
      }
    },
    History: []
  }
}
```

### Authentication (from demo2)
- 使用 `~/.aws/sso/cache/kiro-auth-token.json` 中的accessToken
- Bearer token认证方式
- 自动token轮换和失效处理

## 测试配置

```javascript
const TEST_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  expectedCodeWhispererModel: 'CLAUDE_SONNET_4_20250514_V1_0',
  profileArn: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK',
  testMessage: 'Hello, how are you today?'
};
```

## 错误分析框架

### API错误分类
- **400 Bad Request**: 请求格式错误、缺少必需字段、模型名称无效
- **401 Unauthorized**: 认证失败、缺少Authorization头
- **403 Forbidden**: Token失效或权限不足
- **404 Not Found**: 端点不存在
- **429 Rate Limited**: 请求过于频繁
- **5xx Server Error**: 服务器内部错误

### 可能原因识别
1. **请求转换问题**: Anthropic → CodeWhisperer格式转换不正确
2. **认证问题**: Token过期、缺失或格式错误
3. **网络问题**: 服务未启动、端口被占用、网络连接失败
4. **配置问题**: Profile ARN错误、模型映射缺失

## 推荐修复策略

### 系统工作但直接API失败
- 检查CodeWhisperer token有效性
- 验证网络连接到AWS服务
- 确认Profile ARN配置正确

### 直接API工作但系统失败  
- 检查请求转换逻辑
- 验证模型映射配置
- 检查认证token处理流程

### 两者都失败
- 检查CodeWhisperer token存在性和有效性
- 验证网络连接
- 确认AWS服务状态

### 两者都工作
- 对比响应格式一致性
- 验证响应解析正确性
- 测试更复杂场景 (工具调用、多轮对话)

## 最近执行记录

### 执行时间
2025-07-27T16:09:02-16:09:06 (4秒)

### 执行状态  
✅ 所有6步测试全部通过

### 执行时长
约4秒 (非常快速)

### 日志文件
- `demo2-comparison-2025-07-27T16-09-02-150Z.json`
- `step4-raw-response-2025-07-27T16-09-02-150Z.bin`

### 关键发现
1. **系统完全正常**: 我们的系统和直接调用CodeWhisperer API都100%成功
2. **模型映射正确**: `claude-sonnet-4-20250514` → `CLAUDE_SONNET_4_20250514_V1_0`
3. **请求转换正确**: Demo2格式转换完全匹配
4. **认证工作正常**: Token认证成功，API返回200状态
5. **响应解析正确**: 二进制SSE格式正确解析为Anthropic格式

### 额外测试结果
经过复杂场景测试确认：
- **工具调用**: ✅ 正常工作
- **流式响应**: ✅ 正常工作  
- **多轮对话**: ✅ 正常工作

### 结论
**当前系统没有API 400错误**。所有核心功能正常运行，包括：
- 基础文本对话
- 工具调用 (tool_use)
- 流式响应 (SSE)
- 多轮对话历史
- 模型路由和映射
- 认证和权限管理

## 历史执行记录

### 2025-07-27 16:09 - 首次完整测试
- **结果**: 全部通过 ✅
- **发现**: 系统运行完全正常，无API错误
- **建议**: 继续监控，测试更复杂场景

## 相关文件
- **测试脚本**: `test/pipeline/test-step1-6-comparison.js`
- **输出文件**: `step1-output.json` 到 `step6-output.json`
- **最终报告**: `demo2-comparison-[timestamp].json`
- **原始响应**: `step4-raw-response-[timestamp].bin`

## 依赖项
- axios (HTTP请求)
- uuid (UUID生成)
- fs (文件操作)
- 本地Claude Code Router服务 (端口3456)
- 有效的CodeWhisperer token文件

## 使用方法
```bash
# 确保服务运行
./start-dev.sh

# 执行测试
node test/pipeline/test-step1-6-comparison.js

# 查看结果
cat step1-output.json
cat demo2-comparison-[timestamp].json
```