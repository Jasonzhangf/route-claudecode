# 权重负载均衡功能验证测试

## 测试用例
**用一句话描述测试目的**: 验证权重分配、连续429检测、动态权重重分配和Key共享权重机制的完整实现

## 测试目标
验证新实现的权重负载均衡系统是否满足以下核心需求：

1. **权重分配**: Provider按照配置的weight比例分配请求
2. **连续429检测**: 连续3次429错误才拉黑provider，单次429冷却1分钟
3. **动态权重重分配**: 拉黑provider后权重按比例转移给健康providers
4. **Key共享权重**: 多key provider内部轮询，但外部共享权重比例

## 测试文件信息
- **测试脚本**: `test-weighted-load-balancing.js`
- **运行命令**: `node test-weighted-load-balancing.js`
- **相关文件**: 
  - `src/routing/simple-provider-manager.ts`
  - `src/routing/engine.ts`

## 测试场景详细说明

### 测试1: 权重分配验证
**目标**: 验证provider按照配置权重比例获得请求
- **配置**: shuaihong-openai(40%), modelscope(30%), GLM-4.5(30%)
- **方法**: 进行1000次选择，统计实际分布
- **验证标准**: 实际分布与配置权重偏差 ≤ 5%

### 测试2: 连续429检测验证  
**目标**: 验证连续3次429错误才拉黑机制
- **测试步骤**:
  1. 第1次429 → 应该不被拉黑
  2. 第2次429 → 应该不被拉黑  
  3. 第3次429 → 应该被拉黑
  4. 成功请求 → 应该恢复健康状态
- **验证标准**: 严格按照3次阈值执行拉黑策略

### 测试3: 动态权重重分配验证
**目标**: 验证provider拉黑后权重重新分配机制
- **初始配置**: A(50%), B(30%), C(20%)
- **拉黑A后**: B和C按原始比例重分配 → B(60%), C(40%)
- **验证标准**: 
  - A选择次数 = 0
  - B:C比例接近60:40 (±10%误差允许)

### 测试4: Key级别管理验证
**目标**: 验证多key provider的内部轮询和外部权重共享
- **设置**: 创建4个key的provider
- **测试内容**:
  1. Key轮询分布均匀性
  2. 单个key拉黑后其他key正常轮询
  3. Key状态跟踪准确性
- **验证标准**: Key级别拉黑不影响provider级别权重

## 最近执行记录

### 执行时间: 2025-08-05 12:37:17
**状态**: ✅ 全部通过
**执行时长**: < 1秒 (快速测试)
**日志文件**: 终端输出直接显示

**实际结果**:
- ✅ 测试1: 权重分配验证 - 通过 (偏差 ≤ 4.4%, 符合 ±5% 标准)
- ✅ 测试2: 连续429检测验证 - 通过 (严格3次阈值)
- ✅ 测试3: 动态权重重分配验证 - 通过 (B:58.7% C:41.3% vs 期望60:40%)
- ✅ 测试4: Key级别管理验证 - 通过 (Key[0]成功拉黑，其他轮询正常)

**关键验证点**:
- ✅ 权重选择算法正确性 - shuaihong-openai 44.2% (期望40%)
- ✅ 连续429检测阈值(3次) - 前2次不拉黑，第3次拉黑，成功后恢复
- ✅ 权重重分配算法准确性 - provider-a拉黑后权重完美重分配
- ✅ Key级别状态管理 - 4个key中Key[0]被拉黑，其余3个正常轮询

## 历史执行记录

### 执行时间: 待首次执行
**状态**: 新测试，待验证
**测试覆盖**: 
- 权重负载均衡核心功能
- 智能故障检测机制
- 动态权重管理系统
- 多key provider管理

**技术实现验证**:
- `SimpleProviderManager.selectProviderWeighted()` - 权重选择算法
- `SimpleProviderManager.redistributeWeights()` - 权重重分配逻辑
- `SimpleProviderManager.reportFailure()` - 连续429检测
- `SimpleProviderManager.initializeProviderKeys()` - Key级别管理

## 实现架构说明

### 核心改进
1. **权重选择算法**: 使用累积权重分布的O(n)加权随机选择
2. **连续429检测**: 维护consecutiveFailures Map跟踪连续错误
3. **动态权重重分配**: 拉黑provider权重按比例分配给健康providers
4. **Key级别管理**: keyBlacklist和keyRoundRobinIndex管理多key状态

### 兼容性保证
- 向后兼容单provider + backup配置格式
- 自动fallback到round-robin如果权重配置缺失
- 保持现有API接口不变

## 相关配置文件
测试使用的负载均衡配置参考:
- `~/.route-claude-code/config/load-balancing/config-multi-openai-full.json`

该配置文件包含weight字段，现在将被正确使用：
```json
{
  "providers": [
    {"provider": "shuaihong-openai", "model": "qwen3-coder", "weight": 40},
    {"provider": "modelscope-openai", "model": "Qwen/Qwen3-Coder-480B-A35B-Instruct", "weight": 30},
    {"provider": "modelscope-openai", "model": "ZhipuAI/GLM-4.5", "weight": 30}
  ]
}
```