# Claude Code Router双向转换测试计划

## 1. 测试目标

验证Claude Code Router四层流水线架构中各层的双向转换功能：
1. Transformer层：Anthropic ↔ OpenAI协议转换
2. Protocol层：协议内控制和流式处理
3. ServerCompatibility层：Provider特定兼容性处理
4. 端到端流水线集成测试

## 2. 测试环境

### 2.1 测试工具
- Jest测试框架
- Supertest用于HTTP请求测试
- Mock Provider服务
- 真实Provider API（LM Studio, Qwen等）

### 2.2 测试数据
- Anthropic格式请求样本
- OpenAI格式请求样本
- Provider特定响应样本
- 工具调用测试用例
- 流式处理测试用例

## 3. 测试用例设计

### 3.1 Transformer层测试

#### 3.1.1 请求转换测试 (Anthropic → OpenAI)
```javascript
// 测试用例1: 基本消息转换
test('Basic message conversion from Anthropic to OpenAI', async () => {
  const anthropicRequest = {
    model: 'claude-3-opus-20240229',
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ],
    max_tokens: 1000
  };
  
  const openaiRequest = await transformer.transformRequest(anthropicRequest);
  
  expect(openaiRequest.model).toBe('claude-3-opus-20240229');
  expect(openaiRequest.messages[0].role).toBe('user');
  expect(openaiRequest.messages[0].content).toBe('Hello, how are you?');
  expect(openaiRequest.max_tokens).toBe(1000);
});

// 测试用例2: 工具调用转换
test('Tool call conversion from Anthropic to OpenAI', async () => {
  const anthropicRequest = {
    model: 'claude-3-opus-20240229',
    messages: [
      { role: 'user', content: 'List files in current directory' }
    ],
    tools: [
      {
        name: 'list_files',
        description: 'List files in directory',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          }
        }
      }
    ]
  };
  
  const openaiRequest = await transformer.transformRequest(anthropicRequest);
  
  expect(openaiRequest.tools[0].type).toBe('function');
  expect(openaiRequest.tools[0].function.name).toBe('list_files');
  expect(openaiRequest.tools[0].function.parameters).toBeDefined();
});
```

#### 3.1.2 响应转换测试 (OpenAI → Anthropic)
```javascript
// 测试用例3: 基本响应转换
test('Basic response conversion from OpenAI to Anthropic', async () => {
  const openaiResponse = {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello! I am doing well.'
        }
      }
    ]
  };
  
  const anthropicResponse = await transformer.transformResponse(openaiResponse);
  
  expect(anthropicResponse.id).toBe('msg_123'); // 或其他Anthropic格式ID
  expect(anthropicResponse.type).toBe('message');
  expect(anthropicResponse.content[0].type).toBe('text');
  expect(anthropicResponse.content[0].text).toBe('Hello! I am doing well.');
});

// 测试用例4: 工具调用响应转换
test('Tool call response conversion from OpenAI to Anthropic', async () => {
  const openaiResponse = {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'list_files',
                arguments: '{"path": "."}'
              }
            }
          ]
        }
      }
    ]
  };
  
  const anthropicResponse = await transformer.transformResponse(openaiResponse);
  
  // 验证Anthropic工具调用格式
  expect(anthropicResponse.content[0].type).toBe('tool_use');
  expect(anthropicResponse.content[0].name).toBe('list_files');
});
```

### 3.2 Protocol层测试

#### 3.2.1 流式处理测试
```javascript
// 测试用例5: 流式请求转换
test('Streaming request conversion', async () => {
  const streamRequest = {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: true
  };
  
  const nonStreamRequest = await protocol.processRequest(streamRequest);
  
  expect(nonStreamRequest.stream).toBe(false);
});

// 测试用例6: 非流式响应转换为流式
test('Non-streaming response to streaming conversion', async () => {
  const nonStreamResponse = {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello!' }
      }
    ]
  };
  
  const streamResponse = await protocol.processResponse(nonStreamResponse);
  
  expect(streamResponse.chunks).toBeDefined();
  expect(streamResponse.chunks.length).toBeGreaterThan(0);
});
```

#### 3.2.2 协议验证测试
```javascript
// 测试用例7: 协议格式验证
test('Protocol format validation', async () => {
  const invalidRequest = {
    model: 'gpt-4',
    // 缺少messages字段
  };
  
  expect(() => protocol.validateProtocol(invalidRequest)).toThrow();
});

// 测试用例8: 协议错误处理
test('Protocol error handling', async () => {
  const invalidRequest = {
    model: 'gpt-4',
    messages: 'invalid-format' // 应该是数组
  };
  
  const errorResponse = protocol.handleProtocolError(invalidRequest);
  
  expect(errorResponse.error).toBeDefined();
  expect(errorResponse.error.type).toBe('protocol_error');
});
```

### 3.3 ServerCompatibility层测试

#### 3.3.1 iFlow兼容性测试
```javascript
// 测试用例9: iFlow参数处理
test('iFlow parameter processing', async () => {
  const request = {
    model: 'iflow-model',
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 0.8
  };
  
  const context = {
    requestId: 'test-123',
    providerName: 'iflow'
  };
  
  const processedRequest = await iflowCompatibility.processRequest(request, null, context);
  
  // 验证top_k参数计算
  expect(processedRequest.top_k).toBeDefined();
  expect(processedRequest.top_k).toBeGreaterThan(0);
});

// 测试用例10: iFlow响应标准化
test('iFlow response normalization', async () => {
  const response = {
    choices: [
      {
        message: { role: 'assistant', content: 'Hello' }
      }
    ]
    // 缺少id和object字段
  };
  
  const context = {
    requestId: 'test-123'
  };
  
  const normalizedResponse = await iflowCompatibility.processResponse(response, null, context);
  
  expect(normalizedResponse.id).toBeDefined();
  expect(normalizedResponse.object).toBe('chat.completion');
});
```

#### 3.3.2 Qwen兼容性测试
```javascript
// 测试用例11: Qwen工具调用修复
test('Qwen tool call flow fixing', async () => {
  const messages = [
    {
      role: 'assistant',
      content: 'I will list the files for you.',
      tool_calls: [
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'list_files',
            arguments: '{"path": "."}'
          }
        }
      ]
    }
    // 缺少对应的tool消息
  ];
  
  const fixedMessages = qwenCompatibility.fixQwenToolCallingConversationFlow(messages, 'test-123');
  
  // 验证是否添加了tool消息
  expect(fixedMessages.length).toBe(2);
  expect(fixedMessages[1].role).toBe('tool');
  expect(fixedMessages[1].tool_call_id).toBe('call_123');
});

// 测试用例12: Qwen认证处理
test('Qwen authentication processing', async () => {
  const request = {
    model: 'qwen-max',
    messages: [{ role: 'user', content: 'Hello' }]
  };
  
  const context = {
    requestId: 'test-123',
    providerName: 'qwen'
  };
  
  const processedRequest = await qwenCompatibility.processRequest(request, null, context);
  
  // 验证认证信息是否加载
  expect(context.metadata.protocolConfig.apiKey).toBeDefined();
});
```

#### 3.3.3 ModelScope兼容性测试
```javascript
// 测试用例13: ModelScope工具格式转换
test('ModelScope tool format conversion', async () => {
  const tools = [
    {
      name: 'list_files',
      description: 'List files in directory',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        }
      }
    }
  ];
  
  const convertedTools = modelscopeCompatibility.convertAnthropicToOpenAI(tools);
  
  expect(convertedTools[0].type).toBe('function');
  expect(convertedTools[0].function.name).toBe('list_files');
  expect(convertedTools[0].function.parameters).toBeDefined();
});

// 测试用例14: ModelScope模型映射
test('ModelScope model mapping', async () => {
  const request = {
    model: 'default',
    messages: [{ role: 'user', content: 'Hello' }]
  };
  
  const context = {
    requestId: 'test-123',
    config: {
      actualModel: 'modelscope-qwen-7b'
    }
  };
  
  const processedRequest = await modelscopeCompatibility.processRequest(request, null, context);
  
  expect(processedRequest.model).toBe('modelscope-qwen-7b');
});
```

### 3.4 端到端集成测试

#### 3.4.1 完整流水线测试
```javascript
// 测试用例15: 完整请求处理流水线
test('Complete request processing pipeline', async () => {
  // 1. Anthropic请求
  const anthropicRequest = {
    model: 'claude-3-opus-20240229',
    messages: [
      { role: 'user', content: 'List files in current directory' }
    ],
    tools: [
      {
        name: 'list_files',
        description: 'List files in directory',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          }
        }
      }
    ]
  };
  
  // 2. Transformer层处理
  const openaiRequest = await transformer.transformRequest(anthropicRequest);
  
  // 3. Protocol层处理
  const protocolRequest = await protocol.processRequest(openaiRequest);
  
  // 4. ServerCompatibility层处理
  const context = {
    requestId: 'test-123',
    providerName: 'qwen',
    config: {
      actualModel: 'qwen-max'
    }
  };
  const compatibleRequest = await qwenCompatibility.processRequest(protocolRequest, null, context);
  
  // 5. 模拟Provider响应
  const providerResponse = {
    id: 'qwen-123',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'list_files',
                arguments: '{"path": "."}'
              }
            }
          ]
        }
      }
    ]
  };
  
  // 6. ServerCompatibility层响应处理
  const compatibleResponse = await qwenCompatibility.processResponse(providerResponse, null, context);
  
  // 7. Protocol层响应处理
  const protocolResponse = await protocol.processResponse(compatibleResponse);
  
  // 8. Transformer层响应处理
  const anthropicResponse = await transformer.transformResponse(protocolResponse);
  
  // 验证最终结果
  expect(anthropicResponse.content[0].type).toBe('tool_use');
  expect(anthropicResponse.content[0].name).toBe('list_files');
});
```

#### 3.4.2 流式处理端到端测试
```javascript
// 测试用例16: 流式处理端到端测试
test('End-to-end streaming processing', async () => {
  // 1. Anthropic流式请求
  const anthropicStreamRequest = {
    model: 'claude-3-opus-20240229',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: true
  };
  
  // 2. Transformer层处理
  const openaiRequest = await transformer.transformRequest(anthropicStreamRequest);
  
  // 3. Protocol层处理（流式转非流式）
  const nonStreamRequest = await protocol.processRequest(openaiRequest);
  expect(nonStreamRequest.stream).toBe(false);
  
  // 4. ServerCompatibility层处理
  const context = {
    requestId: 'test-123',
    providerName: 'iflow'
  };
  const compatibleRequest = await iflowCompatibility.processRequest(nonStreamRequest, null, context);
  
  // 5. 模拟Provider非流式响应
  const providerResponse = {
    id: 'iflow-123',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello! How can I help you today?' }
      }
    ]
  };
  
  // 6. ServerCompatibility层响应处理
  const compatibleResponse = await iflowCompatibility.processResponse(providerResponse, null, context);
  
  // 7. Protocol层响应处理（非流式转流式）
  const streamResponse = await protocol.processResponse(compatibleResponse);
  expect(streamResponse.chunks).toBeDefined();
  expect(streamResponse.chunks.length).toBeGreaterThan(0);
  
  // 8. Transformer层响应处理
  const anthropicResponse = await transformer.transformResponse(streamResponse);
  // 验证结果格式
});
```

## 4. 性能测试

### 4.1 转换性能测试
```javascript
// 测试用例17: 转换性能测试
test('Transformation performance test', async () => {
  const anthropicRequest = {
    model: 'claude-3-opus-20240229',
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ],
    tools: [
      {
        name: 'list_files',
        description: 'List files in directory',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          }
        }
      }
    ]
  };
  
  const startTime = Date.now();
  
  // 执行1000次转换
  for (let i = 0; i < 1000; i++) {
    await transformer.transformRequest(anthropicRequest);
  }
  
  const endTime = Date.now();
  const avgTime = (endTime - startTime) / 1000;
  
  // 平均转换时间应该小于1ms
  expect(avgTime).toBeLessThan(1);
});
```

### 4.2 内存使用测试
```javascript
// 测试用例18: 内存使用测试
test('Memory usage test', async () => {
  const startMemory = process.memoryUsage().heapUsed;
  
  const anthropicRequest = {
    model: 'claude-3-opus-20240229',
    messages: [{ role: 'user', content: 'Hello' }]
  };
  
  // 执行10000次转换
  for (let i = 0; i < 10000; i++) {
    await transformer.transformRequest(anthropicRequest);
  }
  
  const endMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB
  
  // 内存增长应该小于10MB
  expect(memoryIncrease).toBeLessThan(10);
});
```

## 5. 错误处理测试

### 5.1 输入验证测试
```javascript
// 测试用例19: 无效输入处理
test('Invalid input handling', async () => {
  // 测试null输入
  await expect(transformer.transformRequest(null)).rejects.toThrow();
  
  // 测试undefined输入
  await expect(transformer.transformRequest(undefined)).rejects.toThrow();
  
  // 测试空对象输入
  await expect(transformer.transformRequest({})).rejects.toThrow();
});
```

### 5.2 异常恢复测试
```javascript
// 测试用例20: 异常恢复测试
test('Exception recovery test', async () => {
  // 模拟转换过程中出现异常
  const invalidRequest = {
    model: 'invalid-model',
    messages: [{ role: 'user', content: 'Hello' }],
    // 缺少必要字段
  };
  
  try {
    await transformer.transformRequest(invalidRequest);
  } catch (error) {
    // 验证错误被正确捕获和处理
    expect(error).toBeDefined();
  }
  
  // 验证模块状态仍然正常
  const status = transformer.getStatus();
  expect(status.health).toBe('degraded');
});
```

## 6. 兼容性测试

### 6.1 不同Provider测试
```javascript
// 测试用例21: 多Provider兼容性测试
test('Multi-provider compatibility test', async () => {
  const anthropicRequest = {
    model: 'claude-3-opus-20240229',
    messages: [{ role: 'user', content: 'Hello' }]
  };
  
  const openaiRequest = await transformer.transformRequest(anthropicRequest);
  
  // 测试不同Provider的兼容性处理
  const providers = ['qwen', 'iflow', 'modelscope'];
  const contexts = providers.map(provider => ({
    requestId: `test-${provider}`,
    providerName: provider,
    config: {
      actualModel: `${provider}-test-model`
    }
  }));
  
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const context = contexts[i];
    
    let compatibleRequest;
    switch (provider) {
      case 'qwen':
        compatibleRequest = await qwenCompatibility.processRequest(openaiRequest, null, context);
        break;
      case 'iflow':
        compatibleRequest = await iflowCompatibility.processRequest(openaiRequest, null, context);
        break;
      case 'modelscope':
        compatibleRequest = await modelscopeCompatibility.processRequest(openaiRequest, null, context);
        break;
    }
    
    // 验证每个Provider的处理结果
    expect(compatibleRequest.model).toBe(`${provider}-test-model`);
  }
});
```

## 7. 测试执行计划

### 7.1 测试阶段
1. **单元测试阶段**：各模块独立功能测试（30%）
2. **集成测试阶段**：模块间接口和数据流验证（40%）
3. **端到端测试阶段**：完整请求处理流程测试（20%）
4. **性能测试阶段**：系统性能和响应时间评估（10%）

### 7.2 测试覆盖率目标
- **代码覆盖率**：80%+
- **分支覆盖率**：75%+
- **路径覆盖率**：70%+

### 7.3 测试环境要求
- Node.js 18+
- TypeScript 5.0+
- Jest 29+
- 至少2GB可用内存
- 网络连接（用于真实API测试）

这个测试计划确保了Claude Code Router双向转换机制的完整性和正确性。