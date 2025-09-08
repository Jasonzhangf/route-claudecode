# Claude Code Router v4.0 双向转换机制完整设计

## 1. Transformer模块双向转换设计

### SecureAnthropicToOpenAITransformer
- **请求转换**：`transformRequest(input)` - Anthropic → OpenAI
- **响应转换**：`transformResponse(input)` - OpenAI → Anthropic
- **自动检测**：`process(input)` 方法自动检测输入类型并调用相应转换方法

```typescript
interface BidirectionalTransformer {
  transformRequest(input: any): Promise<any>;
  transformResponse(input: any): Promise<any>;
}
```

## 2. ServerCompatibility模块双向转换设计

### ServerCompatibilityModule 基类
- 创建了抽象基类实现 ModuleInterface
- 定义了双向兼容性接口 `BidirectionalCompatibility`
- 提供了请求/响应自动检测机制

```typescript
interface BidirectionalCompatibility {
  processRequest(request: any, context: any): Promise<any>;
  processResponse(response: any, context: any): Promise<any>;
}
```

### 具体实现模块
- **QwenCompatibilityModule**：处理Qwen API兼容性
- **IFlowCompatibilityModule**：处理iFlow API兼容性
- **ModelScopeCompatibilityModule**：处理ModelScope API兼容性

## 3. Protocol层协议内控制机制

### OpenAIProtocolModule 增强
- **流式控制**：
  - 流式请求 → 非流式请求（用于不支持流式的Provider）
  - 非流式响应 → 流式响应（模拟流式回复）
- **协议验证**：输入格式验证和标准化
- **错误处理**：协议错误的统一处理机制

### 协议控制器接口
```typescript
interface ProtocolController {
  processRequest(input: any): Promise<any>;
  processResponse(input: any): Promise<any>;
  validateProtocol(data: any): boolean;
  handleProtocolError(error: any): any;
}
```

## 4. 流水线数据流向

```
请求流向：
Client(Anthropic) → Router → Transformer(Anthropic→OpenAI) → Protocol → ServerCompatibility → Server

响应流向：
Server(OpenAI) → ServerCompatibility → Protocol → Transformer(OpenAI→Anthropic) → Client
```

## 5. 测试系统设计

### 核心组件
1. **数据捕获模块**：捕获参考实现和我们实现的请求/响应数据
2. **对比分析模块**：对比转换结果，识别差异
3. **自动调整模块**：基于差异自动调整转换规则
4. **报告生成模块**：生成测试报告和修复建议

### 测试流程
1. 启动参考实现和被测系统
2. 运行测试用例收集数据
3. 对比分析识别差异
4. 自动生成修复建议
5. 应用修复并回归测试

### 启动脚本
- 主启动脚本：`rcc-test-runner.sh`
- 数据捕获脚本：`data-capture.sh`
- 对比分析脚本：`comparison-analysis.sh`