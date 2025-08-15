# 标准API Error Handler系统

## 模块概述

标准API Error Handler系统提供统一的错误处理机制，确保所有模块的错误都遵循标准的API错误格式，实现一致的错误响应和处理。

## 目录结构

```
src/error-handler/
├── README.md                    # Error Handler系统文档
├── index.ts                     # Error Handler系统入口
├── error-handler.ts             # 标准错误处理器
├── error-formatter.ts           # 错误格式化器
├── error-logger.ts              # 错误日志记录器
└── types/
    ├── error-types.ts           # 错误相关类型
    ├── api-error-types.ts       # API错误类型
    └── handler-types.ts         # 处理器相关类型
```

## 核心功能

### 1. 标准错误处理
- **统一错误格式**: 生成标准的API错误响应格式
- **错误分类**: 根据错误类型设置相应的HTTP状态码
- **模块标识**: 在错误响应中包含具体的模块名
- **敏感信息过滤**: 过滤敏感数据，只返回安全的错误信息

### 2. 错误追踪
- **完整错误链**: 保持错误追踪链的完整性
- **上下文信息**: 记录错误发生的完整上下文
- **请求关联**: 将错误与特定请求ID关联

### 3. 错误日志
- **结构化日志**: 使用结构化格式记录错误
- **分级记录**: 根据错误严重程度分级记录
- **持久化存储**: 错误日志持久化存储

## 接口定义

```typescript
export interface ErrorHandler {
  handleError(error: RCCError): APIErrorResponse;
  createError(type: ErrorType, message: string, details?: any, module?: string): RCCError;
  formatError(error: RCCError): APIErrorResponse;
  logError(error: RCCError): void;
}

export interface ErrorFormatter {
  formatAPIError(error: RCCError): APIErrorResponse;
  formatUserError(error: RCCError): string;
  sanitizeErrorDetails(details: any): any;
}

export interface ErrorLogger {
  logError(error: RCCError): void;
  logWarning(message: string, context?: any): void;
  logInfo(message: string, context?: any): void;
}
```

## 错误类型定义

### RCC错误类型
```typescript
enum ErrorType {
  CLIENT_ERROR = 'CLIENT_ERROR',
  ROUTER_ERROR = 'ROUTER_ERROR',
  PIPELINE_ERROR = 'PIPELINE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  QUOTA_EXCEEDED_ERROR = 'QUOTA_EXCEEDED_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

interface RCCError {
  id: string;
  type: ErrorType;
  module: string;
  message: string;
  details: any;
  timestamp: number;
  requestId?: string;
  stack?: string;
  originalError?: any;
}
```

### API错误响应格式
```typescript
interface APIErrorResponse {
  error: {
    type: string;
    message: string;
    module: string;
    details?: any;
    timestamp: number;
    request_id?: string;
    code?: string;
  };
  status: number;
  headers: Record<string, string>;
}
```

## 标准错误处理器实现

```typescript
export class StandardErrorHandler implements ErrorHandler {
  private formatter: ErrorFormatter;
  private logger: ErrorLogger;

  constructor() {
    this.formatter = new ErrorFormatterImpl();
    this.logger = new ErrorLoggerImpl();
  }

  handleError(error: RCCError): APIErrorResponse {
    // 记录错误日志
    this.logError(error);
    
    // 格式化API错误响应
    const apiError = this.formatError(error);
    
    return apiError;
  }

  createError(
    type: ErrorType, 
    message: string, 
    details?: any, 
    module?: string,
    requestId?: string
  ): RCCError {
    return {
      id: this.generateErrorId(),
      type,
      module: module || 'unknown',
      message,
      details: this.sanitizeDetails(details),
      timestamp: Date.now(),
      requestId,
      stack: new Error().stack
    };
  }

  formatError(error: RCCError): APIErrorResponse {
    return this.formatter.formatAPIError(error);
  }

  logError(error: RCCError): void {
    this.logger.logError(error);
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeDetails(details: any): any {
    if (!details) return undefined;
    
    // 移除敏感信息
    const sanitized = { ...details };
    const sensitiveFields = ['apiKey', 'password', 'token', 'secret', 'authorization'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}
```

## 错误格式化器实现

```typescript
export class ErrorFormatterImpl implements ErrorFormatter {
  formatAPIError(error: RCCError): APIErrorResponse {
    const httpStatus = this.getHTTPStatus(error.type);
    const errorCode = this.getErrorCode(error.type);
    
    return {
      error: {
        type: error.type,
        message: error.message,
        module: error.module,
        details: this.sanitizeErrorDetails(error.details),
        timestamp: error.timestamp,
        request_id: error.requestId,
        code: errorCode
      },
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-ID': error.id
      }
    };
  }

  formatUserError(error: RCCError): string {
    const timestamp = new Date(error.timestamp).toLocaleString();
    const module = error.module.toUpperCase();
    
    let formatted = `[${timestamp}] ${module} ERROR: ${error.message}`;
    
    if (error.requestId) {
      formatted += ` (Request: ${error.requestId})`;
    }
    
    // 添加用户友好的解决建议
    const suggestion = this.getUserSuggestion(error.type);
    if (suggestion) {
      formatted += `\n💡 建议: ${suggestion}`;
    }
    
    return formatted;
  }

  sanitizeErrorDetails(details: any): any {
    if (!details) return undefined;
    
    // 深度清理敏感信息
    return this.deepSanitize(details);
  }

  private getHTTPStatus(errorType: ErrorType): number {
    const statusMap = {
      [ErrorType.CLIENT_ERROR]: 400,
      [ErrorType.VALIDATION_ERROR]: 400,
      [ErrorType.AUTHENTICATION_ERROR]: 401,
      [ErrorType.AUTHORIZATION_ERROR]: 403,
      [ErrorType.RATE_LIMIT_ERROR]: 429,
      [ErrorType.QUOTA_EXCEEDED_ERROR]: 429,
      [ErrorType.CONFIG_ERROR]: 500,
      [ErrorType.NETWORK_ERROR]: 502,
      [ErrorType.ROUTER_ERROR]: 500,
      [ErrorType.PIPELINE_ERROR]: 500,
      [ErrorType.INTERNAL_ERROR]: 500
    };
    
    return statusMap[errorType] || 500;
  }

  private getErrorCode(errorType: ErrorType): string {
    const codeMap = {
      [ErrorType.CLIENT_ERROR]: 'CLIENT_ERROR',
      [ErrorType.VALIDATION_ERROR]: 'INVALID_REQUEST',
      [ErrorType.AUTHENTICATION_ERROR]: 'AUTHENTICATION_FAILED',
      [ErrorType.AUTHORIZATION_ERROR]: 'PERMISSION_DENIED',
      [ErrorType.RATE_LIMIT_ERROR]: 'RATE_LIMIT_EXCEEDED',
      [ErrorType.QUOTA_EXCEEDED_ERROR]: 'QUOTA_EXCEEDED',
      [ErrorType.CONFIG_ERROR]: 'CONFIGURATION_ERROR',
      [ErrorType.NETWORK_ERROR]: 'SERVICE_UNAVAILABLE',
      [ErrorType.ROUTER_ERROR]: 'ROUTING_ERROR',
      [ErrorType.PIPELINE_ERROR]: 'PROCESSING_ERROR',
      [ErrorType.INTERNAL_ERROR]: 'INTERNAL_SERVER_ERROR'
    };
    
    return codeMap[errorType] || 'UNKNOWN_ERROR';
  }

  private getUserSuggestion(errorType: ErrorType): string | null {
    const suggestionMap = {
      [ErrorType.CONFIG_ERROR]: '请检查配置文件 ~/.route-claudecode/config/',
      [ErrorType.NETWORK_ERROR]: '请检查网络连接和API密钥',
      [ErrorType.VALIDATION_ERROR]: '请检查请求格式是否正确',
      [ErrorType.AUTHENTICATION_ERROR]: '请检查API密钥是否正确',
      [ErrorType.RATE_LIMIT_ERROR]: '请稍后重试，或检查API配额',
      [ErrorType.QUOTA_EXCEEDED_ERROR]: '请检查API配额限制'
    };
    
    return suggestionMap[errorType] || null;
  }

  private deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      // 检查是否包含敏感信息模式
      if (this.containsSensitivePattern(obj)) {
        return '[REDACTED]';
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.deepSanitize(value);
        }
      }
      return sanitized;
    }
    
    return obj;
  }

  private containsSensitivePattern(str: string): boolean {
    const patterns = [
      /sk-[a-zA-Z0-9]{48}/, // OpenAI API key
      /sk-ant-[a-zA-Z0-9-]{95}/, // Anthropic API key
      /Bearer\s+[a-zA-Z0-9-._~+/]+=*/, // Bearer token
      /[A-Z0-9]{20}/, // AWS access key pattern
    ];
    
    return patterns.some(pattern => pattern.test(str));
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'apikey', 'api_key', 'apiKey',
      'password', 'passwd', 'pwd',
      'token', 'accesstoken', 'access_token',
      'secret', 'secretkey', 'secret_key',
      'authorization', 'auth',
      'clientsecret', 'client_secret',
      'privatekey', 'private_key'
    ];
    
    return sensitiveFields.includes(fieldName.toLowerCase());
  }
}
```

## 错误日志记录器实现

```typescript
export class ErrorLoggerImpl implements ErrorLogger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(os.homedir(), '.route-claudecode', 'logs', 'error.log'),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        }),
        new winston.transports.Console({
          level: 'error',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  logError(error: RCCError): void {
    this.logger.error('RCC Error occurred', {
      errorId: error.id,
      type: error.type,
      module: error.module,
      message: error.message,
      requestId: error.requestId,
      timestamp: error.timestamp,
      details: error.details,
      stack: error.stack
    });
  }

  logWarning(message: string, context?: any): void {
    this.logger.warn(message, context);
  }

  logInfo(message: string, context?: any): void {
    this.logger.info(message, context);
  }
}
```

## 模块集成示例

### 在Transformer模块中使用
```typescript
export class OpenAITransformer implements TransformerModule {
  private errorHandler: ErrorHandler;

  constructor() {
    this.errorHandler = new StandardErrorHandler();
  }

  async transformRequest(anthropicRequest: AnthropicRequest): Promise<OpenAIRequest> {
    try {
      // 验证输入格式
      if (!this.validateAnthropicRequest(anthropicRequest)) {
        const error = this.errorHandler.createError(
          ErrorType.VALIDATION_ERROR,
          'Invalid Anthropic request format',
          { request: anthropicRequest },
          'transformer'
        );
        throw error;
      }

      // 执行转换逻辑
      return this.performTransformation(anthropicRequest);
      
    } catch (error) {
      if (error instanceof RCCError) {
        throw error; // 重新抛出RCC错误
      }
      
      // 包装未知错误
      const rccError = this.errorHandler.createError(
        ErrorType.PIPELINE_ERROR,
        'Request transformation failed',
        { originalError: error.message },
        'transformer'
      );
      throw rccError;
    }
  }
}
```

### 在客户端模块中使用
```typescript
export class ClientModule {
  private errorHandler: ErrorHandler;

  constructor() {
    this.errorHandler = new StandardErrorHandler();
  }

  async handleRequest(request: Request, reply: Reply): Promise<void> {
    try {
      const response = await this.processRequest(request);
      reply.send(response);
      
    } catch (error) {
      const apiError = this.errorHandler.handleError(error);
      
      reply
        .status(apiError.status)
        .headers(apiError.headers)
        .send(apiError.error);
    }
  }
}
```

## 错误监控和告警

### 错误统计
```typescript
class ErrorMetrics {
  private errorCounts: Map<string, number> = new Map();
  private errorRates: Map<string, number[]> = new Map();

  recordError(error: RCCError): void {
    const key = `${error.module}:${error.type}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    
    // 记录错误率
    const now = Date.now();
    const rates = this.errorRates.get(key) || [];
    rates.push(now);
    
    // 保留最近1小时的数据
    const oneHourAgo = now - 60 * 60 * 1000;
    this.errorRates.set(key, rates.filter(time => time > oneHourAgo));
  }

  getErrorRate(module: string, type: ErrorType): number {
    const key = `${module}:${type}`;
    const rates = this.errorRates.get(key) || [];
    return rates.length; // 每小时错误数
  }
}
```

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup错误处理
- ✅ 无重复错误处理代码
- ✅ 无硬编码错误信息
- ✅ 完整的错误格式标准化
- ✅ 敏感信息过滤
- ✅ 完整的错误追踪链
- ✅ 结构化错误日志