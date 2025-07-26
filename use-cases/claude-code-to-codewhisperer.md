# Use Case: Claude Code → CodeWhisperer 一键重映射

## 场景描述
用户使用Claude Code进行开发，但希望将所有请求重定向到AWS CodeWhisperer，实现成本优化和性能提升。通过一键启动服务器，将Claude Code的多个模型全部重映射到CodeWhisperer的对应模型。

## 用户需求
- **输入**: Claude Code (Anthropic格式)
- **供应商**: AWS CodeWhisperer 
- **目标**: 一键启动服务器，自动重映射所有Claude模型到CodeWhisperer
- **要求**: 透明代理，Claude Code无需修改配置

## 技术实现

### 1. 模型映射配置
```json
{
  "input": "anthropic",
  "output": "anthropic", 
  "provider": "codewhisperer",
  "modelMapping": {
    "claude-sonnet-4-20250514": "CLAUDE_SONNET_4_20250514_V1_0",
    "claude-3-5-haiku-20241022": "CLAUDE_3_7_SONNET_20250219_V1_0"
  },
  "routingRules": {
    "default": "CLAUDE_SONNET_4_20250514_V1_0",
    "background": "CLAUDE_3_7_SONNET_20250219_V1_0",
    "thinking": "CLAUDE_SONNET_4_20250514_V1_0", 
    "longcontext": "CLAUDE_SONNET_4_20250514_V1_0",
    "search": "CLAUDE_3_7_SONNET_20250219_V1_0"
  }
}
```

### 2. 环境变量劫持
```bash
# 启动服务器后自动设置
export ANTHROPIC_BASE_URL=http://localhost:3456
export ANTHROPIC_API_KEY=any-string-is-ok
```

### 3. 一键启动命令
```bash
# 开发环境启动
npm run start:dev -- --provider=codewhisperer --port=3456

# 生产环境启动  
npm run start:prod -- --provider=codewhisperer --port=3457

# 或者使用配置文件
ccr start --config=claude-to-codewhisperer.json
```

## 架构流程

### 请求处理流程
```
Claude Code Request
        ↓
[Input Module: Anthropic]
        ↓ 
[Routing Module: Model Classification]
        ↓
[Output Module: Anthropic Format]
        ↓
[Provider: CodeWhisperer]
        ↓
AWS CodeWhisperer API
        ↓
[Response Processing]
        ↓
Claude Code Response
```

### 具体实现步骤

#### 1. 输入模块 (input/anthropic/)
```typescript
// input/anthropic/index.ts
export class AnthropicInputHandler {
  async processRequest(req: AnthropicRequest): Promise<ProcessedRequest> {
    return {
      originalModel: req.model,
      messages: req.messages,
      system: req.system,
      tools: req.tools,
      stream: req.stream,
      metadata: {
        inputFormat: 'anthropic',
        originalRequest: req
      }
    };
  }
}
```

#### 2. 路由模块 (routing/)
```typescript
// routing/index.ts
export class ModelRouter {
  private config: RouterConfig;
  
  async route(request: ProcessedRequest): Promise<RoutingDecision> {
    const category = this.classifyRequest(request);
    const targetModel = this.config.routingRules[category];
    
    return {
      targetProvider: 'codewhisperer',
      targetModel: targetModel,
      outputFormat: 'anthropic',
      category: category
    };
  }
  
  private classifyRequest(request: ProcessedRequest): string {
    // 基于demo1的路由逻辑
    const tokenCount = this.calculateTokens(request.messages);
    
    if (tokenCount > 60000) return 'longcontext';
    if (request.originalModel?.includes('haiku')) return 'background';
    if (request.metadata?.thinking) return 'thinking';
    if (request.tools?.some(t => t.name.includes('search'))) return 'search';
    
    return 'default';
  }
}
```

#### 3. 输出模块 (output/anthropic/)
```typescript
// output/anthropic/index.ts
export class AnthropicOutputHandler {
  async formatRequest(
    request: ProcessedRequest, 
    routing: RoutingDecision
  ): Promise<ProviderRequest> {
    return {
      provider: routing.targetProvider,
      model: routing.targetModel,
      format: 'anthropic',
      data: request
    };
  }
  
  async formatResponse(
    providerResponse: any,
    originalRequest: ProcessedRequest
  ): Promise<AnthropicResponse> {
    // 保持Anthropic格式不变，直接返回
    return providerResponse;
  }
}
```

#### 4. CodeWhisperer提供商 (providers/codewhisperer/)
```typescript
// providers/codewhisperer/index.ts (基于demo2实现)
export class CodeWhispererProvider {
  private auth: CodeWhispererAuth;
  private converter: CodeWhispererConverter;
  private parser: CodeWhispererParser;
  
  async processRequest(request: ProviderRequest): Promise<any> {
    // 1. 获取认证token
    const token = await this.auth.getValidToken();
    
    // 2. 转换请求格式 (基于demo2的buildCodeWhispererRequest)
    const cwRequest = this.converter.convertRequest(request.data, request.model);
    
    // 3. 发送请求到CodeWhisperer
    const response = await this.sendRequest(cwRequest, token);
    
    // 4. 解析响应 (基于demo2的SSE解析器)
    if (request.data.stream) {
      return this.parser.parseStreamResponse(response);
    } else {
      return this.parser.parseResponse(response);
    }
  }
}
```

## 配置文件示例

### claude-to-codewhisperer.json
```json
{
  "name": "Claude Code to CodeWhisperer",
  "description": "将Claude Code请求重映射到AWS CodeWhisperer",
  "
  "input": {
    "format": "anthropic",
    "defaultInstance": true
  },
  "routing": {
    "rules": {
      "default": {
        "provider": "codewhisperer",
        "model": "CLAUDE_3_5_SONNET_20241022_V2_0"
      },
      "background": {
        "provider": "codewhisperer", 
        "model": "CLAUDE_3_5_HAIKU_20241022_V1_0"
      },
      "thinking": {
        "provider": "codewhisperer",
        "model": "CLAUDE_3_7_SONNET_20250219_V1_0"
      },
      "longcontext": {
        "provider": "codewhisperer",
        "model": "CLAUDE_SONNET_4_20250514_V1_0"
      },
      "search": {
        "provider": "codewhisperer",
        "model": "CLAUDE_3_5_SONNET_20241022_V2_0"
      }
    }
  },
  "output": {
    "format": "anthropic"
  },
  "providers": {
    "codewhisperer": {
      "type": "aws",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token.json",
      "loadBalance": true,
      "instances": [
        {
          "name": "primary",
          "enabled": true
        }
      ]
    }
  },
  "server": {
    "port": 3456,
    "host": "127.0.0.1",
    "cors": true
  },
  "hooks": {
    "debug": false,
    "logRequests": true,
    "logResponses": true
  }
}
```

## 启动脚本

### package.json scripts
```json
{
  "scripts": {
    "claude-to-cw": "ccr start --config=use-cases/claude-to-codewhisperer.json",
    "claude-to-cw:dev": "ccr start --config=use-cases/claude-to-codewhisperer.json --port=3456 --debug",
    "claude-to-cw:prod": "ccr start --config=use-cases/claude-to-codewhisperer.json --port=3457"
  }
}
```

### 一键启动脚本
```bash
#!/bin/bash
# scripts/start-claude-codewhisperer.sh

echo "🚀 启动 Claude Code → CodeWhisperer 路由器"

# 检查Kiro token
if [ ! -f ~/.aws/sso/cache/kiro-auth-token.json ]; then
    echo "❌ 未找到Kiro认证token，请先运行: kiro2cc refresh"
    exit 1
fi

# 启动服务器
echo "📡 启动路由服务器..."
npm run claude-to-cw &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 设置环境变量
echo "🔧 设置Claude Code环境变量..."
export ANTHROPIC_BASE_URL=http://localhost:3456
export ANTHROPIC_API_KEY=any-string-is-ok

echo "✅ 设置完成！现在可以正常使用Claude Code，所有请求将路由到CodeWhisperer"
echo "💡 要停止服务器，请运行: kill $SERVER_PID"

# 保持脚本运行
wait $SERVER_PID
```

## 使用流程

### 1. 初始设置
```bash
# 安装依赖
npm install -g claude-code-router

# 配置Kiro认证
kiro2cc refresh
```

### 2. 启动路由器
```bash
# 方式1: 使用配置文件
ccr start --config=claude-to-codewhisperer.json

# 方式2: 使用命令行参数
ccr start --provider=codewhisperer --input=anthropic --output=anthropic

# 方式3: 使用一键脚本
./scripts/start-claude-codewhisperer.sh
```

### 3. 使用Claude Code
```bash
# Claude Code正常使用，无需修改
claude-code "帮我写一个React组件"
claude-code "解释这段代码的功能"
claude-code "优化这个算法的性能"
```

## 预期效果

### 透明代理
- Claude Code用户体验完全不变
- 所有模型请求自动重映射到CodeWhisperer
- 支持流式响应和工具调用
- 保持完整的错误处理和重试机制

### 成本优化
- 利用AWS CodeWhisperer的定价优势
- 支持多token负载均衡
- 自动token刷新和管理

### 性能提升
- 基于请求类型的智能路由
- 长上下文请求使用专门模型
- 后台任务使用轻量级模型

这个use case展示了如何通过我们的四层架构，实现Claude Code到CodeWhisperer的完全透明代理，用户只需一键启动即可享受成本和性能的双重优化。