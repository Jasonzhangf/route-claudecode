# RCC v4.0 Zero Fallback Policy - Mandatory Rule

## 🚨 MANDATORY COMPLIANCE - 强制执行规则

本规则为 **RCC v4.0 项目的强制性架构约束**，禁止任何形式的fallback机制实现，确保系统行为的一致性和可预测性。

## 📋 零Fallback策略规则 (Zero Fallback Policy Rules)

### Rule ZF-001: 禁止Fallback实现 (Prohibition of Fallback Implementation)

**规则内容**:
- **PROHIBITED**: 禁止实现任何形式的Provider fallback、降级或备用路由逻辑
- **PROHIBITED**: 禁止实现 `CrossProviderFallbackStrategy` 类型的fallback策略
- **PROHIBITED**: 禁止实现 `ConditionalFallbackResolver` 类型的条件fallback解析器
- **PROHIBITED**: 禁止在路由逻辑中添加backup、secondary、emergency等备用路径

**强制要求**:
- 所有配置文件必须设置 `zeroFallbackPolicy: true`
- 失败时必须立即返回错误，不得进行任何降级尝试
- 错误信息必须清晰说明失败原因，不得掩盖真实错误

**违规检测**:
```bash
# 自动检测违规代码
grep -r "fallback\|backup\|secondary\|emergency" src/ --include="*.ts"
grep -r "CrossProviderFallback\|ConditionalFallback" src/ --include="*.ts"
```

### Rule ZF-002: 错误处理标准 (Error Handling Standards)

**规则内容**:
- **REQUIRED**: 所有Provider失败必须立即抛出明确的错误
- **REQUIRED**: 错误必须包含Provider信息、失败原因、时间戳
- **REQUIRED**: 实现统一的错误类型系统，便于客户端处理
- **PROHIBITED**: 禁止静默失败或返回通用成功响应

**标准错误格式**:
```typescript
interface ZeroFallbackError {
  type: 'PROVIDER_FAILURE' | 'CONFIGURATION_ERROR' | 'NETWORK_ERROR';
  provider: string;
  model: string;
  timestamp: string;
  originalError: string;
  requestId: string;
  retryable: boolean;
}
```

### Rule ZF-003: 配置约束 (Configuration Constraints)

**规则内容**:
- **REQUIRED**: 所有路由配置文件必须明确设置 `zeroFallbackPolicy: true`
- **PROHIBITED**: 禁止在配置中定义fallback、backup、secondary等路由路径
- **PROHIBITED**: 禁止在运行时动态切换fallback策略
- **REQUIRED**: 配置验证器必须强制检查并拒绝包含fallback配置的文件

**配置示例**:
```json
{
  "routing": {
    "zeroFallbackPolicy": true,
    "primary": {
      "provider": "lmstudio",
      "model": "llama-3.1-8b"
    }
    // NO fallback, backup, secondary configurations allowed
  }
}
```

### Rule ZF-004: 模块边界约束 (Module Boundary Constraints)

**规则内容**:
- **PROHIBITED**: 禁止跨模块fallback逻辑
- **PROHIBITED**: 禁止模块间的错误恢复机制
- **REQUIRED**: 每个模块失败时必须向上层抛出错误
- **REQUIRED**: 模块接口必须明确定义失败行为

**模块失败处理**:
```typescript
// CORRECT: 立即抛出错误
async function processRequest(request: Request): Promise<Response> {
  try {
    return await provider.process(request);
  } catch (error) {
    throw new ZeroFallbackError({
      type: 'PROVIDER_FAILURE',
      provider: 'lmstudio',
      originalError: error.message,
      retryable: false
    });
  }
}

// INCORRECT: 尝试fallback (违规)
async function processRequestWithFallback(request: Request): Promise<Response> {
  try {
    return await primaryProvider.process(request);
  } catch (error) {
    // ❌ VIOLATION: This fallback logic is prohibited
    return await backupProvider.process(request);
  }
}
```

## 🔧 实施指南 (Implementation Guidelines)

### 开发流程检查 (Development Workflow Checks)

1. **代码提交前检查** (Pre-commit Checks):
   ```bash
   # 检查fallback相关代码
   npm run check-zero-fallback
   # 运行配置验证
   npm run validate-config
   # 确保所有测试通过
   npm test
   ```

2. **代码审查要点** (Code Review Points):
   - 检查是否存在fallback逻辑
   - 验证错误处理是否符合零fallback标准
   - 确认配置文件遵循零fallback策略
   - 检查模块边界是否清晰

3. **集成测试要求** (Integration Test Requirements):
   - 测试Provider失败时的错误抛出行为
   - 验证配置验证器拒绝fallback配置
   - 确认系统在失败时不进行任何重试或降级

### 遗留代码处理 (Legacy Code Handling)

**立即废弃的类和文件**:
- `src/modules/providers/cross-provider-fallback-strategy.ts` - 标记为 @deprecated
- `src/modules/providers/conditional-fallback-resolver.ts` - 标记为 @deprecated  
- `src/modules/providers/adaptive-fallback-manager.ts` - 检查并可能废弃
- `src/modules/providers/fallback-integration.ts` - 标记为 @deprecated

**重构要求**:
- 移除所有路由器中的fallback路径
- 简化配置验证逻辑
- 更新错误处理机制

## 📊 合规验证 (Compliance Validation)

### 自动化检查脚本 (Automated Check Script)

```bash
#!/bin/bash
# zero-fallback-compliance-check.sh

echo "🔍 检查Zero Fallback Policy合规性..."

# 检查源代码中的违规模式
VIOLATIONS=$(grep -r "fallback\|backup\|secondary\|emergency" src/ --include="*.ts" | grep -v "@deprecated" | wc -l)

if [ $VIOLATIONS -gt 0 ]; then
  echo "❌ 发现 $VIOLATIONS 个潜在的fallback违规项"
  grep -r "fallback\|backup\|secondary\|emergency" src/ --include="*.ts" | grep -v "@deprecated"
  exit 1
fi

# 检查配置文件
CONFIG_VIOLATIONS=$(find config/ -name "*.json" -exec grep -l "fallback\|backup\|secondary" {} \; | wc -l)

if [ $CONFIG_VIOLATIONS -gt 0 ]; then
  echo "❌ 发现配置文件中存在fallback配置"
  find config/ -name "*.json" -exec grep -l "fallback\|backup\|secondary" {} \;
  exit 1
fi

echo "✅ Zero Fallback Policy合规检查通过"
```

### 测试验证要求 (Test Validation Requirements)

```typescript
// 必须包含的测试用例
describe('Zero Fallback Policy Compliance', () => {
  test('should throw error when provider fails', async () => {
    // 验证Provider失败时立即抛出错误
    await expect(router.process(request)).rejects.toThrow(ZeroFallbackError);
  });

  test('should reject configuration with fallback settings', () => {
    // 验证配置验证器拒绝fallback配置
    const invalidConfig = { routing: { fallback: { ... } } };
    expect(() => validateConfig(invalidConfig)).toThrow('Fallback configuration not allowed');
  });

  test('should not retry failed requests', async () => {
    // 验证不进行重试
    const mockProvider = jest.fn().mockRejectedValue(new Error('Provider failed'));
    await expect(router.process(request)).rejects.toThrow();
    expect(mockProvider).toHaveBeenCalledTimes(1); // 只调用一次，不重试
  });
});
```

## 🚨 违规后果 (Violation Consequences)

**自动拒绝条件**:
- 代码中存在任何形式的fallback逻辑
- 配置文件包含fallback相关设置
- 模块间存在错误恢复机制
- 测试未覆盖零fallback策略验证

**补救措施**:
1. 立即移除违规代码
2. 更新错误处理机制
3. 修正配置文件
4. 添加合规测试用例
5. 更新相关文档

## 📝 项目记忆更新 (Project Memory Update)

**重要决策记录**:
- 决策时间: 2025-08-16
- 决策内容: 实施严格的零fallback策略，消除架构冲突
- 影响范围: 所有Provider路由、配置验证、错误处理模块
- 预期效果: 提高系统一致性和可预测性，简化架构复杂度

**后续监控**:
- 定期运行合规检查脚本
- 在CI/CD中集成零fallback策略验证
- 更新开发者培训材料
- 建立违规报告机制

---

**⚠️ 重要提醒**: 本规则为强制性架构约束，所有开发者必须严格遵守。任何违反零fallback策略的代码将被自动拒绝。此规则优先级高于任何其他开发指导原则。