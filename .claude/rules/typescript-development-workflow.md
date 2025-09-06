# TypeScript 开发流程强制执行机制

## 🚨 强制执行的开发工作流 (MANDATORY DEVELOPMENT WORKFLOW)

本文档定义了项目开发过程中必须遵循的TypeScript-Only工作流程，所有开发活动必须严格按照此流程执行。

### 📋 标准开发流程 (STANDARD DEVELOPMENT FLOW)

#### Phase 1: 开发环境设置 (Development Environment Setup)

**必需步骤**:
```bash
# 1. 克隆项目并进入目录
git clone <repository-url>
cd route-claudecode/workspace/main-development

# 2. 安装依赖
npm install

# 3. 设置TypeScript-Only保护
bash .claude/rules/scripts/dist-protection.sh

# 4. 验证环境
npm run type-check
```

**环境验证检查清单**:
- [ ] Node.js版本 ≥18.0.0
- [ ] TypeScript编译器可用
- [ ] ESLint TypeScript插件已安装
- [ ] Git hooks已正确设置
- [ ] dist目录保护已激活

#### Phase 2: 需求分析和设计 (Analysis & Design)

**TypeScript设计要求**:
```typescript
// 1. 定义完整的接口
interface ProjectRequirement {
  id: string;
  description: string;
  acceptanceCriteria: string[];
  typeDefinitions: TypeDefinition[];
}

interface TypeDefinition {
  name: string;
  properties: PropertyDefinition[];
  methods?: MethodDefinition[];
}

// 2. 明确错误类型
type DevelopmentError = 
  | 'TYPESCRIPT_COMPILATION_ERROR'
  | 'TYPE_COVERAGE_INSUFFICIENT'
  | 'INTERFACE_MISSING'
  | 'ANY_TYPE_OVERUSE';
```

**设计阶段检查点**:
- [ ] 所有数据结构都有TypeScript接口定义
- [ ] API输入输出类型已明确
- [ ] 错误处理类型已定义
- [ ] 模块导入导出接口已设计

#### Phase 3: 实现开发 (Implementation Development)

**强制执行的编码规范**:

1. **文件创建规范**:
   ```bash
   # ✅ 正确 - 创建TypeScript文件
   touch src/modules/new-feature.ts
   touch src/interfaces/new-feature-types.ts
   
   # ❌ 禁止 - 创建JavaScript文件
   touch src/modules/new-feature.js  # 违规操作
   ```

2. **代码结构要求**:
   ```typescript
   // ✅ 正确示例 - 完整TypeScript模块
   
   // 1. 导入类型定义
   import { RequestConfig, ResponseData } from '@/interfaces/api-types';
   import { Logger } from '@/utils/logger';
   
   // 2. 接口定义
   export interface FeatureConfig {
     endpoint: string;
     timeout: number;
     retries: number;
   }
   
   // 3. 类型别名
   export type FeatureStatus = 'idle' | 'loading' | 'success' | 'error';
   
   // 4. 实现类
   export class FeatureManager {
     private config: FeatureConfig;
     private logger: Logger;
     private status: FeatureStatus = 'idle';
     
     constructor(config: FeatureConfig, logger: Logger) {
       this.config = config;
       this.logger = logger;
     }
     
     async executeFeature<T>(request: RequestConfig): Promise<ResponseData<T>> {
       // 实现逻辑
     }
   }
   ```

3. **类型安全要求**:
   ```typescript
   // ✅ 正确 - 类型安全的实现
   function processApiResponse<T>(response: unknown): T | null {
     // 类型守卫
     if (typeof response === 'object' && response !== null) {
       return response as T;
     }
     return null;
   }
   
   // ❌ 错误 - 使用any逃避类型检查
   function processApiResponse(response: any): any {  // 禁止使用
     return response;
   }
   ```

#### Phase 4: 编译和构建 (Compilation & Build)

**标准编译流程**:

1. **单模块编译**:
   ```bash
   # 编译单个模块到node_modules/@rcc/<module-name>
   ./scripts/compile-module.sh <module-name>
   ```

2. **全量编译**:
   ```bash
   # 编译所有模块并清理临时目录
   ./scripts/compile-all.sh
   ```

3. **全局安装编译**:
   ```bash
   # 使用标准构建和安装脚本
   ./build-and-install.sh
   ```

4. **禁止的编译方式**:
   ```bash
   # ❌ 禁止创建新的编译脚本
   # ❌ 禁止修改现有编译脚本的核心逻辑
   # ❌ 禁止绕过TypeScript编译直接修改dist文件
   # ❌ 禁止手动创建compiled-modules目录内容
   ```

**模块编译工作原理**:

RCC v4.0采用了改进的模块编译系统，确保项目根目录保持干净：

1. **编译阶段**: 模块源码编译到临时目录`compiled-modules/<module-name>`
2. **移动阶段**: 将编译产物移动到最终目录`node_modules/@rcc/<module-name>`
3. **清理阶段**: 删除临时的`compiled-modules`目录，保持项目根目录干净

**编译验证检查**:
```bash
# 自动化验证脚本
bash .claude/rules/scripts/typescript-only-check.sh

# 模块编译验证
bash .claude/rules/scripts/module-compilation-check.sh
```

#### Phase 5: 测试验证 (Testing & Validation)

**TypeScript测试要求**:
```typescript
// 测试文件示例: feature-manager.test.ts
import { FeatureManager, FeatureConfig } from '../feature-manager';
import { Logger } from '@/utils/logger';

describe('FeatureManager', () => {
  let featureManager: FeatureManager;
  let mockLogger: jest.Mocked<Logger>;
  
  beforeEach(() => {
    const config: FeatureConfig = {
      endpoint: 'http://localhost:3000',
      timeout: 5000,
      retries: 3
    };
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    } as jest.Mocked<Logger>;
    
    featureManager = new FeatureManager(config, mockLogger);
  });
  
  it('should initialize with correct config', () => {
    expect(featureManager).toBeDefined();
    // 具体测试逻辑
  });
});
```

**测试执行流程**:
```bash
# 1. 类型检查
npm run type-check

# 2. 单元测试
npm test

# 3. 类型覆盖率检查
npx type-coverage --at-least 95

# 4. 代码质量检查
npm run lint
```

#### Phase 6: 代码审查 (Code Review)

**TypeScript代码审查检查清单**:

**类型定义审查**:
- [ ] 所有公共API都有明确的类型定义
- [ ] 接口设计符合单一职责原则
- [ ] 泛型使用恰当且有意义
- [ ] 没有过度使用any类型

**代码质量审查**:
- [ ] 函数参数和返回值类型明确
- [ ] 错误处理类型安全
- [ ] 异步操作正确使用Promise/async-await类型
- [ ] 模块导入导出符合TypeScript最佳实践

**性能和维护性**:
- [ ] 类型定义不会导致编译性能问题
- [ ] 接口设计便于未来扩展
- [ ] 类型系统帮助提高代码可读性

#### Phase 7: 提交和部署 (Commit & Deploy)

**提交前检查流程**:
```bash
# 1. 执行完整的TypeScript-Only检查
bash .claude/rules/scripts/typescript-only-check.sh

# 2. 确保编译成功
npm run build

# 3. 运行所有测试
npm test

# 4. 检查Git状态
git status

# 5. 提交 (自动触发pre-commit hooks)
git add .
git commit -m "feat: implement new feature with TypeScript"
```

**自动化提交检查**:
- Git pre-commit hook会自动执行TypeScript-Only检查
- 任何违规都会阻止提交
- 必须修复所有问题后才能成功提交

### 🔧 开发工具集成 (Development Tools Integration)

#### VS Code 配置要求

**必需的VS Code设置** (`.vscode/settings.json`):
```json
{
  "typescript.preferences.strictFunctionTypes": true,
  "typescript.preferences.strictNullChecks": true,
  "typescript.preferences.strictPropertyInitialization": true,
  "typescript.preferences.noImplicitReturns": true,
  "files.exclude": {
    "**/*.js": {"when": "$(basename).ts"},
    "dist/": true
  },
  "search.exclude": {
    "dist/": true,
    "**/*.js": true
  },
  "typescript.format.enable": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

**推荐的VS Code扩展**:
- TypeScript Hero
- ESLint
- Prettier
- TypeScript Error Translator

#### 命令行工具集成

**日常开发命令**:
```bash
# 开发模式 (监听文件变化)
npm run dev

# 类型检查 (不生成文件)
npm run type-check

# 构建生产版本
./build.sh

# 全局安装
./install.sh

# 运行检查
bash .claude/rules/scripts/typescript-only-check.sh
```

### 🚨 违规处理和恢复流程 (Violation Handling)

#### 常见违规场景和解决方案

**场景1: 意外修改了JavaScript文件**
```bash
# 问题: 修改了.js文件
# 解决方案:
git checkout -- path/to/file.js  # 撤销修改
# 然后修改对应的.ts源文件
```

**场景2: TypeScript编译失败**
```bash
# 问题: 类型错误导致编译失败
# 解决方案:
npm run type-check  # 查看详细错误
# 根据错误信息修复类型定义
# 重新编译
npm run build
```

**场景3: 类型覆盖率不足**
```bash
# 问题: 类型覆盖率低于95%
# 解决方案:
npx type-coverage --detail  # 查看详细报告
# 为uncovered的代码添加类型定义
# 重新检查覆盖率
```

**场景4: Git提交被阻止**
```bash
# 问题: pre-commit hook检查失败
# 解决方案:
bash .claude/rules/scripts/typescript-only-check.sh  # 手动运行检查
# 根据输出修复所有问题
# 重新提交
git commit
```

### 📊 质量监控和报告 (Quality Monitoring)

#### 自动化质量检查

**每日质量检查脚本**:
```bash
#!/bin/bash
# daily-quality-check.sh

echo "📊 执行每日TypeScript质量检查..."

# 1. 编译检查
npm run build

# 2. 类型覆盖率
COVERAGE=$(npx type-coverage | grep "type coverage is" | awk '{print $4}')
echo "类型覆盖率: $COVERAGE"

# 3. ESLint检查
npm run lint

# 4. 测试覆盖率
npm run test:coverage

# 5. 生成质量报告
echo "质量检查完成: $(date)" >> quality-report.log
```

#### 质量指标监控

**核心质量指标**:
- TypeScript编译成功率: 100%
- 类型覆盖率: ≥95%
- ESLint错误数: 0
- 测试通过率: 100%
- any类型使用次数: ≤5

---

## 📈 持续改进 (Continuous Improvement)

### 定期审查机制

**每周审查项目**:
- [ ] TypeScript配置是否需要更新
- [ ] 新的类型定义是否合理
- [ ] 是否有重复的接口定义需要合并
- [ ] 类型覆盖率趋势分析

**每月优化项目**:
- [ ] 更新TypeScript版本
- [ ] 优化类型定义结构
- [ ] 改进开发工具配置
- [ ] 审查和更新强制执行规则

### 团队培训和知识分享

**TypeScript最佳实践培训**:
- 每月TypeScript技术分享
- 类型设计模式学习
- 错误处理最佳实践
- 性能优化技巧

---

**⚠️ 重要提醒**: 此开发流程为强制执行规范，任何偏离标准流程的行为都可能导致开发工作被拒绝或要求重新执行。严格遵循TypeScript-Only开发流程是项目成功的关键保障。