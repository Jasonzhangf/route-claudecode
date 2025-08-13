# 📊 数据捕获测试工作流规范 (Data Capture Testing Workflow Rules)

**📋 文件用途**: 定义v3.0架构下的标准数据捕获测试工作流，强制执行端到端测试+数据回放的问题调试流程

**👤 文件所有者**: Jason Zhang  
**📅 创建时间**: 2025-08-13  
**🔄 版本**: v1.0  
**⚡ 执行级别**: P0 - 强制执行（违反将被拒绝）

---

## 🚨 MANDATORY COMPLIANCE - 强制执行声明

⚠️ **绝对强制规则**: 所有v3.0架构的问题调试和功能开发必须严格遵循本工作流，任何跳步或简化都将被立即拒绝执行。

---

## 🎯 标准数据捕获测试工作流 (STD-DATA-CAPTURE-PIPELINE)

### 📊 工作流概述

**四步强制流程**：端到端测试 → 错误链路分析 → 数据回放复现 → 修复验证循环

**适用场景**：
- ✅ v3.0六层架构的所有问题调试
- ✅ 新功能开发的完整验证
- ✅ 生产问题的精确复现
- ✅ 复杂系统集成测试

---

## 🔄 STEP 1: 端到端测试 + 数据捕获 (E2E Testing with Data Capture)

### 📋 执行要求 (MANDATORY REQUIREMENTS)

#### 🚀 启动调试模式
```bash
# 强制命令格式 - 必须使用 --debug 参数
rcc3 start <config-file> --debug

# 示例
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json --debug
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-openai-shuaihong-v3-5508.json --debug
```

#### 📊 数据捕获验证
- **✅ 必须验证**: 数据库目录自动创建 `~/.route-claudecode/database/`
- **✅ 必须确认**: 六层架构数据捕获点全部激活
- **✅ 必须检查**: 实时I/O记录正常工作

#### 🧪 测试执行标准
```bash
# 执行完整的端到端测试用例
rcc3 code --port <port>  # 连接Claude Code客户端
# 或者运行自动化测试脚本
node test/functional/test-claude-code-e2e-interactive.js
```

### ❌ 违规处理 (VIOLATIONS)
- **未使用--debug参数** → 立即停止，要求重新启动
- **数据库目录未创建** → 拒绝继续，要求检查系统配置
- **数据捕获不完整** → 强制重新执行完整流程

---

## 🔍 STEP 2: 错误数据链路分析 (Error Data Chain Analysis)

### 📊 数据分析强制步骤 (MANDATORY ANALYSIS STEPS)

#### 🗂️ 数据目录检查
```bash
# 1. 检查层级I/O数据文件
ls -la ~/.route-claudecode/database/layers/
# 预期：每个请求产生14个JSON文件（7层 × 2操作）

# 2. 检查审计追踪文件
ls -la ~/.route-claudecode/database/audit/
cat ~/.route-claudecode/database/audit/trail-*.json

# 3. 检查性能监控数据
ls -la ~/.route-claudecode/database/performance/
```

#### 🎯 精确错误定位 (PRECISE ERROR LOCATION)

**六层架构错误分析矩阵**:

| 层级 | 文件模式 | 错误特征 | 分析重点 |
|------|----------|----------|----------|
| **Client** | `client-input/output-*.json` | 请求格式、验证失败 | 输入参数、格式转换 |
| **Router** | `router-input/output-*.json` | 路由失败、Provider选择错误 | 模型映射、Provider可用性 |
| **Post-processor** | `post-processor-input/output-*.json` | 响应处理失败 | 格式解析、数据转换 |
| **Transformer** | `transformer-input/output-*.json` | 数据转换错误 | 协议转换、字段映射 |
| **Provider-Protocol** | `provider-protocol-input/output-*.json` | API通信失败 | 网络连接、认证、协议兼容 |
| **Preprocessor** | `preprocessor-input/output-*.json` | 工具调用失败 | 工具解析、执行、结果处理 |
| **Server** | `server-input/output-*.json` | 响应发送失败 | 最终格式化、网络发送 |

#### 📋 必须完成的分析任务 (MANDATORY ANALYSIS TASKS)

- [ ] **确定失败层级**: 明确指出哪一层出现问题
- [ ] **识别错误类型**: 分类为输入错误、处理错误、或输出错误
- [ ] **定位数据中断点**: 确定数据流在哪里中断或损坏
- [ ] **分析错误传播**: 理解错误如何在层间传播
- [ ] **建立错误基线**: 创建可重现的错误条件

### ❌ 违规处理 (VIOLATIONS)
- **未精确定位层级** → 拒绝进入下一步，要求重新分析
- **错误分析不完整** → 要求补充所有必需的分析任务
- **缺失审计追踪** → 强制重新执行数据捕获流程

---

## 🎬 STEP 3: 数据回放复现问题 (Data Replay Problem Reproduction)

### 🚀 回放系统执行 (REPLAY SYSTEM EXECUTION)

#### 📊 标准回放流程
```bash
# 1. 运行完整回放演示
node test-replay-system-demo.js

# 2. 创建特定问题的回放场景
# 使用DebugRecorder和ReplaySystem API

# 3. 验证问题可重现性
# 确保回放结果与原始问题一致
```

#### 🔧 编程式回放验证
```javascript
import { DebugRecorder } from './src/v3/debug/debug-recorder.js';
import { ReplaySystem } from './src/v3/debug/replay-system.js';

// 1. 加载错误数据
const recorder = new DebugRecorder();
const errorData = /* 从分析中获取的错误数据 */;

// 2. 创建回放场景
const scenarioId = recorder.createReplayScenario(
    'error-reproduction-scenario',
    errorData.recordIds
);

// 3. 执行回放验证
const replaySystem = new ReplaySystem();
const results = await replaySystem.startReplay('error-reproduction-scenario', {
    speed: 1.0,  // 实时回放
    mode: 'simulation'
});

// 4. 验证回放结果
assert(results.results.summary.failed > 0, '问题必须在回放中重现');
```

#### 📋 回放验证清单 (REPLAY VALIDATION CHECKLIST)

- [ ] **回放系统启动成功**: ReplaySystem正常初始化
- [ ] **场景创建完整**: 包含所有必要的错误数据记录
- [ ] **问题精确重现**: 回放结果与原始错误完全一致
- [ ] **回放结果可分析**: 生成详细的执行报告
- [ ] **基线建立成功**: 为后续修复验证建立可靠基线

### ❌ 违规处理 (VIOLATIONS)
- **回放系统失败** → 检查依赖和环境配置，要求修复后重试
- **问题无法重现** → 回到STEP 2重新分析数据，可能需要重新捕获
- **回放结果不一致** → 要求重新验证数据完整性

---

## 🔧 STEP 4: 修复验证循环 (Fix Validation Loop)

### 🎯 修复验证流程 (FIX VALIDATION PROCESS)

#### 🔄 循环修复标准
```bash
# 修复循环标准流程
while [ "回放测试成功率" != "100%" ]; do
    # 1. 分析回放失败原因
    # 2. 修复代码逻辑
    # 3. 重新运行回放测试
    # 4. 验证修复效果
done
```

#### 📊 修复验证标准 (FIX VALIDATION STANDARDS)

**🎯 必须达到的目标**:
- ✅ **回放测试成功率**: 100%
- ✅ **错误消除率**: 100%
- ✅ **数据流完整性**: 100%
- ✅ **性能基线保持**: 不超过5%性能损失

#### 🔧 修复验证步骤 (FIX VALIDATION STEPS)

**步骤4.1: 代码修复**
- 基于错误分析修复代码逻辑
- 确保修复不引入新的问题
- 遵循零硬编码和零Fallback原则

**步骤4.2: 回放验证**
```bash
# 运行修复后的回放测试
node test-replay-system-demo.js

# 验证特定修复的回放场景
# 确保修复后的代码通过所有回放测试
```

**步骤4.3: 完整性验证**
```bash
# 运行完整的端到端测试
rcc3 start fixed-config.json --debug
# 验证修复没有破坏其他功能
```

**步骤4.4: 性能验证**
- 检查修复后的性能指标
- 确保响应时间在可接受范围内
- 验证内存使用和资源消耗

#### 📋 修复完成清单 (FIX COMPLETION CHECKLIST)

- [ ] **代码修复完成**: 所有相关代码已修复
- [ ] **回放测试通过**: 100%成功率
- [ ] **端到端测试通过**: 完整功能验证
- [ ] **性能基线满足**: 没有显著性能损失
- [ ] **回归测试通过**: 没有引入新问题
- [ ] **文档更新完成**: 修复记录和文档同步

### ❌ 违规处理 (VIOLATIONS)
- **回放成功率<100%** → 禁止提交，要求继续修复
- **性能损失>5%** → 要求优化修复方案
- **引入新问题** → 要求重新设计修复方案
- **文档缺失** → 要求补充完整的修复文档

---

## 📋 工作流合规验证 (WORKFLOW COMPLIANCE VALIDATION)

### 🔍 强制检查清单 (MANDATORY CHECKLIST)

**在每个步骤完成后，必须通过以下验证**:

#### ✅ STEP 1 验证
- [ ] `--debug`参数已使用
- [ ] 数据库目录已创建
- [ ] 六层数据捕获完整
- [ ] 端到端测试已执行

#### ✅ STEP 2 验证  
- [ ] 错误层级已精确定位
- [ ] 数据流中断点已确认
- [ ] 审计追踪已分析
- [ ] 错误基线已建立

#### ✅ STEP 3 验证
- [ ] 回放系统运行成功
- [ ] 问题精确重现
- [ ] 回放结果可分析
- [ ] 修复基线已建立

#### ✅ STEP 4 验证
- [ ] 回放测试100%通过
- [ ] 端到端测试通过
- [ ] 性能基线满足
- [ ] 文档更新完成

### 🚨 工作流违规等级 (WORKFLOW VIOLATION LEVELS)

#### P0级违规 - 立即拒绝执行
- 跳过任何步骤
- 未使用数据捕获系统
- 错误定位不精确
- 回放验证失败

#### P1级违规 - 要求立即修复
- 数据分析不完整
- 文档更新缺失
- 性能基线不满足
- 回归测试未执行

#### P2级违规 - 警告并要求改进
- 流程执行不标准
- 工具使用不规范
- 命名约定不符合规范

---

## 🛠️ 工具和资源 (TOOLS AND RESOURCES)

### 📊 必需工具清单 (REQUIRED TOOLS)

**数据捕获工具**:
- `rcc3` CLI with `--debug` 参数
- DebugRecorder API
- 数据库存储系统

**数据分析工具**:
- 标准JSON分析工具
- 审计追踪查看器
- 性能监控仪表板

**回放验证工具**:
- ReplaySystem API
- 回放场景管理器
- 回放结果分析器

**测试验证工具**:
- 端到端测试套件
- 单元测试框架
- 性能基准测试

### 📁 关键文件路径 (KEY FILE PATHS)

```
数据捕获相关：
~/.route-claudecode/database/layers/     # I/O数据文件
~/.route-claudecode/database/audit/      # 审计追踪
~/.route-claudecode/database/performance/ # 性能数据
~/.route-claudecode/database/replay/     # 回放场景

测试脚本：
test-replay-system-demo.js              # 回放系统演示
test/functional/test-debug-system-integration.js  # 调试系统集成测试

文档：
docs/DATA-CAPTURE-REPLAY-USAGE-GUIDE.md # 使用指南
```

---

## ⚡ 紧急情况处理 (EMERGENCY PROCEDURES)

### 🆘 数据捕获失败处理

**症状**: 数据库目录未创建或数据文件缺失

**解决方案**:
1. 检查`uuid`包安装: `npm list uuid`
2. 重新安装依赖: `npm install uuid`
3. 验证权限: 确保`~/.route-claudecode/`可写
4. 重新启动调试模式

### 🆘 回放系统失败处理

**症状**: 回放无法启动或执行失败

**解决方案**:
1. 检查数据完整性
2. 验证回放场景配置
3. 清理损坏的数据文件
4. 重新捕获基线数据

### 🆘 性能基线失败处理

**症状**: 修复后性能显著下降

**解决方案**:
1. 回滚到修复前状态
2. 重新设计修复方案
3. 进行性能优化
4. 重新验证基线

---

## 📚 参考资源 (REFERENCES)

### 📖 相关规范文档
- [📄 测试框架规范](testing-system-rules.md)
- [📄 架构设计规则](architecture-rules.md)
- [📄 核心编程规范](programming-rules.md)
- [📄 知识管理规则](memory-system-rules.md)

### 🔗 技术文档
- [📊 数据捕获和回放系统使用指南](../docs/DATA-CAPTURE-REPLAY-USAGE-GUIDE.md)
- [📁 v3.0六层架构设计](../.claude/project-details/)
- [🧪 测试用例集合](../test/functional/)

### 🛠️ 工具文档
- DebugRecorder API参考
- ReplaySystem API参考
- rcc3 CLI命令参考

---

**🚨 重要提醒**: 本工作流为强制执行规范，任何违反都将导致代码审查被拒绝。请确保严格遵循每个步骤的要求。

**📞 技术支持**: 如遇到问题，请检查数据库目录内容并提供相关日志信息进行技术支持。