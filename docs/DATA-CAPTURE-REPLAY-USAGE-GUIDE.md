# 📊 数据捕获和回放系统使用指南

## 🎯 系统概述

v3.0数据捕获和回放系统可以完整记录客户端到服务器响应的每个流水线步骤，并支持精确回放用于调试和测试。

## 🚀 快速启用

### 1. 启用调试模式

**使用 `--debug` 参数启动服务器**：
```bash
# 启动数据捕获模式
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json --debug

# 或者使用任何其他配置文件
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-openai-shuaihong-v3-5508.json --debug
```

### 2. 数据自动捕获

当 `--debug` 启用时，系统会自动：
- ✅ 记录六层架构流水线的所有I/O数据
- ✅ 创建审计追踪记录层间数据流转
- ✅ 收集性能指标和监控数据
- ✅ 捕获工具调用执行结果

## 📁 数据存储位置

```
~/.route-claudecode/database/
├── layers/        # 每层的输入/输出数据
├── audit/         # 审计追踪和数据流转记录
├── performance/   # 性能指标数据
├── replay/        # 回放场景定义
└── sessions/      # 会话管理数据
```

## 🎬 数据回放使用

### 创建和执行回放场景

```bash
# 1. 运行回放系统演示
node test-replay-system-demo.js

# 2. 或者使用测试框架
node test/functional/test-debug-system-integration.js
```

### 编程方式使用

```javascript
import { DebugRecorder } from './src/v3/debug/debug-recorder.js';
import { ReplaySystem } from './src/v3/debug/replay-system.js';

// 1. 初始化数据捕获
const recorder = new DebugRecorder();

// 2. 记录流水线数据
const recordId = recorder.recordLayerIO(
    'client', 
    'input', 
    { request: 'analyze code' }, 
    { requestId: 'req-123' }
);

// 3. 创建回放场景
const scenarioPath = recorder.createReplayScenario(
    'my-test-scenario', 
    [recordId]
);

// 4. 执行回放
const replaySystem = new ReplaySystem();
const results = await replaySystem.startReplay('my-test-scenario', {
    speed: 1.0,  // 实时回放
    mode: 'simulation'
});
```

## 🔧 六层架构数据捕获点

系统会在以下每个层级记录完整的I/O数据：

1. **Client Layer** (`client`)
   - 输入：原始用户请求
   - 输出：验证和格式化后的请求

2. **Router Layer** (`router`)  
   - 输入：待路由的请求
   - 输出：选定的Provider和模型

3. **Post-processor Layer** (`post-processor`)
   - 输入：Provider原始响应
   - 输出：格式化后的响应

4. **Transformer Layer** (`transformer`)
   - 输入：需要转换的数据格式
   - 输出：目标格式的转换结果

5. **Provider-Protocol Layer** (`provider-protocol`)
   - 输入：协议层请求参数
   - 输出：第三方API响应结果

6. **Preprocessor Layer** (`preprocessor`)
   - 输入：工具调用请求
   - 输出：工具执行结果

7. **Server Layer** (`server`)
   - 输入：最终处理的响应
   - 输出：发送给客户端的数据

## 🛠️ 团队协作使用

### 对于开发者

```bash
# 1. 启动调试模式进行开发
rcc3 start your-config.json --debug

# 2. 运行你的测试或API调用
# 数据会自动捕获到 ~/.route-claudecode/database/

# 3. 检查捕获的数据
ls ~/.route-claudecode/database/layers/
ls ~/.route-claudecode/database/audit/
```

### 对于测试工程师

```bash
# 1. 收集测试场景数据
rcc3 start test-config.json --debug
# 执行测试用例...

# 2. 创建回放场景用于回归测试
node test-replay-system-demo.js

# 3. 检查回放结果
ls ~/.route-claudecode/database/replay/output/
```

### 对于运维工程师

```bash
# 1. 生产问题复现
rcc3 start production-config.json --debug
# 重现问题场景...

# 2. 导出问题数据用于离线分析
# 数据位于 ~/.route-claudecode/database/

# 3. 在测试环境回放问题场景
# 使用ReplaySystem进行精确重现
```

## 📊 监控和分析

### 检查系统状态

```bash
# 检查服务器状态
rcc3 status --port 5506

# 检查健康状态
rcc3 health --port 5506
```

### 数据分析

```bash
# 查看最新捕获的数据
ls -la ~/.route-claudecode/database/layers/ | tail -10

# 查看审计追踪
cat ~/.route-claudecode/database/audit/trail-*.json

# 查看性能指标
cat ~/.route-claudecode/database/performance/*.json
```

## ⚡ 性能考虑

- **存储空间**: 每个请求约生成14个JSON文件，注意磁盘空间
- **性能影响**: 调试模式会略微增加响应时间（约5-10ms）
- **数据清理**: 定期清理旧的调试数据文件

```bash
# 清理30天前的数据
find ~/.route-claudecode/database/ -name "*.json" -mtime +30 -delete
```

## 🚨 注意事项

### 安全性
- ✅ 系统会自动过滤敏感信息（API密钥等）
- ✅ 数据存储在本地，不会上传到外部服务
- ⚠️ 注意保护包含业务数据的捕获文件

### 兼容性
- ✅ 支持所有v3.0配置文件格式
- ✅ 兼容单Provider和多Provider配置
- ✅ 支持所有Provider协议（OpenAI、Anthropic、Gemini、CodeWhisperer）

### 故障排除

**问题**: 数据库目录不存在
```bash
# 解决: 运行一次调试模式会自动创建
rcc3 start any-config.json --debug
```

**问题**: 回放失败
```bash
# 解决: 检查uuid包是否安装
npm list uuid
npm install uuid  # 如果未安装
```

## 🎯 最佳实践

1. **开发阶段**: 始终使用 `--debug` 进行开发和测试
2. **生产环境**: 谨慎使用调试模式，定期清理数据
3. **团队协作**: 共享回放场景文件用于问题复现
4. **持续集成**: 在CI/CD中集成数据捕获验证

---

**问题反馈**: 如遇到问题，请检查 `~/.route-claudecode/database/` 目录内容，并提供相关日志信息。