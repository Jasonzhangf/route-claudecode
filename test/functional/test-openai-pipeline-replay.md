# OpenAI流水线回放验证系统测试

## 测试用例
基于捕获数据的OpenAI流水线调试回放和验证系统，支持断点调试和单步执行

## 测试目标
1. **数据回放**: 基于捕获的流水线数据重现执行过程
2. **断点调试**: 在指定步骤暂停执行，支持数据检查和修改
3. **单步执行**: 逐步执行流水线，观察每个步骤的详细过程
4. **修改验证**: 支持修改步骤数据，验证修复效果
5. **会话对比**: 对比不同会话的执行差异

## 最近执行记录

### 2025-07-30 17:52:30 - 回放系统架构设计 ✅ SUCCESS
- **执行时长**: 架构设计阶段
- **状态**: 完整回放验证系统设计完成
- **日志文件**: 与数据捕获系统共享 `/tmp/openai-pipeline-captures/`
- **发现要点**:
  - ✅ 完整的交互式调试界面，支持命令行操作
  - ✅ 断点系统和单步模式，灵活控制执行流程
  - ✅ 数据修改和验证机制，支持修复测试
  - ✅ 会话对比功能，识别不同执行的差异
  - ✅ 自动化验证检查，快速识别问题

## 核心功能模块

### 1. 回放控制系统
- **会话加载**: 从捕获目录加载指定会话的完整数据
- **步骤执行**: 按顺序或单独执行流水线步骤
- **执行控制**: 支持暂停、继续、步进等调试操作

### 2. 断点调试功能
- **断点设置**: 在任意步骤设置断点，支持多断点
- **单步模式**: 在每个步骤自动暂停执行
- **交互调试**: 断点暂停时的命令行交互界面

### 3. 数据修改系统
- **实时修改**: 在调试过程中修改步骤数据
- **嵌套路径**: 支持复杂对象的嵌套路径修改
- **修改应用**: 自动应用修改到后续步骤执行

### 4. 验证检查系统
- **步骤验证**: 针对每个步骤的特定验证规则
- **数据完整性**: 检查必需字段和数据结构
- **内容验证**: 验证响应内容的质量和完整性

### 5. 会话对比分析
- **差异检测**: 自动识别两个会话间的数据差异
- **变化追踪**: 追踪关键字段的变化情况
- **对比报告**: 生成详细的差异分析报告

## 使用方式

### 基本使用流程
```bash
# 运行交互式回放系统
node test-openai-pipeline-replay.js

# 选择要回放的会话
Select session number: 1

# 执行调试命令
Choose option: 3  # 执行完整回放
```

### 编程接口使用
```javascript
const { OpenAIPipelineReplaySystem } = require('./test-openai-pipeline-replay');

const replaySystem = new OpenAIPipelineReplaySystem();

// 加载会话
await replaySystem.loadSession('capture-1753512345678');

// 设置断点
replaySystem.setBreakpoint('step4-raw-response');

// 修改数据
replaySystem.modifyStepData('step2-routing', 'selectedProvider', 'alternative-provider');

// 执行完整回放
const results = await replaySystem.executeFullReplay();
```

## 调试命令集

### 主菜单命令
- **1. Set breakpoint** - 在指定步骤设置断点
- **2. Enable step mode** - 启用单步执行模式
- **3. Execute full replay** - 执行完整流水线回放
- **4. Execute single step** - 执行单个步骤
- **5. Modify data** - 修改步骤数据
- **6. Generate report** - 生成回放报告
- **7. Compare with other session** - 与其他会话对比
- **q. Quit** - 退出系统

### 断点调试命令
- **c (continue)** - 继续执行
- **s (step)** - 切换单步模式
- **i (inspect)** - 检查当前步骤数据
- **m (modify)** - 修改当前步骤数据
- **v (validate)** - 验证当前步骤
- **q (quit)** - 退出调试器

## 验证规则

### Step 1 验证 (Input Processing)
- ✅ **Has original request** - 检查原始请求数据存在
- ✅ **Has model name** - 验证模型名称存在
- ✅ **Has messages** - 检查消息数组非空

### Step 2 验证 (Routing)
- ✅ **Has routing category** - 验证路由类别确定
- ✅ **Has selected provider** - 检查选择的Provider
- ✅ **Has model mapping** - 验证模型映射完整

### Step 4 验证 (Raw Response)
- ✅ **Has response content** - 检查响应包含内容
- ✅ **Valid content length** - 验证内容长度合理

### Step 6 验证 (Transformer Output)
- ✅ **Has content blocks** - 检查内容块存在
- ✅ **Has text content** - 验证文本内容存在

## 数据修改示例

### 修改路由Provider
```javascript
// 修改Step 2的选择Provider
replaySystem.modifyStepData('step2-routing', 'selectedProvider', 'backup-provider');
```

### 修改模型映射
```javascript
// 修改目标模型
replaySystem.modifyStepData('step2-routing', 'targetModel', 'gpt-4-turbo');
```

### 修改响应内容
```javascript
// 修改原始响应的内容
replaySystem.modifyStepData('step4-raw-response', 'responseData.choices.0.message.content', 'Modified response content');
```

## 会话对比功能

### 对比场景
1. **修复前后对比** - 对比修复前后的执行差异
2. **不同配置对比** - 对比不同路由配置的影响
3. **Provider性能对比** - 对比不同Provider的响应差异

### 对比输出示例
```
📊 Comparison Results:

   [step2-routing]:
     📈 Differences found: 2
       • selectedProvider: shuaihong-openai → codewhisperer-primary
       • targetModel: gemini-2.5-flash → CLAUDE_SONNET_4_20250514_V1_0

   [step4-raw-response]:
     📈 Differences found: 1
       • responseAnalysis.contentLength: 245 → 312
```

## 报告生成

### 回放报告内容
- **会话信息** - 会话ID、时间戳、可用步骤
- **修改记录** - 应用的数据修改列表
- **调试配置** - 断点设置、单步模式状态
- **验证结果** - 每个步骤的验证检查结果

### 报告文件路径
```
/tmp/openai-pipeline-captures/capture-[timestamp]-replay-report.json
```

## 使用场景

### 1. 问题调试
```javascript
// 设置断点在问题步骤
replaySystem.setBreakpoint('step4-raw-response');

// 检查原始API响应
// [断点暂停] > i (inspect)

// 修改数据测试修复
// [断点暂停] > m (modify)
```

### 2. 修复验证
```javascript
// 加载问题会话
await replaySystem.loadSession('problematic-session');

// 应用修复
replaySystem.modifyStepData('step3-transformation', 'openaiRequest.tools', []);

// 执行验证
await replaySystem.executeFullReplay();
```

### 3. 性能分析
```javascript
// 对比不同Provider的响应时间
await replaySystem.compareWithSession('fast-provider-session');
```

## 扩展功能

### 自定义验证规则
可以扩展 `performStepValidation` 方法添加自定义验证：

```javascript
// 添加自定义验证
case 'custom-step':
  validations.push({
    check: 'Custom validation',
    passed: customValidationLogic(data),
    message: 'Custom validation result'
  });
```

### 批量修改
支持批量应用修改配置：

```javascript
const modifications = {
  'step2-routing': {
    'selectedProvider': 'new-provider',
    'targetModel': 'new-model'
  }
};

Object.entries(modifications).forEach(([step, changes]) => {
  Object.entries(changes).forEach(([path, value]) => {
    replaySystem.modifyStepData(step, path, value);
  });
});
```

## 性能优化
- **懒加载** - 按需加载步骤数据
- **内存管理** - 及时清理不需要的数据
- **异步处理** - 避免阻塞用户交互

## 下一步计划
1. **自动化修复建议** - 基于验证结果生成修复建议
2. **可视化界面** - Web界面支持更直观的调试
3. **批量会话分析** - 支持多会话的批量分析和对比
4. **集成CI/CD** - 将回放验证集成到持续集成流程

## 相关文件
- **回放系统**: `/test/functional/test-openai-pipeline-replay.js`
- **数据捕获系统**: `/test/functional/test-openai-pipeline-data-capture.js`
- **Hook系统**: `/test/functional/test-openai-pipeline-hooks.js`
- **使用文档**: 本文件
- **输出目录**: `/tmp/openai-pipeline-captures/`