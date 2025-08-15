# RCC v4.0 编码规则总览

## 规则体系架构

本文档提供RCC v4.0项目的完整编码规则体系，确保代码质量、架构一致性和系统可靠性。

## 规则优先级

### P0 - 项目架构红线（违反立即拒绝）

1. **[零硬编码原则](./programming-rules.md#代码质量强制标准)** - 严禁任何形式的硬编码
2. **[零静默失败原则](./programming-rules.md#代码质量强制标准)** - 严禁静默处理错误
3. **[零Mockup原则](./programming-rules.md#代码质量强制标准)** - 严禁Mockup响应
4. **[严格模块边界](./architecture-rules.md#模块层级架构)** - 严禁跨模块职责处理
5. **[真实流水线测试](./testing-rules.md#测试架构约束)** - 严禁Mock测试

### P1 - 开发流程强制要求

1. **[文档查阅流程](./programming-rules.md#开发前强制检查清单)** - 开发前必须查阅相关文档
2. **[架构理解验证](./programming-rules.md#开发前强制检查清单)** - 必须理解模块在架构中的位置
3. **[文档同步机制](./programming-rules.md#开发后文档同步机制)** - 修改后必须同步更新文档
4. **[错误处理要求](./programming-rules.md#错误处理要求)** - 统一的错误处理架构

### P2 - 代码质量和规范

1. **[TypeScript规范](./programming-rules.md#TypeScript代码规范)** - 类型安全和命名约定
2. **[测试覆盖要求](./testing-rules.md#测试分层架构)** - 真实流水线测试覆盖
3. **[性能监控](./programming-rules.md#性能和监控要求)** - 必须的性能指标监控
4. **[脚本规范](./programming-rules.md#脚本设计规格遵循)** - 开发和调试脚本标准

## 开发工作流

### 阶段1：开发前准备

#### 强制检查清单
```bash
# 1. 文档查阅验证
□ 已查阅 .claude/project-details/modules/[target-module]/README.md
□ 已查阅 .claude/project-details/rcc-v4-specification.md  
□ 已查阅 .claude/project-details/modules/README.md
□ 已理解模块在六层架构中的位置和职责

# 2. 架构理解验证
□ 能明确回答模块的单一职责
□ 能明确定义模块的输入/输出接口
□ 能识别与其他模块的依赖关系
□ 能定义错误处理责任边界
```

#### 环境准备脚本
```bash
#!/bin/bash
# scripts/dev/pre-development-check.sh

echo "🔍 开发前环境检查..."

# 检查必要文档
check_documentation() {
    local module_name="$1"
    local module_doc=".claude/project-details/modules/$module_name/README.md"
    
    if [ ! -f "$module_doc" ]; then
        echo "❌ 缺少模块文档: $module_doc"
        exit 1
    fi
    
    echo "✅ 模块文档检查通过: $module_name"
}

# 检查开发环境
check_development_environment() {
    # Node.js版本检查
    local node_version=$(node -v | cut -d'v' -f2)
    if ! npx semver-compare "$node_version" "18.0.0"; then
        echo "❌ Node.js版本必须 >= 18.0.0 (当前: $node_version)"
        exit 1
    fi
    
    # TypeScript检查
    if ! command -v npx tsc &> /dev/null; then
        echo "❌ TypeScript 未安装"
        exit 1
    fi
    
    echo "✅ 开发环境检查通过"
}

# 使用方法: ./pre-development-check.sh [module-name]
check_documentation "$1"
check_development_environment
```

### 阶段2：编码实现

#### 模块开发模板
```typescript
// src/[module-name]/[module-name].ts
import { ErrorHandler, RCCError, ErrorType } from '../error-handler';
import { ModuleConfig } from './types/[module]-config';

/**
 * [模块名称] 模块
 * 
 * 职责：[明确的单一职责描述]
 * 输入：[明确的输入类型和格式]
 * 输出：[明确的输出类型和格式]
 * 
 * 架构位置：[在六层架构中的位置]
 * 依赖模块：[依赖的其他模块列表]
 * 
 * @version 1.0.0
 * @author [开发者名称]
 * @lastUpdated [最后更新日期]
 */
export class ModuleName {
  private readonly moduleName = '[module-name]';
  private readonly errorHandler: ErrorHandler;
  
  constructor(
    private config: ModuleConfig,
    errorHandler: ErrorHandler
  ) {
    this.errorHandler = errorHandler;
    this.validateConfig(config);
  }
  
  /**
   * 主要处理方法
   */
  async process(input: ModuleInput): Promise<ModuleOutput> {
    const requestId = this.generateRequestId();
    
    try {
      // 1. 输入验证
      this.validateInput(input);
      
      // 2. 核心处理逻辑
      const result = await this.doProcess(input);
      
      // 3. 输出验证
      this.validateOutput(result);
      
      return result;
    } catch (error) {
      // 4. 错误处理（绝不静默失败）
      const moduleError = this.createError(
        ErrorType.MODULE_ERROR,
        'Module processing failed',
        error,
        requestId
      );
      
      this.errorHandler.handleError(moduleError);
      throw moduleError; // 必须重新抛出
    }
  }
  
  /**
   * 输入验证 - 必须实现
   */
  private validateInput(input: any): asserts input is ModuleInput {
    if (!input) {
      throw new Error('Input is required');
    }
    // 具体验证逻辑
  }
  
  /**
   * 输出验证 - 必须实现
   */
  private validateOutput(output: any): asserts output is ModuleOutput {
    if (!output) {
      throw new Error('Output is required');
    }
    // 具体验证逻辑
  }
  
  /**
   * 核心处理逻辑 - 具体实现
   */
  private async doProcess(input: ModuleInput): Promise<ModuleOutput> {
    // 实现具体的模块逻辑
    // 严禁硬编码、静默失败、Mockup响应
    throw new Error('Not implemented');
  }
  
  /**
   * 配置验证
   */
  private validateConfig(config: ModuleConfig): void {
    // 配置验证逻辑
  }
  
  /**
   * 创建模块错误
   */
  private createError(
    type: ErrorType,
    message: string,
    details?: any,
    requestId?: string
  ): RCCError {
    return {
      id: this.generateErrorId(),
      type,
      module: this.moduleName,
      message,
      details,
      timestamp: Date.now(),
      requestId
    };
  }
  
  private generateRequestId(): string {
    return `${this.moduleName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出模块接口
export interface ModuleInput {
  // 输入类型定义
}

export interface ModuleOutput {
  // 输出类型定义
}

// 导出模块配置
export interface ModuleConfig {
  // 配置类型定义
}
```

#### 编码检查脚本
```bash
#!/bin/bash
# scripts/dev/coding-compliance-check.sh

echo "🔍 编码规范合规检查..."

# 1. 硬编码检查
check_hardcoding() {
    echo "📋 检查硬编码违规..."
    
    local hardcode_patterns=(
        "api\.openai\.com"
        "api\.anthropic\.com" 
        "localhost:[0-9]+"
        "sk-[a-zA-Z0-9]+"
        "claude-3"
        "gpt-4"
        "/home/[^/]+"
        "3456"  # 端口硬编码
        "process\.env\.[A-Z_]+\s*\|\|\s*['\"]" # 默认值降级
    )
    
    for pattern in "${hardcode_patterns[@]}"; do
        if find src -name "*.ts" -exec grep -l "$pattern" {} \; 2>/dev/null; then
            echo "❌ 发现硬编码违规: $pattern"
            echo "   违规文件:"
            find src -name "*.ts" -exec grep -l "$pattern" {} \; | sed 's/^/   - /'
            exit 1
        fi
    done
    
    echo "✅ 硬编码检查通过"
}

# 2. 静默失败检查
check_silent_failures() {
    echo "📋 检查静默失败违规..."
    
    local silent_patterns=(
        "catch.*{[^}]*}" # 空catch块
        "catch.*console\.log" # 只打印不处理
        "catch.*return" # catch中直接返回
        "\|\|\s*{}" # 空对象fallback
        "catch.*{.*//.*}" # 注释掉的catch块
    )
    
    for pattern in "${silent_patterns[@]}"; do
        if find src -name "*.ts" -exec grep -l "$pattern" {} \; 2>/dev/null; then
            echo "❌ 发现静默失败违规: $pattern"
            echo "   违规文件:"
            find src -name "*.ts" -exec grep -l "$pattern" {} \; | sed 's/^/   - /'
            exit 1
        fi
    done
    
    echo "✅ 静默失败检查通过"
}

# 3. Mockup响应检查
check_mockup_responses() {
    echo "📋 检查Mockup响应违规..."
    
    local mockup_patterns=(
        "mock.*response"
        "fake.*data"
        "test.*response"
        "placeholder.*"
        "TODO.*response"
        "return.*mock"
    )
    
    for pattern in "${mockup_patterns[@]}"; do
        if find src -name "*.ts" -exec grep -l "$pattern" {} \; 2>/dev/null; then
            echo "⚠️  发现可能的Mockup响应: $pattern"
            echo "   需要人工确认的文件:"
            find src -name "*.ts" -exec grep -l "$pattern" {} \; | sed 's/^/   - /'
        fi
    done
    
    echo "✅ Mockup响应检查完成"
}

# 4. 模块边界检查
check_module_boundaries() {
    echo "📋 检查模块边界违规..."
    
    # 检查是否有跨模块直接导入
    if find src -name "*.ts" -exec grep -l "\.\./\.\./.*/" {} \; 2>/dev/null; then
        echo "❌ 发现跨模块直接导入:"
        find src -name "*.ts" -exec grep -l "\.\./\.\./.*/" {} \; | sed 's/^/   - /'
        echo "   应通过标准接口通信"
        exit 1
    fi
    
    echo "✅ 模块边界检查通过"
}

# 执行所有检查
check_hardcoding
check_silent_failures
check_mockup_responses
check_module_boundaries

echo "🎉 编码规范合规检查完成！"
```

### 阶段3：测试验证

#### 真实流水线测试模板
```typescript
// src/[module-name]/__tests__/[module-name].real.test.ts
import { ModuleName } from '../[module-name]';
import { ConfigManager } from '../../config';
import { ErrorHandler } from '../../error-handler';
import { DebugManager } from '../../debug';

describe('ModuleName Real Pipeline Tests', () => {
  let module: ModuleName;
  let realConfig: ConfigManager;
  let errorHandler: ErrorHandler;
  let debugManager: DebugManager;
  let sessionId: string;
  
  beforeAll(async () => {
    // 使用真实配置 - 绝不使用Mock
    realConfig = new ConfigManager('./test-configs/real-[module].json');
    errorHandler = new ErrorHandler();
    debugManager = new DebugManager();
    
    const moduleConfig = await realConfig.getModuleConfig('[module-name]');
    module = new ModuleName(moduleConfig, errorHandler);
    
    sessionId = `test-[module]-${Date.now()}`;
    await debugManager.startSession(sessionId);
  });
  
  afterAll(async () => {
    await debugManager.stopSession(sessionId);
  });
  
  describe('Real Input Processing', () => {
    test('should process real valid input', async () => {
      // 真实输入数据
      const realInput: ModuleInput = {
        // 真实的输入数据，不使用Mock
      };
      
      // 通过真实流水线处理
      const result = await module.process(realInput);
      
      // 验证真实输出
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      
      // 验证调试数据捕获
      const capturedData = await debugManager.getModuleData(sessionId, '[module-name]');
      expect(capturedData.input).toEqual(realInput);
      expect(capturedData.output).toEqual(result);
      expect(capturedData.processingTime).toBeGreaterThan(0);
    });
    
    test('should handle real error conditions', async () => {
      // 使用真实的错误输入
      const invalidInput = null;
      
      // 期待真实的错误处理
      await expect(module.process(invalidInput as any))
        .rejects.toThrow();
      
      // 验证错误被正确记录
      const errors = await debugManager.getModuleErrors(sessionId, '[module-name]');
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('MODULE_ERROR');
    });
  });
  
  describe('Real Performance Tests', () => {
    test('should meet performance requirements', async () => {
      const inputs = Array.from({ length: 10 }, (_, i) => ({
        // 生成真实测试输入
      }));
      
      const startTime = Date.now();
      
      const results = await Promise.all(
        inputs.map(input => module.process(input))
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // 性能断言
      expect(results).toHaveLength(10);
      expect(totalTime / inputs.length).toBeLessThan(100); // 每个请求<100ms
      
      // 验证内存使用
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(50 * 1024 * 1024); // <50MB
    });
  });
});
```

### 阶段4：文档同步

#### 自动文档同步脚本
```bash
#!/bin/bash
# scripts/dev/sync-module-docs.sh

MODULE_NAME="$1"
if [ -z "$MODULE_NAME" ]; then
    echo "❌ 使用方法: $0 <module-name>"
    exit 1
fi

echo "📝 同步模块文档: $MODULE_NAME"

# 1. 提取模块接口
extract_module_interfaces() {
    local module_file="src/$MODULE_NAME/$MODULE_NAME.ts"
    local doc_file=".claude/project-details/modules/$MODULE_NAME/README.md"
    
    if [ ! -f "$module_file" ]; then
        echo "❌ 模块文件不存在: $module_file"
        exit 1
    fi
    
    echo "🔍 提取接口定义..."
    
    # 创建临时接口文件
    cat > temp_interfaces.md << EOF
## 接口定义

\`\`\`typescript
EOF
    
    # 提取导出的接口、类型和类
    grep -A 20 "export\s\+\(interface\|type\|class\|enum\)" "$module_file" >> temp_interfaces.md
    
    echo '```' >> temp_interfaces.md
    echo "" >> temp_interfaces.md
    
    # 更新文档
    if [ -f "$doc_file" ]; then
        # 备份原文档
        cp "$doc_file" "$doc_file.backup"
        
        # 替换接口部分
        sed -i '/## 接口定义/,/```$/d' "$doc_file"
        cat temp_interfaces.md >> "$doc_file"
    else
        echo "❌ 模块文档不存在: $doc_file"
        exit 1
    fi
    
    rm temp_interfaces.md
    echo "✅ 接口定义已更新"
}

# 2. 更新版本信息
update_version_info() {
    local module_file="src/$MODULE_NAME/$MODULE_NAME.ts"
    local current_date=$(date '+%Y-%m-%d')
    
    # 在模块文件中更新版本信息
    sed -i "s/@lastUpdated.*/@lastUpdated $current_date/" "$module_file"
    
    echo "✅ 版本信息已更新: $current_date"
}

# 3. 验证文档完整性
validate_documentation() {
    local doc_file=".claude/project-details/modules/$MODULE_NAME/README.md"
    
    local required_sections=(
        "## 模块概述"
        "## 目录结构" 
        "## 核心组件设计"
        "## 接口定义"
        "## 错误处理策略"
        "## 测试策略"
    )
    
    for section in "${required_sections[@]}"; do
        if ! grep -q "$section" "$doc_file"; then
            echo "⚠️  缺少必要章节: $section"
        fi
    done
    
    echo "✅ 文档完整性验证完成"
}

# 执行文档同步
extract_module_interfaces
update_version_info
validate_documentation

echo "🎉 模块文档同步完成: $MODULE_NAME"
```

### 阶段5：构建和部署

#### 完整构建流程
```bash
#!/bin/bash
# scripts/build/complete-build.sh

set -e

echo "🔨 开始完整构建流程..."

# 1. 环境检查
echo "📋 环境检查..."
source scripts/dev/pre-development-check.sh

# 2. 代码规范检查
echo "🔍 代码规范检查..."
source scripts/dev/coding-compliance-check.sh

# 3. TypeScript编译
echo "⚙️ TypeScript编译..."
npx tsc --noEmit # 类型检查
npx tsc # 编译

# 4. 代码质量检查
echo "🧹 代码质量检查..."
npx eslint src --ext .ts
npx prettier --check src

# 5. 真实流水线测试
echo "🧪 真实流水线测试..."
npm run test:real-pipeline

# 6. 性能验证
echo "⚡ 性能验证..."
npm run test:performance

# 7. 文档验证
echo "📚 文档验证..."
scripts/dev/validate-docs.sh

# 8. 构建验证
echo "✅ 构建验证..."
verify_build_output() {
    local required_modules=("client" "router" "pipeline" "debug" "config" "error-handler" "types")
    
    for module in "${required_modules[@]}"; do
        if [ ! -f "dist/$module/index.js" ]; then
            echo "❌ 模块构建失败: $module"
            exit 1
        fi
        
        # 检查模块导出
        if ! grep -q "exports\." "dist/$module/index.js"; then
            echo "❌ 模块导出检查失败: $module"
            exit 1
        fi
    done
    
    echo "✅ 所有模块构建验证通过"
}

verify_build_output

# 9. 安全检查
echo "🔒 安全检查..."
npm audit --audit-level moderate

# 10. 生成构建报告
echo "📊 生成构建报告..."
generate_build_report() {
    local report_file="./build-reports/build-$(date +%Y%m%d-%H%M%S).json"
    mkdir -p ./build-reports
    
    cat > "$report_file" << EOF
{
  "buildTime": "$(date -Iseconds)",
  "nodeVersion": "$(node -v)",
  "typescriptVersion": "$(npx tsc -v)",
  "testResults": {
    "realPipelineTests": $(npm run test:real-pipeline --silent | grep -o "passing\|failing" | wc -l),
    "performanceTests": "passed",
    "coveragePercentage": $(npm run test:coverage --silent | grep -o "[0-9]\+\.[0-9]\+%" | head -1)
  },
  "buildSize": {
    "totalSize": "$(du -sh dist | cut -f1)",
    "moduleCount": $(find dist -name "index.js" | wc -l)
  },
  "qualityChecks": {
    "hardcodingViolations": 0,
    "silentFailures": 0,
    "mockupResponses": 0,
    "moduleBoundaryViolations": 0
  }
}
EOF
    
    echo "✅ 构建报告已生成: $report_file"
}

generate_build_report

echo "🎉 完整构建流程完成！"
echo "📊 构建统计:"
echo "  - 模块数量: $(find dist -name "index.js" | wc -l)"
echo "  - 构建大小: $(du -sh dist | cut -f1)"
echo "  - 构建时间: $(date)"
```

## 质量保证检查清单

### 开发完成检查清单

在提交代码前，必须通过以下完整检查：

#### 架构合规检查
- [ ] **零硬编码**: 无任何硬编码URL、端口、密钥、模型名
- [ ] **零静默失败**: 所有错误都通过ErrorHandler处理并重新抛出
- [ ] **零Mockup响应**: 无任何模拟或假响应
- [ ] **模块边界**: 严格遵循模块职责，无跨模块处理
- [ ] **接口标准**: 通过标准接口与其他模块通信

#### 文档同步检查
- [ ] **模块文档**: 已更新对应的模块README文档
- [ ] **接口文档**: 所有导出接口都有完整文档
- [ ] **版本信息**: 更新了模块版本和最后修改时间
- [ ] **依赖关系**: 文档中准确反映了模块依赖关系

#### 测试验证检查
- [ ] **真实流水线测试**: 编写并通过真实流水线测试
- [ ] **错误处理测试**: 验证真实错误条件下的处理
- [ ] **性能测试**: 满足响应时间和内存使用要求
- [ ] **集成测试**: 与其他模块的协作测试通过

#### 代码质量检查
- [ ] **TypeScript**: 无类型错误，通过严格类型检查
- [ ] **ESLint**: 无代码规范违规
- [ ] **Prettier**: 代码格式化一致
- [ ] **测试覆盖率**: 达到最低覆盖率要求

#### 构建验证检查
- [ ] **编译成功**: TypeScript编译无错误
- [ ] **模块导出**: 所有必要接口正确导出
- [ ] **依赖完整**: 无缺失的依赖项
- [ ] **构建大小**: 构建产物大小合理

### 自动化检查脚本

```bash
#!/bin/bash
# scripts/dev/pre-commit-complete-check.sh

echo "🔍 开发完成前完整检查..."

# 运行所有检查
echo "1️⃣ 架构合规检查..."
source scripts/dev/coding-compliance-check.sh

echo "2️⃣ 文档同步检查..."
source scripts/dev/check-docs-sync.sh

echo "3️⃣ 测试验证检查..."
npm run test:all:real

echo "4️⃣ 代码质量检查..."
npm run lint:check
npm run type:check
npm run format:check

echo "5️⃣ 构建验证检查..."
source scripts/build/complete-build.sh

echo "🎉 所有检查通过，可以提交代码！"
```

## 总结

这套完整的编码规则体系确保了：

1. **架构一致性**: 严格的模块化架构约束和职责边界
2. **代码质量**: 零硬编码、零静默失败、零Mockup的代码标准
3. **真实验证**: 基于真实流水线的测试架构
4. **文档同步**: 强制的文档更新和同步机制
5. **自动化保障**: 完整的自动化检查和构建流程
6. **质量门禁**: 多层次的质量检查和验证

**所有开发人员必须严格遵循这些规则，任何违反P0级规则的代码都将被立即拒绝。通过这套规则体系，我们确保RCC v4.0项目的高质量、高可靠性和高可维护性。**