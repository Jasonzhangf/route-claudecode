# RCC v4.0 编码规则快速参考卡

## 🚨 P0级红线（违反立即拒绝）

### ❌ 绝对禁止
- **硬编码**: 任何URL、端口、API Key、模型名
- **静默失败**: catch块中的空处理或只打印日志
- **Mockup响应**: 任何形式的假数据或模拟响应
- **跨模块处理**: 违反模块职责边界的代码
- **Mock测试**: 任何形式的Mock、Stub、Fake

### ✅ 强制要求
- **真实配置**: 所有参数从配置文件读取
- **错误传播**: 所有错误必须通过ErrorHandler处理并重新抛出
- **真实响应**: 只能返回真实的处理结果
- **标准接口**: 模块间只能通过定义的接口通信
- **真实测试**: 所有测试使用真实流水线

## 📋 开发前检查清单（必须完成）

```bash
# 1. 文档查阅
□ .claude/project-details/modules/[target-module]/README.md
□ .claude/project-details/rcc-v4-specification.md
□ .claude/project-details/modules/README.md

# 2. 架构理解
□ 模块在六层架构中的位置？
□ 模块的单一职责是什么？
□ 输入/输出接口定义？
□ 与其他模块的依赖关系？
□ 错误处理责任边界？

# 3. 环境准备
□ Node.js >= 18.0.0
□ TypeScript 可用
□ 测试配置就绪
```

## 🏗️ 六层架构速览

```
Client ↔ Router ↔ Pipeline ↔ Debug/Config/Types
         │         │
         │         ├── Transformer
         │         ├── Protocol  
         │         ├── Server-Compatibility
         │         └── Server
```

### 模块职责快速对照
- **Client**: CLI命令、HTTP服务器、错误处理
- **Router**: 配置管理、请求路由、流水线管理
- **Pipeline**: 流水线框架、动态管理
- **Transformer**: Anthropic ↔ Protocol 格式转换
- **Protocol**: 协议控制、流式处理
- **Server-Compatibility**: 第三方服务器适配
- **Server**: 与AI服务提供商通信

## 💻 代码模板速查

### 模块基础结构
```typescript
export class ModuleName {
  private readonly moduleName = '[module-name]';
  private readonly errorHandler: ErrorHandler;
  
  constructor(config: ModuleConfig, errorHandler: ErrorHandler) {
    this.errorHandler = errorHandler;
    this.validateConfig(config);
  }
  
  async process(input: ModuleInput): Promise<ModuleOutput> {
    try {
      this.validateInput(input);
      const result = await this.doProcess(input);
      this.validateOutput(result);
      return result;
    } catch (error) {
      const moduleError = this.createError(/* ... */);
      this.errorHandler.handleError(moduleError);
      throw moduleError; // 必须重新抛出
    }
  }
}
```

### 错误处理模板
```typescript
// ✅ 正确的错误处理
try {
  const result = await operation();
  return result;
} catch (error) {
  const rccError: RCCError = {
    id: generateErrorId(),
    type: ErrorType.MODULE_ERROR,
    module: 'module-name',
    message: 'Operation failed',
    details: error,
    timestamp: Date.now(),
    requestId: request.id
  };
  this.errorHandler.handleError(rccError);
  throw rccError; // 必须重新抛出
}
```

### 配置读取模板
```typescript
// ✅ 正确的配置驱动
class ConfigManager {
  getProviderUrl(provider: string): string {
    const config = this.loadProviderConfig(provider);
    if (!config?.baseUrl) {
      throw new ConfigError(`Provider ${provider} baseUrl not configured`);
    }
    return this.replaceEnvVariables(config.baseUrl);
  }
}
```

## 🧪 测试模板速查

### 真实流水线测试
```typescript
describe('ModuleName Real Pipeline Tests', () => {
  let module: ModuleName;
  let realConfig: ConfigManager;
  
  beforeAll(async () => {
    // 使用真实配置，绝不Mock
    realConfig = new ConfigManager('./test-configs/real-test.json');
    module = new ModuleName(await realConfig.getModuleConfig(), new ErrorHandler());
  });
  
  test('should process real input', async () => {
    const realInput = { /* 真实输入数据 */ };
    const result = await module.process(realInput);
    
    // 验证真实输出
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});
```

## 🔧 常用脚本命令

### 开发环境检查
```bash
# 开发前环境检查
./scripts/dev/pre-development-check.sh [module-name]

# 编码规范合规检查
./scripts/dev/coding-compliance-check.sh

# 文档同步检查
./scripts/dev/check-docs-sync.sh
```

### 测试执行
```bash
# 真实流水线测试
npm run test:real-pipeline

# 性能测试
npm run test:performance

# 完整测试套件
npm run test:all:real
```

### 构建和验证
```bash
# 完整构建流程
./scripts/build/complete-build.sh

# 开发完成前检查
./scripts/dev/pre-commit-complete-check.sh
```

## 📁 文件命名规范

### 目录结构
```
src/[module-name]/
├── README.md                    # 必须
├── index.ts                     # 必须
├── [module-name].ts             # 必须
├── types/                       # 必须
│   ├── [module]-types.ts
│   ├── [module]-config.ts
│   └── [module]-errors.ts
└── __tests__/                   # 必须
    └── [module].real.test.ts
```

### 命名约定
- **模块文件**: `kebab-case.ts`
- **类型文件**: `kebab-case-types.ts`
- **测试文件**: `original-name.real.test.ts`
- **配置文件**: `kebab-case-config.ts`

## 🚀 性能和质量要求

### 性能基准
- **响应时间**: < 100ms (不含AI服务响应)
- **内存使用**: < 200MB
- **并发支持**: 必须支持并发请求
- **成功率**: >= 95%

### 代码质量
- **TypeScript**: 严格类型检查，无any类型
- **测试覆盖率**: 行覆盖率 >= 80%
- **ESLint**: 无警告和错误
- **Prettier**: 统一代码格式

## 📚 文档更新要求

### 修改代码后必须更新
- **模块README**: 接口变更时必须更新
- **类型文档**: 新增类型时必须记录
- **版本信息**: 更新@lastUpdated注释
- **依赖关系**: 依赖变更时更新文档

### 自动同步脚本
```bash
# 同步模块文档
./scripts/dev/sync-module-docs.sh [module-name]

# 验证文档同步
./scripts/dev/validate-docs.sh
```

## ⚡ 快速故障排查

### 常见问题检查
1. **硬编码错误**: `grep -r "api\." src/`
2. **静默失败**: `grep -r "catch.*{}" src/`
3. **Mock测试**: `grep -r "mock\|jest\.fn" test/`
4. **跨模块调用**: `grep -r "\.\./\.\." src/`

### 调试工具
```bash
# 启动调试会话
./scripts/debug/debug-session.sh start [session-name]

# 查看实时日志
./scripts/debug/log-viewer.sh tail [module]

# 健康检查
./scripts/debug/health-check.sh
```

## 📞 规则验证

### 完整规则验证
```bash
# 验证规则体系完整性
./.claude/rules/validate-rules.sh

# 检查特定模块合规性
./scripts/dev/check-module-compliance.sh [module-name]
```

---

## 🎯 记住：严格遵循 P0 红线，确保代码质量！

**违反任何P0级规则的代码都将被立即拒绝，没有例外！**