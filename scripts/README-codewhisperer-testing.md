# CodeWhisperer测试流程说明

## 概述

基于用户要求"请先确认codewhisperer能否正常工作，捕获服务器的二进制数据后，如果不能工作通过该二进制数据和demo3交叉对比来实现解析的黑盒测试流通，在黑盒测试完成以后才能进行服务器测试，每日token有限额"，我们创建了一套完整的分阶段测试流程。

## 🎯 测试策略

### 核心原则
1. **Token节省优先** - 在使用有限token之前先验证系统健康状态
2. **分阶段验证** - 每个阶段验证通过后才进行下一阶段
3. **黑盒测试优先** - 使用离线分析减少token消耗
4. **问题早发现** - 在基础阶段发现问题，避免浪费高级测试的token

### 测试阶段
```
健康检查 → 黑盒测试 → 兼容性测试 → 流水线测试
(最小token) (无token)  (中等token)  (高token)
```

## 📋 测试脚本说明

### 1. 健康检查脚本 (`test-codewhisperer-health-check.js`)
- **目的**: 验证CodeWhisperer基本功能是否正常
- **Token使用**: 最小（仅基础连通性测试）
- **功能**:
  - 服务器连通性测试
  - 认证系统检查
  - 简单请求测试
  - 二进制数据捕获

```bash
# 执行健康检查
./scripts/test-codewhisperer-health-check.js
```

**输出**:
- 系统健康状态评估
- 是否可以进行token测试的建议
- 捕获的二进制数据文件

### 2. 黑盒测试脚本 (`test-codewhisperer-binary-blackbox.js`)
- **目的**: 离线分析捕获的二进制数据
- **Token使用**: 无（纯离线分析）
- **功能**:
  - AWS Event Stream格式解析
  - 与demo3响应对比
  - 数据格式验证
  - 问题诊断

```bash
# 执行黑盒测试（需要先运行健康检查）
./scripts/test-codewhisperer-binary-blackbox.js
```

**输出**:
- 二进制数据解析结果
- 与demo3的对比分析
- Parser实现建议

### 3. 兼容性测试脚本 (`test-demo3-compatibility.js`)
- **目的**: 与demo3标准进行全面对比
- **Token使用**: 中等（多个测试用例）
- **功能**:
  - 基础文本请求对比
  - 工具调用请求对比
  - 流式请求对比
  - 兼容性评分

```bash
# 执行兼容性测试
./tests/codewhisperer/test-demo3-compatibility.js
```

**输出**:
- 兼容性评分（目标≥80%）
- 主要差异分析
- 修复建议

### 4. 流水线测试脚本 (`test-pipeline-simulation.js`)
- **目的**: 验证完整的流水线架构
- **Token使用**: 高（完整功能测试）
- **功能**:
  - 6个流水线阶段测试
  - 端到端验证
  - 性能分析
  - 架构完整性检查

```bash
# 执行流水线测试
./tests/codewhisperer/test-pipeline-simulation.js
```

**输出**:
- 流水线完整性评分（目标≥80%）
- 各阶段性能分析
- 架构改进建议

### 5. 综合测试脚本 (`test-codewhisperer-comprehensive.js`)
- **目的**: 统一执行所有测试阶段
- **Token使用**: 智能（根据前置条件决定）
- **功能**:
  - 按依赖关系执行测试
  - 失败时自动停止
  - 综合报告生成
  - Token使用统计

```bash
# 执行综合测试（推荐）
./scripts/test-codewhisperer-comprehensive.js
```

## 🚀 快速开始

### 推荐执行顺序

#### 方案1: 综合测试（推荐）
```bash
# 一键执行所有测试，自动处理依赖和token节省
./scripts/test-codewhisperer-comprehensive.js
```

#### 方案2: 手动分步执行
```bash
# 1. 健康检查（必须）
./scripts/test-codewhisperer-health-check.js

# 2. 如果健康检查失败，执行黑盒测试
./scripts/test-codewhisperer-binary-blackbox.js

# 3. 如果健康检查通过，执行兼容性测试
./tests/codewhisperer/test-demo3-compatibility.js

# 4. 如果兼容性测试通过，执行流水线测试
./tests/codewhisperer/test-pipeline-simulation.js
```

## 📊 测试结果解读

### 健康检查结果
- **healthy**: 系统正常，可以进行完整测试
- **auth_failed**: 认证问题，需要检查Kiro配置
- **request_failed**: 请求失败，需要黑盒测试分析
- **critical**: 服务器无法连接

### 黑盒测试结果
- **成功解析**: 数据格式正常，可以优化parser
- **解析失败**: 数据格式有问题，需要检查API调用

### 兼容性测试结果
- **≥90分**: 完全兼容
- **80-89分**: 基本兼容，有小问题
- **70-79分**: 部分兼容，需要改进
- **<70分**: 兼容性不足，需要重大修复

### 流水线测试结果
- **≥90分**: 流水线完整且高效
- **80-89分**: 基本完整，有性能问题
- **70-79分**: 部分完整，缺少关键阶段
- **<70分**: 流水线不完整，需要重大修复

## 🪙 Token使用优化

### Token节省策略
1. **健康检查优先**: 使用最小token验证基础功能
2. **黑盒测试**: 完全离线分析，不消耗token
3. **条件执行**: 只有前置条件满足才执行高token测试
4. **早期停止**: 发现问题立即停止，避免浪费token

### Token使用级别
- **不使用**: 黑盒测试（离线分析）
- **最小使用**: 健康检查（基础连通性）
- **中等使用**: 兼容性测试（多个测试用例）
- **高使用**: 流水线测试（完整功能验证）

## 📁 输出文件

### 日志目录
- `/tmp/codewhisperer-health-check/` - 健康检查日志
- `/tmp/codewhisperer-binary-data/` - 捕获的二进制数据
- `/tmp/codewhisperer-blackbox-test/` - 黑盒测试日志
- `/tmp/codewhisperer-demo3-comparison/` - 兼容性测试日志
- `/tmp/codewhisperer-pipeline-simulation/` - 流水线测试日志
- `/tmp/codewhisperer-comprehensive/` - 综合测试日志

### 报告文件
- `health-report-[timestamp].md` - 健康检查报告
- `blackbox-report-[timestamp].md` - 黑盒测试报告
- `compatibility-report-[timestamp].md` - 兼容性测试报告
- `pipeline-report-[timestamp].md` - 流水线测试报告
- `comprehensive-report-[timestamp].md` - 综合测试报告

## 🔧 故障排除

### 常见问题

#### 1. 服务器无法连接
```bash
# 检查服务器是否启动
curl http://localhost:8080/health

# 检查端口占用
lsof -i :8080
```

#### 2. 认证失败
```bash
# 检查token文件
ls -la ~/.aws/sso/cache/kiro-auth-token.json

# 重新登录Kiro
kiro auth login
```

#### 3. 二进制数据解析失败
- 查看黑盒测试报告中的详细分析
- 检查AWS Event Stream格式是否正确
- 对比demo3的响应格式

#### 4. 兼容性评分低
- 查看兼容性测试报告中的差异分析
- 检查header配置是否与demo3一致
- 验证流水线集成是否正确

## 📈 持续改进

### 定期执行
建议在以下情况执行测试：
- 修改CodeWhisperer相关代码后
- 更新认证配置后
- 发现问题需要验证修复效果时
- 定期健康检查（每周）

### 扩展测试
可以考虑添加的测试：
- 性能基准测试
- 并发处理测试
- 错误恢复测试
- 长时间运行测试

---

**创建时间**: 2025-08-06  
**维护者**: Jason Zhang  
**版本**: v1.0  
**项目**: Claude Code Router v2.7.0