# LM Studio工具调用解析修复计划

## 问题概述

LM Studio在工具调用处理方面存在问题，导致工具调用被作为文本返回而不是结构化的tool_calls数组。这主要是因为：

1. LM Studio返回的工具调用格式与标准OpenAI格式不兼容
2. 当前的解析器无法正确识别和提取LM Studio的工具调用
3. LM Studio使用特殊的标记格式，如 `<|start|>assistant<|channel|>commentary to=functions.LS<|constrain|>JSON<|message|>{"path":"..."}`

## 问题分析

### 当前实现的不足

1. `src/transformers/lmstudio-fixer.ts` 中的正则表达式 `/<tool_call>\s*(\{.*?\})\s*<\/tool_call>/s` 与LM Studio实际返回的格式不匹配
2. 统一预处理器中对LM Studio模型的识别不完整
3. 缺乏对多种LM Studio格式的兼容性支持

### 实际LM Studio格式示例

根据样本数据分析，LM Studio返回的工具调用格式为：
```
<|start|>assistant<|channel|>commentary to=functions.LS<|constrain|>JSON<|message|>{"path":"/Users/fanzhang/Documents/github"}
```

## 修复方案

### 1. 更新LM Studio修复器

修改 `src/transformers/lmstudio-fixer.ts`：

```typescript
// 更新正则表达式以匹配LM Studio实际格式
const LMSTUDIO_TOOL_CALL_REGEX = /<\|start\|>assistant<\|channel\|>commentary to=functions\.(\w+)<\|constrain\|>(?:JSON|json)<\|message\|>(\{.*?\})/g;

// 添加新的解析逻辑
export function fixLmStudioResponse(response: any, requestId?: string): StandardOpenAIResponse {
  if (!response.choices || response.choices.length === 0) {
    return response;
  }

  const choice = response.choices[0];
  const content = choice.message?.content;

  if (typeof content !== 'string') {
    return response;
  }

  // 尝试匹配LM Studio格式
  const matches = [...content.matchAll(LMSTUDIO_TOOL_CALL_REGEX)];
  
  if (matches.length > 0) {
    try {
      const toolCalls: StandardToolCall[] = [];
      let newContent = content;
      
      // 处理所有匹配的工具调用
      for (const match of matches) {
        const functionName = match[1];
        const argsJson = match[2];
        const toolCallContent = JSON.parse(argsJson);
        
        const newToolCall: StandardToolCall = {
          id: `call_${Date.now()}_${toolCalls.length}`,
          type: 'function',
          function: {
            name: functionName,
            arguments: JSON.stringify(toolCallContent),
          },
        };
        
        toolCalls.push(newToolCall);
        // 从内容中移除工具调用标记
        newContent = newContent.replace(match[0], '');
      }
      
      // 移除工具调用标记后清理内容
      newContent = newContent.trim();
      
      const newChoice: StandardChoice = {
        ...choice,
        message: {
          ...choice.message,
          content: newContent || null,
          tool_calls: toolCalls,
        },
        finish_reason: 'tool_calls',
      };
      
      const newResponse: StandardOpenAIResponse = {
        ...response,
        choices: [newChoice],
      };

      logger.info('Successfully fixed LM Studio embedded tool calls', {
        originalContentLength: content.length,
        newContentLength: newContent.length,
        toolCallsCount: toolCalls.length,
        extractedTools: toolCalls.map(tc => tc.function.name),
      }, requestId, 'lmstudio-fixer');

      return newResponse;
    } catch (error) {
      logger.error('Failed to parse embedded tool calls JSON from LM Studio response', {
        error: error instanceof Error ? error.message : String(error),
      }, requestId, 'lmstudio-fixer');
    }
  }

  return response;
}
```

### 2. 增强统一预处理器

修改 `src/preprocessing/unified-patch-preprocessor.ts`：

```typescript
// 完善LM Studio模型列表
const targetModels = [
  'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-pro', 'gemini-flash', 'gemini-2.5-flash-lite',
  'glm-4.5', 'glm-4-plus', 'glm-4', 
  'DeepSeek-V3', 'deepseek-v3',
  'claude-4-sonnet', 'claude-3-sonnet',
  'ZhipuAI/GLM-4.5', 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
  'gpt-oss-20b-mlx', 'gpt-oss', 'qwen3-30b', 'glm-4.5-air', // LMStudio models
  'unsloth', 'gguf', 'mlx', // LMStudio format indicators
  'gpt-4o-mini', 'qwen3-coder', 'claude-4-sonnet', // ShuaiHong models
  // 添加更多LM Studio实际使用的模型
  'Meta-Llama-3.1-8B-Instruct-GGUF',
  'Meta-Llama-3-8B-Instruct',
  'Mistral-7B-Instruct-v0.3',
  'Mixtral-8x7B-Instruct-v0.1',
  'CodeLlama-7B-Instruct',
  'CodeLlama-13B-Instruct',
  'CodeLlama-34B-Instruct'
];
```

### 3. 添加多格式兼容性支持

在统一预处理器中添加更强大的工具调用检测：

```typescript
/**
 * 分析单个窗口中的工具调用
 */
private analyzeWindowForTools(window: string, offset: number): {
  toolCount: number;
  patterns: string[];
} {
  let toolCount = 0;
  const patterns: string[] = [];

  // 检测模式1: GLM-4.5格式 "Tool call: FunctionName({...})"
  const glmPattern = /Tool\s+call:\s*(\w+)\s*\((\{[^}]*\})\)/gi;
  let match;
  while ((match = glmPattern.exec(window)) !== null) {
    toolCount++;
    patterns.push(`GLM-${match[1]}@${offset + match.index}`);
  }

  // 检测模式2: JSON格式 {"type": "tool_use", ...}
  const jsonPattern = /\{\s*"type"\s*:\s*"tool_use"[^}]*\}/gi;
  while ((match = jsonPattern.exec(window)) !== null) {
    toolCount++;
    patterns.push(`JSON-tool_use@${offset + match.index}`);
  }

  // 检测模式3: LM Studio格式
  const lmstudioPattern = /<\|start\|>assistant<\|channel\|>commentary to=functions\.(\w+)<\|constrain\|>(?:JSON|json)<\|message\|>(\{[^}]*\})/gi;
  while ((match = lmstudioPattern.exec(window)) !== null) {
    toolCount++;
    patterns.push(`LMSTUDIO-${match[1]}@${offset + match.index}`);
  }

  // 检测模式4: 直接函数调用格式 "functionName({...})"
  const funcPattern = /(\w+)\s*\(\s*(\{[^}]*"[^"]*"[^}]*\})/gi;
  while ((match = funcPattern.exec(window)) !== null) {
    // 排除常见的非工具调用模式
    const funcName = match[1].toLowerCase();
    if (!['console', 'json', 'object', 'array', 'string', 'math'].includes(funcName)) {
      toolCount++;
      patterns.push(`FUNC-${match[1]}@${offset + match.index}`);
    }
  }

  // 检测模式5: OpenAI函数调用格式
  const openaiPattern = /"function_call"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/gi;
  while ((match = openaiPattern.exec(window)) !== null) {
    toolCount++;
    patterns.push(`OPENAI-${match[1]}@${offset + match.index}`);
  }

  return { toolCount, patterns };
}
```

## 实施步骤

1. **更新LM Studio修复器**：
   - 修改 `src/transformers/lmstudio-fixer.ts` 以支持LM Studio实际格式
   - 测试修复器对样本数据的处理效果

2. **增强统一预处理器**：
   - 更新模型列表以包含更多LM Studio模型
   - 改进工具调用检测逻辑

3. **测试验证**：
   - 使用收集的样本数据验证修复效果
   - 进行端到端测试确保工具调用正常工作

4. **部署和监控**：
   - 部署修复到5506端口
   - 监控工具调用解析成功率
   - 收集新的失败案例以进一步优化

## 预期结果

通过实施以上修复方案，预期能够：

1. 正确解析LM Studio返回的工具调用格式
2. 提高LM Studio工具调用的成功率
3. 减少工具解析失败的错误报告
4. 提升整体系统对LM Studio模型的支持能力