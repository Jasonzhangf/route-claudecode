# Demo2 vs Router 工具解析对比分析

## 关键发现

### 1. **事件结构差异**

**Demo2 (Go)**:
```go
type assistantResponseEvent struct {
    Content   string  `json:"content"`
    Input     *string `json:"input,omitempty"`  // 指针类型，可以为 nil
    Name      string  `json:"name"`
    ToolUseId string  `json:"toolUseId"`
    Stop      bool    `json:"stop"`
}
```

**我们的Router (TypeScript)**:
```typescript
// 我们处理的是两种不同的事件类型：
// 1. assistantResponseEvent - 文本内容
// 2. toolUseEvent - 工具调用 (这是关键差异!)
```

### 2. **事件分发逻辑差异**

**Demo2的逻辑**:
- 只处理 `assistantResponseEvent`
- 通过 `ToolUseId != ""` 和 `Name != ""` 判断是否为工具事件
- `Input` 为 `nil` 时 = 工具开始
- `Input` 有值时 = 工具输入流
- `Stop: true` 时 = 工具结束

**我们Router的逻辑**:
- 分别处理 `assistantResponseEvent` 和 `toolUseEvent`
- 可能存在事件类型判断问题

### 3. **具体差异分析**

**Demo2 - Line 109-124**:
```go
if evt.ToolUseId != "" && evt.Name != "" && !evt.Stop {
    if evt.Input == nil {  // 关键：检查 nil 而不是空字符串
        // 返回 content_block_start
    } else {
        // 返回 content_block_delta with input_json_delta
    }
}
```

**我们的Router**:
```typescript
// Tool use start event (no input yet and no stop)
if (!data.input && !data.stop) {  // 问题：!data.input 可能不等同于 nil 检查
    // 返回 content_block_start
}
```

### 4. **重要发现**

1. **Demo2只用一种事件类型** (`assistantResponseEvent`) 处理所有情况
2. **我们用两种事件类型** (`assistantResponseEvent` + `toolUseEvent`) 
3. **nil vs undefined/empty 检查差异**
4. **Demo2在工具结束时额外添加 `message_delta` 事件** (Lines 74-85)

### 5. **可能的问题**

1. 我们的 `toolUseEvent` 处理可能与 demo2 的 `assistantResponseEvent` 处理不一致
2. `Input` 字段的 null/undefined/empty 判断逻辑可能有差异  
3. 我们缺少工具结束时的 `message_delta` 事件