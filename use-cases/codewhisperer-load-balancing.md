# Use Case 3: CodeWhisperer供应商负载均衡

## 场景描述
在Use Case 2的基础上，对两个CodeWhisperer供应商实现智能负载均衡，确保高可用性、性能优化和资源充分利用。

## 用户需求
- **基础**: Use Case 2的多CodeWhisperer供应商模型分离
- **扩展**: 两个供应商之间的负载均衡
- **策略**: 轮询、权重、健康状态、响应时间等多种负载均衡算法
- **目标**: 高可用性、性能优化、故障自动切换

## 技术实现

### 1. 负载均衡配置
```json
{
  "name": "CodeWhisperer Load Balancing",
  "input": {"format": "anthropic", "defaultInstance": true},
  "routing": {
    "rules": {
      "default": {
        "providers": ["codewhisperer-primary", "codewhisperer-secondary"],
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "loadBalancing": {
          "strategy": "weighted-round-robin",
          "weights": {"codewhisperer-primary": 70, "codewhisperer-secondary": 30}
        }
      },
      "background": {
        "providers": ["codewhisperer-secondary", "codewhisperer-primary"],
        "model": "CLAUDE_3_7_SONNET_20250219_V1_0", 
        "loadBalancing": {
          "strategy": "round-robin",
          "failover": true
        }
      },
      "thinking": {
        "providers": ["codewhisperer-primary", "codewhisperer-secondary"],
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "loadBalancing": {
          "strategy": "least-connections",
          "healthCheck": true
        }
      },
      "longcontext": {
        "providers": ["codewhisperer-primary"],
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "loadBalancing": {
          "strategy": "single",
          "fallback": "codewhisperer-secondary"
        }
      }
    }
  },
  "output": {"format": "anthropic"},
  "providers": {
    "codewhisperer-primary": {
      "type": "aws",
      "name": "Primary CodeWhisperer",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-primary.json",
      "weight": 70,
      "maxConcurrentRequests": 10,
      "healthCheck": {
        "enabled": true,
        "interval": 30000,
        "timeout": 5000,
        "retries": 3
      },
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 5,
        "resetTimeout": 60000
      }
    },
    "codewhisperer-secondary": {
      "type": "aws",
      "name": "Secondary CodeWhisperer", 
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-secondary.json",
      "weight": 30,
      "maxConcurrentRequests": 8,
      "healthCheck": {
        "enabled": true,
        "interval": 30000,
        "timeout": 5000,
        "retries": 3
      },
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,
        "resetTimeout": 45000
      }
    }
  }
}
```

### 2. 负载均衡器实现
```typescript
// providers/codewhisperer/load-balancer.ts
export class CodeWhispererLoadBalancer {
  private providers: Map<string, CodeWhispererProvider>;
  private strategies: Map<string, LoadBalancingStrategy>;
  private healthMonitor: HealthMonitor;
  private circuitBreakers: Map<string, CircuitBreaker>;
  
  constructor(config: LoadBalancingConfig) {
    this.providers = new Map();
    this.strategies = new Map();
    this.circuitBreakers = new Map();
    
    this.initializeProviders(config);
    this.initializeStrategies();
    this.initializeHealthMonitor(config);
    this.initializeCircuitBreakers(config);
  }
  
  async selectProvider(
    request: ProviderRequest,
    availableProviders: string[]
  ): Promise<string> {
    const strategy = this.strategies.get(request.loadBalancing?.strategy || 'round-robin');
    
    // 过滤健康的供应商
    const healthyProviders = await this.filterHealthyProviders(availableProviders);
    
    if (healthyProviders.length === 0) {
      throw new Error('No healthy providers available');
    }
    
    // 应用负载均衡策略
    return await strategy.select(healthyProviders, request);
  }
  
  private async filterHealthyProviders(providers: string[]): Promise<string[]> {
    const healthy: string[] = [];
    
    for (const providerName of providers) {
      const circuitBreaker = this.circuitBreakers.get(providerName);
      const isHealthy = await this.healthMonitor.isHealthy(providerName);
      
      if (isHealthy && circuitBreaker?.isOpen() === false) {
        healthy.push(providerName);
      }
    }
    
    return healthy;
  }
}
```

### 3. 负载均衡策略
```typescript
// providers/codewhisperer/strategies/
export interface LoadBalancingStrategy {
  select(providers: string[], request: ProviderRequest): Promise<string>;
}

// 轮询策略
export class RoundRobinStrategy implements LoadBalancingStrategy {
  private currentIndex = 0;
  
  async select(providers: string[]): Promise<string> {
    const provider = providers[this.currentIndex % providers.length];
    this.currentIndex++;
    return provider;
  }
}

// 加权轮询策略
export class WeightedRoundRobinStrategy implements LoadBalancingStrategy {
  private weights: Map<string, number>;
  private currentWeights: Map<string, number>;
  
  constructor(weights: Record<string, number>) {
    this.weights = new Map(Object.entries(weights));
    this.currentWeights = new Map();
  }
  
  async select(providers: string[]): Promise<string> {
    let selectedProvider = '';
    let maxWeight = -1;
    
    for (const provider of providers) {
      const weight = this.weights.get(provider) || 1;
      const currentWeight = (this.currentWeights.get(provider) || 0) + weight;
      this.currentWeights.set(provider, currentWeight);
      
      if (currentWeight > maxWeight) {
        maxWeight = currentWeight;
        selectedProvider = provider;
      }
    }
    
    // 减少选中供应商的当前权重
    const totalWeight = Array.from(this.weights.values()).reduce((a, b) => a + b, 0);
    this.currentWeights.set(selectedProvider, maxWeight - totalWeight);
    
    return selectedProvider;
  }
}

// 最少连接策略
export class LeastConnectionsStrategy implements LoadBalancingStrategy {
  private connections: Map<string, number> = new Map();
  
  async select(providers: string[]): Promise<string> {
    let selectedProvider = providers[0];
    let minConnections = this.connections.get(selectedProvider) || 0;
    
    for (const provider of providers) {
      const connections = this.connections.get(provider) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedProvider = provider;
      }
    }
    
    return selectedProvider;
  }
  
  incrementConnections(provider: string): void {
    const current = this.connections.get(provider) || 0;
    this.connections.set(provider, current + 1);
  }
  
  decrementConnections(provider: string): void {
    const current = this.connections.get(provider) || 0;
    this.connections.set(provider, Math.max(0, current - 1));
  }
}

// 响应时间策略
export class ResponseTimeStrategy implements LoadBalancingStrategy {
  private responseTimes: Map<string, number> = new Map();
  
  async select(providers: string[]): Promise<string> {
    let selectedProvider = providers[0];
    let minResponseTime = this.responseTimes.get(selectedProvider) || Infinity;
    
    for (const provider of providers) {
      const responseTime = this.responseTimes.get(provider) || Infinity;
      if (responseTime < minResponseTime) {
        minResponseTime = responseTime;
        selectedProvider = provider;
      }
    }
    
    return selectedProvider;
  }
  
  updateResponseTime(provider: string, responseTime: number): void {
    // 使用指数移动平均计算响应时间
    const current = this.responseTimes.get(provider) || responseTime;
    const alpha = 0.3; // 平滑因子
    const newResponseTime = alpha * responseTime + (1 - alpha) * current;
    this.responseTimes.set(provider, newResponseTime);
  }
}
```

### 4. 健康监控
```typescript
// providers/codewhisperer/health-monitor.ts
export class HealthMonitor {
  private healthStatus: Map<string, boolean> = new Map();
  private lastCheckTime: Map<string, number> = new Map();
  private config: HealthCheckConfig;
  
  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.startHealthChecks();
  }
  
  async isHealthy(provider: string): Promise<boolean> {
    return this.healthStatus.get(provider) ?? false;
  }
  
  private startHealthChecks(): void {
    setInterval(async () => {
      for (const [providerName, provider] of this.providers) {
        try {
          const startTime = Date.now();
          await this.performHealthCheck(provider);
          const responseTime = Date.now() - startTime;
          
          this.healthStatus.set(providerName, true);
          this.lastCheckTime.set(providerName, Date.now());
          
          // 更新响应时间统计
          this.updateResponseTimeStats(providerName, responseTime);
          
        } catch (error) {
          this.healthStatus.set(providerName, false);
          console.warn(`Health check failed for ${providerName}:`, error);
        }
      }
    }, this.config.interval);
  }
  
  private async performHealthCheck(provider: CodeWhispererProvider): Promise<void> {
    // 发送简单的健康检查请求
    const healthCheckRequest = {
      model: 'CLAUDE_3_5_HAIKU_20241022_V1_0',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1
    };
    
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout)
    );
    
    await Promise.race([
      provider.processRequest(healthCheckRequest),
      timeout
    ]);
  }
}
```

### 5. 熔断器
```typescript
// providers/codewhisperer/circuit-breaker.ts
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;
  
  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  isOpen(): boolean {
    return this.state === 'OPEN';
  }
}
```

## 配置文件示例

### codewhisperer-load-balancing.json
```json
{
  "name": "CodeWhisperer Load Balancing",
  "description": "CodeWhisperer供应商负载均衡配置",
  "input": {"format": "anthropic", "defaultInstance": true},
  "routing": {
    "strategy": "load-balancing",
    "rules": {
      "default": {
        "providers": ["codewhisperer-primary", "codewhisperer-secondary"],
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "loadBalancing": {
          "strategy": "weighted-round-robin",
          "weights": {"codewhisperer-primary": 70, "codewhisperer-secondary": 30},
          "healthCheck": true,
          "failover": true
        }
      },
      "background": {
        "providers": ["codewhisperer-secondary", "codewhisperer-primary"],
        "model": "CLAUDE_3_7_SONNET_20250219_V1_0",
        "loadBalancing": {
          "strategy": "round-robin",
          "healthCheck": true,
          "failover": true
        }
      },
      "thinking": {
        "providers": ["codewhisperer-primary", "codewhisperer-secondary"],
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "loadBalancing": {
          "strategy": "least-connections",
          "healthCheck": true,
          "failover": true
        }
      },
      "longcontext": {
        "providers": ["codewhisperer-primary"],
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "loadBalancing": {
          "strategy": "single",
          "fallback": "codewhisperer-secondary",
          "healthCheck": true
        }
      },
      "search": {
        "providers": ["codewhisperer-secondary", "codewhisperer-primary"],
        "model": "CLAUDE_3_7_SONNET_20250219_V1_0",
        "loadBalancing": {
          "strategy": "response-time",
          "healthCheck": true,
          "failover": true
        }
      }
    }
  },
  "output": {"format": "anthropic"},
  "providers": {
    "codewhisperer-primary": {
      "type": "aws",
      "name": "Primary CodeWhisperer",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-primary.json",
      "weight": 70,
      "maxConcurrentRequests": 10,
      "healthCheck": {
        "enabled": true,
        "interval": 30000,
        "timeout": 5000,
        "retries": 3,
        "endpoint": "/health"
      },
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 5,
        "resetTimeout": 60000,
        "monitoringPeriod": 10000
      },
      "metrics": {
        "enabled": true,
        "responseTimeWindow": 100
      }
    },
    "codewhisperer-secondary": {
      "type": "aws",
      "name": "Secondary CodeWhisperer",
      "authMethod": "kiro-token", 
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-secondary.json",
      "weight": 30,
      "maxConcurrentRequests": 8,
      "healthCheck": {
        "enabled": true,
        "interval": 30000,
        "timeout": 5000,
        "retries": 3,
        "endpoint": "/health"
      },
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,
        "resetTimeout": 45000,
        "monitoringPeriod": 10000
      },
      "metrics": {
        "enabled": true,
        "responseTimeWindow": 100
      }
    }
  },
  "server": {"port": 3456, "host": "127.0.0.1"},
  "monitoring": {
    "enabled": true,
    "metricsEndpoint": "/metrics",
    "healthEndpoint": "/health",
    "dashboardEnabled": true
  }
}
```

## 启动和监控

### 1. 启动负载均衡路由器
```bash
# 启动负载均衡路由器
ccr start --config=codewhisperer-load-balancing.json

# 启动时显示负载均衡状态
ccr start --config=codewhisperer-load-balancing.json --show-lb-status
```

### 2. 监控端点
```bash
# 检查供应商健康状态
curl http://localhost:3456/health/providers

# 查看负载均衡统计
curl http://localhost:3456/metrics/load-balancing

# 查看熔断器状态
curl http://localhost:3456/metrics/circuit-breakers
```

### 3. 实时监控
```typescript
// 监控仪表板
app.get('/dashboard/load-balancing', (req, res) => {
  res.json({
    providers: {
      'codewhisperer-primary': {
        status: 'healthy',
        connections: 3,
        responseTime: 245,
        circuitBreakerState: 'CLOSED',
        weight: 70,
        requestCount: 1250
      },
      'codewhisperer-secondary': {
        status: 'healthy', 
        connections: 1,
        responseTime: 312,
        circuitBreakerState: 'CLOSED',
        weight: 30,
        requestCount: 485
      }
    },
    strategies: {
      'default': 'weighted-round-robin',
      'background': 'round-robin',
      'thinking': 'least-connections',
      'search': 'response-time'
    }
  });
});
```

## 预期效果

### 高可用性
- **故障自动切换**: 供应商故障时自动切换到健康的供应商
- **熔断保护**: 防止故障供应商影响整体性能
- **健康监控**: 实时监控供应商状态

### 性能优化
- **智能分发**: 根据不同策略优化请求分发
- **响应时间优化**: 优先选择响应时间短的供应商
- **连接数均衡**: 避免单一供应商过载

### 灵活配置
- **多种策略**: 支持轮询、加权、最少连接、响应时间等策略
- **动态调整**: 可以实时调整权重和策略
- **详细监控**: 完整的监控和统计信息

这个Use Case 3展示了如何在多供应商基础上实现智能负载均衡，确保系统的高可用性和最优性能。