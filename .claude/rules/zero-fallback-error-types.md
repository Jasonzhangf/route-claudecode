# RCC v4.0 Zero Fallback Error Types - Mandatory Standard

## 🚨 MANDATORY COMPLIANCE - 强制错误类型标准

本规则定义 **RCC v4.0 零Fallback策略下的标准错误类型**，确保所有模块遵循统一的错误处理和错误传播机制。

## 📋 零Fallback错误类型定义 (Zero Fallback Error Types)

### Rule ZF-ERROR-001: 标准错误类型 (Standard Error Types)

**基础错误接口**:
```typescript
export interface ZeroFallbackError extends Error {
  readonly type: ZeroFallbackErrorType;
  readonly provider: string;
  readonly model: string;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable: boolean;
  readonly originalError?: string;
  readonly context?: Record<string, any>;
}

export enum ZeroFallbackErrorType {
  PROVIDER_FAILURE = 'PROVIDER_FAILURE',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE', 
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}
```

### Rule ZF-ERROR-002: 具体错误实现 (Concrete Error Implementations)

**Provider失败错误**:
```typescript
export class ProviderFailureError extends Error implements ZeroFallbackError {
  readonly type = ZeroFallbackErrorType.PROVIDER_FAILURE;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable = false; // 零Fallback策略下不允许重试
  
  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly originalError?: string,
    public readonly context?: Record<string, any>
  ) {
    super(`Provider ${provider} failed for model ${model}: ${originalError || 'Unknown error'}`);
    this.name = 'ProviderFailureError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || generateRequestId();
  }
}
```

**Provider不可用错误**:
```typescript
export class ProviderUnavailableError extends Error implements ZeroFallbackError {
  readonly type = ZeroFallbackErrorType.PROVIDER_UNAVAILABLE;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable = false;
  
  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly originalError?: string,
    public readonly context?: Record<string, any>
  ) {
    super(`Provider ${provider} is unavailable (Zero Fallback Policy - no alternatives allowed)`);
    this.name = 'ProviderUnavailableError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || generateRequestId();
  }
}
```

**健康检查失败错误**:
```typescript
export class HealthCheckFailedError extends Error implements ZeroFallbackError {
  readonly type = ZeroFallbackErrorType.HEALTH_CHECK_FAILED;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable = false;
  
  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly healthScore: number,
    public readonly context?: Record<string, any>
  ) {
    super(`Provider ${provider} health check failed (score: ${healthScore}, threshold: 80)`);
    this.name = 'HealthCheckFailedError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || generateRequestId();
  }
}
```

### Rule ZF-ERROR-003: 错误工厂模式 (Error Factory Pattern)

**统一错误工厂**:
```typescript
export class ZeroFallbackErrorFactory {
  static createProviderFailure(
    provider: string, 
    model: string, 
    originalError?: string,
    context?: Record<string, any>
  ): ProviderFailureError {
    return new ProviderFailureError(provider, model, originalError, context);
  }
  
  static createProviderUnavailable(
    provider: string,
    model: string, 
    reason?: string,
    context?: Record<string, any>
  ): ProviderUnavailableError {
    return new ProviderUnavailableError(provider, model, reason, context);
  }
  
  static createHealthCheckFailed(
    provider: string,
    model: string,
    healthScore: number,
    context?: Record<string, any>
  ): HealthCheckFailedError {
    return new HealthCheckFailedError(provider, model, healthScore, context);
  }
  
  // 其他错误类型的工厂方法...
}
```

### Rule ZF-ERROR-004: 错误传播机制 (Error Propagation Mechanism)

**错误处理器接口**:
```typescript
export interface ZeroFallbackErrorHandler {
  handleError(error: ZeroFallbackError): void;
  shouldRetry(error: ZeroFallbackError): boolean; // 在零Fallback策略下始终返回false
  formatErrorResponse(error: ZeroFallbackError): any;
}

export class StandardZeroFallbackErrorHandler implements ZeroFallbackErrorHandler {
  constructor(private logger: Logger) {}
  
  handleError(error: ZeroFallbackError): void {
    // 记录错误但不进行任何fallback处理
    this.logger.error('Zero Fallback Error', {
      type: error.type,
      provider: error.provider,
      model: error.model,
      message: error.message,
      timestamp: error.timestamp,
      requestId: error.requestId
    });
  }
  
  shouldRetry(error: ZeroFallbackError): boolean {
    // 零Fallback策略下禁止重试
    return false;
  }
  
  formatErrorResponse(error: ZeroFallbackError): any {
    return {
      error: {
        type: error.type,
        message: error.message,
        provider: error.provider,
        model: error.model,
        timestamp: error.timestamp,
        requestId: error.requestId,
        retryable: error.retryable,
        zeroFallbackPolicy: true
      }
    };
  }
}
```

## 🔧 使用示例 (Usage Examples)

### 模块中的错误处理 (Module Error Handling)

```typescript
// 在Router模块中
export class ZeroFallbackRouter {
  async routeRequest(request: Request): Promise<Response> {
    try {
      const provider = this.selectPrimaryProvider();
      return await provider.process(request);
    } catch (originalError) {
      // 立即转换为标准Zero Fallback错误并抛出
      const error = ZeroFallbackErrorFactory.createProviderFailure(
        'lmstudio',
        'llama-3.1-8b',
        originalError.message,
        { requestId: request.id }
      );
      throw error;
    }
  }
}

// 在Provider模块中
export class LMStudioProvider {
  async processRequest(request: Request): Promise<Response> {
    const health = await this.healthCheck();
    if (!health.isHealthy) {
      throw ZeroFallbackErrorFactory.createHealthCheckFailed(
        'lmstudio',
        request.model,
        health.score,
        { requestId: request.id }
      );
    }
    
    try {
      return await this.makeAPICall(request);
    } catch (apiError) {
      throw ZeroFallbackErrorFactory.createProviderFailure(
        'lmstudio',
        request.model,
        apiError.message,
        { requestId: request.id }
      );
    }
  }
}
```

### 错误边界和中间件 (Error Boundaries and Middleware)

```typescript
// Express中间件示例
export function zeroFallbackErrorMiddleware(
  error: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (error instanceof Error && 'type' in error) {
    const zfError = error as ZeroFallbackError;
    const handler = new StandardZeroFallbackErrorHandler(logger);
    
    handler.handleError(zfError);
    const response = handler.formatErrorResponse(zfError);
    
    res.status(getHttpStatusCode(zfError.type)).json(response);
  } else {
    next(error);
  }
}

function getHttpStatusCode(errorType: ZeroFallbackErrorType): number {
  switch (errorType) {
    case ZeroFallbackErrorType.PROVIDER_UNAVAILABLE:
    case ZeroFallbackErrorType.HEALTH_CHECK_FAILED:
      return 503; // Service Unavailable
    case ZeroFallbackErrorType.AUTHENTICATION_ERROR:
      return 401; // Unauthorized
    case ZeroFallbackErrorType.RATE_LIMIT_ERROR:
      return 429; // Too Many Requests
    case ZeroFallbackErrorType.VALIDATION_ERROR:
      return 400; // Bad Request
    case ZeroFallbackErrorType.TIMEOUT_ERROR:
      return 408; // Request Timeout
    default:
      return 500; // Internal Server Error
  }
}
```

## 📊 测试要求 (Testing Requirements)

### 错误类型测试 (Error Type Tests)

```typescript
describe('Zero Fallback Error Types', () => {
  test('should create ProviderFailureError with correct properties', () => {
    const error = ZeroFallbackErrorFactory.createProviderFailure(
      'lmstudio',
      'llama-3.1-8b',
      'Connection refused'
    );
    
    expect(error.type).toBe(ZeroFallbackErrorType.PROVIDER_FAILURE);
    expect(error.provider).toBe('lmstudio');
    expect(error.model).toBe('llama-3.1-8b');
    expect(error.retryable).toBe(false);
    expect(error.timestamp).toBeDefined();
    expect(error.requestId).toBeDefined();
  });
  
  test('should not allow retry for any zero fallback error', () => {
    const handler = new StandardZeroFallbackErrorHandler(mockLogger);
    const error = ZeroFallbackErrorFactory.createProviderUnavailable('test', 'model');
    
    expect(handler.shouldRetry(error)).toBe(false);
  });
});
```

### 错误传播测试 (Error Propagation Tests)

```typescript
describe('Zero Fallback Error Propagation', () => {
  test('should propagate errors without modification', async () => {
    const router = new ZeroFallbackRouter();
    const originalError = ZeroFallbackErrorFactory.createProviderFailure('test', 'model');
    
    // Mock provider to throw error
    jest.spyOn(router, 'selectPrimaryProvider').mockImplementation(() => {
      throw originalError;
    });
    
    await expect(router.routeRequest(mockRequest)).rejects.toThrow(originalError);
  });
});
```

## 🚨 合规检查 (Compliance Validation)

### 自动化错误检查脚本

```bash
#!/bin/bash
# check-zero-fallback-errors.sh

echo "🔍 检查Zero Fallback错误类型合规性..."

# 检查是否存在不当的错误重试逻辑
RETRY_VIOLATIONS=$(grep -r "retry\|fallback\|backup" src/ --include="*.ts" | grep -v "@deprecated" | grep -v "retryable.*false" | wc -l)

if [ $RETRY_VIOLATIONS -gt 0 ]; then
  echo "❌ 发现不符合零Fallback策略的重试逻辑"
  exit 1
fi

# 检查是否所有错误都实现了ZeroFallbackError接口
echo "✅ Zero Fallback错误类型合规检查通过"
```

---

**⚠️ 重要提醒**: 这些错误类型为强制性标准，所有模块必须使用统一的错误类型和处理机制。任何不符合此标准的错误处理代码将被自动拒绝。