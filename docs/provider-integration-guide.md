# Provider Integration Guide v2.7.0
**Author**: Jason Zhang  
**Version**: 2.7.0  
**Updated**: 2025-08-11  

## 📋 Overview

This guide provides comprehensive instructions for integrating new AI providers into the Claude Code Router v2.7.0 system. The integration follows strict architectural patterns and focuses on **preprocessing-only modifications** to maintain system stability and consistency.

## 🏗️ Architecture Principles

### Core Design Principles
1. **Zero Hardcoding**: All configurations must be externally configurable
2. **Preprocessing Focus**: New providers should only require preprocessing modifications
3. **Interface Standardization**: All providers must implement the `ProviderClient` interface
4. **Official SDK Priority**: Use official SDKs when available, fallback to compatible modes
5. **Backward Compatibility**: New providers must not break existing functionality

### Four-Layer Architecture Integration
```
Input Layer → Routing Layer → Output Layer → Provider Layer
                ↓
        [New Provider Integration]
                ↓
   Preprocessing → SDK Detection → Format Conversion → API Communication
```

## 📋 Integration Workflow

### Step 1: Provider Analysis
Before starting integration, analyze the target provider:

- [ ] **Official SDK Availability**: Check if provider offers official SDK/API client
- [ ] **API Compatibility**: Determine compatibility with OpenAI, Anthropic, or Gemini formats
- [ ] **Authentication Method**: Identify authentication requirements (API key, OAuth, etc.)
- [ ] **Model Support**: Document supported models and capabilities
- [ ] **Streaming Support**: Verify streaming capabilities and format
- [ ] **Tool Calling**: Check tool/function calling support

### Step 2: Directory Structure Creation
Create provider directory following established pattern:
```
src/provider/[provider-name]/
├── index.ts              # Main provider export
├── client.ts             # Primary client implementation
├── auth.ts               # Authentication management
├── converter.ts          # Format conversion utilities
├── parser.ts             # Response parsing logic
├── types.ts              # TypeScript type definitions
└── preprocessor.ts       # Provider-specific preprocessing (NEW)
```

### Step 3: Core Implementation Files

#### 3.1 Provider Types Definition (`types.ts`)
```typescript
/**
 * [Provider Name] Provider Types
 * Author: Jason Zhang
 */

export interface [ProviderName]Config {
  apiKey: string;
  endpoint: string;
  timeout: number;
  retryAttempts: number;
  models: string[];
}

export interface [ProviderName]Request {
  // Provider-specific request format
}

export interface [ProviderName]Response {
  // Provider-specific response format
}

export interface [ProviderName]StreamChunk {
  // Streaming response chunk format
}
```

#### 3.2 Authentication Module (`auth.ts`)
```typescript
/**
 * [Provider Name] Authentication Manager
 * Author: Jason Zhang
 */

import { AuthManager } from '../auth/auth-manager.js';

export class [ProviderName]AuthManager extends AuthManager {
  async authenticate(config: [ProviderName]Config): Promise<boolean> {
    // Implementation using official SDK authentication
    // Fallback to standard HTTP authentication
  }

  async refreshToken(): Promise<void> {
    // Token refresh logic if applicable
  }

  getAuthHeaders(): Record<string, string> {
    // Return authentication headers
  }
}
```

#### 3.3 Format Converter (`converter.ts`)
```typescript
/**
 * [Provider Name] Format Converter
 * Author: Jason Zhang
 */

export class [ProviderName]Converter {
  async toProviderFormat(request: AIRequest): Promise<[ProviderName]Request> {
    // Convert standard AIRequest to provider format
  }

  async fromProviderFormat(response: [ProviderName]Response): Promise<AIResponse> {
    // Convert provider response to standard AIResponse
  }
}
```

#### 3.4 Main Client Implementation (`client.ts`)
```typescript
/**
 * [Provider Name] Client
 * Author: Jason Zhang
 */

import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse } from '../types.js';

export class [ProviderName]Client extends BaseProvider {
  private sdk?: [OfficialSDK]; // If official SDK available
  private converter: [ProviderName]Converter;
  private auth: [ProviderName]AuthManager;

  async initialize(config: [ProviderName]Config): Promise<void> {
    // Try official SDK first, fallback to HTTP client
    try {
      this.sdk = new [OfficialSDK](config);
      console.log(`✅ Using official ${providerName} SDK`);
    } catch (error) {
      console.log(`🔄 Using HTTP client fallback for ${providerName}`);
      this.initializeHttpClient(config);
    }
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    // Use official SDK if available, otherwise HTTP client
    if (this.sdk) {
      return this.processWithSDK(request);
    }
    return this.processWithHttp(request);
  }
}
```

#### 3.5 Provider Index (`index.ts`)
```typescript
/**
 * [Provider Name] Provider
 * Author: Jason Zhang
 */

export { [ProviderName]Client } from './client.js';
export { [ProviderName]AuthManager } from './auth.js';
export { [ProviderName]Converter } from './converter.js';
export * from './types.js';

console.log('🎯 [Provider Name] Provider loaded');
```

### Step 4: Preprocessing Implementation (REQUIRED)

#### 4.1 Provider Preprocessor (`preprocessor.ts`)
```typescript
/**
 * [Provider Name] Preprocessing Logic
 * Author: Jason Zhang
 */

export class [ProviderName]Preprocessor {
  async preprocessRequest(request: AIRequest, config: [ProviderName]Config): Promise<AIRequest> {
    // Provider-specific request preprocessing
    // Handle model name mapping, parameter adjustments, etc.
    
    const processed = { ...request };
    
    // Example: Model name mapping
    if (processed.model === 'claude-3-sonnet') {
      processed.model = '[provider-equivalent-model]';
    }
    
    return processed;
  }

  async preprocessResponse(response: [ProviderName]Response): Promise<AIResponse> {
    // Provider-specific response preprocessing
    // Handle format differences, error mapping, etc.
    return this.converter.fromProviderFormat(response);
  }
}
```

### Step 5: Testing Implementation

#### 5.1 Create Test File (`test/functional/test-[provider-name]-integration.js`)
```javascript
#!/usr/bin/env node

/**
 * [Provider Name] Integration Test
 * Author: Jason Zhang
 */

async function test[ProviderName]Integration() {
  const testResults = {
    testName: '[Provider Name] Integration Test',
    tests: [],
    summary: { passed: 0, failed: 0, total: 0 }
  };

  // Test 1: Provider Initialization
  await runTest(testResults, '[Provider Name] Initialization', async () => {
    const client = new [ProviderName]Client();
    const config = {
      apiKey: 'test-key',
      endpoint: 'https://api.[provider].com',
      timeout: 30000,
      retryAttempts: 3
    };
    
    await client.initialize(config);
    return { message: 'Provider initialized successfully' };
  });

  // Test 2: Request Processing
  await runTest(testResults, 'Request Processing', async () => {
    // Implementation
  });

  // Test 3: Format Conversion
  await runTest(testResults, 'Format Conversion', async () => {
    // Implementation
  });

  // More tests...

  return testResults.summary.failed === 0;
}
```

#### 5.2 Create Test Documentation (`test/functional/test-[provider-name]-integration.md`)
```markdown
# [Provider Name] Integration Test

## 测试用例
验证[Provider Name]提供商的完整集成功能

## 测试目标
1. Provider初始化和配置验证
2. 请求格式转换和处理
3. 响应解析和错误处理
4. 认证管理和token刷新
5. 流式响应处理（如支持）

## 执行记录
- **执行时间**: 待执行
- **执行状态**: 待测试
- **执行时长**: -
- **日志文件**: 待生成
```

## 🔧 Implementation Guidelines

### Mandatory Requirements
1. **Interface Compliance**: Must implement `ProviderClient` interface
2. **Zero Hardcoding**: All configurations externalized
3. **Error Handling**: Explicit error handling, no silent failures
4. **Official SDK Priority**: Use official SDK when available
5. **Preprocessing Focus**: Major customizations in preprocessing layer only

### Architecture Compliance Checklist
- [ ] Implements `BaseProvider` class
- [ ] Uses `ProviderClient` interface
- [ ] Provides comprehensive type definitions
- [ ] Implements authentication management
- [ ] Supports format conversion
- [ ] Includes preprocessing logic
- [ ] Has comprehensive test coverage
- [ ] Follows naming conventions
- [ ] Includes proper documentation

### Code Quality Standards
1. **TypeScript**: All files must be properly typed
2. **Error Handling**: Comprehensive error handling with specific error types
3. **Documentation**: JSDoc comments for all public methods
4. **Testing**: Minimum 80% test coverage
5. **Logging**: Appropriate logging for debugging and monitoring

## 📊 Validation System

### Automated Validation
The system includes automated validation for new providers:

```bash
# Run provider validation
./test-runner.sh --provider [provider-name]

# Validate integration compliance
node test/functional/test-provider-integration-compliance.js --provider [provider-name]
```

### Manual Validation Checklist
- [ ] All required files created with correct structure
- [ ] TypeScript compilation successful
- [ ] Interface compliance verified
- [ ] Authentication working correctly
- [ ] Format conversion bidirectional
- [ ] Error handling comprehensive
- [ ] Test coverage adequate
- [ ] Documentation complete

## 🚨 Common Integration Issues

### Authentication Issues
- **Problem**: API key not accepted
- **Solution**: Check authentication header format, verify key validity
- **Prevention**: Use official SDK authentication when available

### Format Conversion Issues
- **Problem**: Response parsing failures
- **Solution**: Implement robust error handling in converter
- **Prevention**: Test with variety of response formats

### Streaming Issues
- **Problem**: Streaming responses not processed correctly
- **Solution**: Implement proper chunk processing and event handling
- **Prevention**: Test streaming scenarios thoroughly

## 📚 Reference Examples

### Existing Provider Examples
- **Anthropic Provider**: `src/provider/anthropic/` - Official SDK integration
- **OpenAI Provider**: `src/provider/openai/` - Enhanced client with compatibility
- **Gemini Provider**: `src/provider/gemini/` - Google SDK integration
- **CodeWhisperer Provider**: `src/provider/codewhisperer/` - AWS SDK integration

### Template Provider
A complete template provider is available at:
- **Template Location**: `templates/provider-template/`
- **Usage**: Copy template and customize for new provider
- **Testing**: Template includes comprehensive test suite

## 🔄 Integration Testing

### Required Tests
1. **Initialization Test**: Verify provider can be initialized with valid config
2. **Request Processing**: Test request handling and response generation
3. **Authentication**: Verify authentication mechanisms work correctly
4. **Format Conversion**: Test bidirectional format conversion
5. **Error Handling**: Verify proper error handling and reporting
6. **Streaming**: Test streaming capabilities if supported
7. **Model Support**: Verify all supported models work correctly

### Performance Benchmarks
New providers should meet minimum performance requirements:
- **Initialization Time**: < 1 second
- **Request Latency**: < 100ms overhead
- **Memory Usage**: < 50MB additional memory
- **Concurrent Requests**: Support for 10+ concurrent requests

## 📞 Support and Maintenance

### Integration Support
- **Documentation**: Complete integration documentation required
- **Testing**: Comprehensive test suite with >80% coverage
- **Maintenance**: Regular updates for provider API changes
- **Monitoring**: Integration with system monitoring and logging

### Compliance Monitoring
- **Automated Checks**: Daily compliance validation
- **Performance Monitoring**: Continuous performance tracking
- **Error Tracking**: Comprehensive error logging and analysis
- **Update Management**: Systematic update and maintenance process

---

**Guide Version**: v2.7.0  
**Last Updated**: 2025-08-11  
**Status**: Production Ready  
**Maintainer**: Jason Zhang