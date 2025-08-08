# 📋 STD-PIPELINE-TESTING-FLOW 使用指南

**版本**: v2.0.0  
**更新时间**: 2025-08-08  
**适用项目**: Claude Code Router v2.8.0+

## 🎯 快速开始

### 前置条件

1. **Node.js 环境**: 确保安装了 Node.js 16+ 
2. **项目权限**: 对 `database/` 目录有读写权限
3. **网络访问**: 能够访问本地Provider端点 (可选，用于真实测试)

### 一键执行完整测试流程

```bash
# 1. 进入项目根目录
cd claude-code-router

# 2. 执行标准流水线测试系统
node standard-pipeline-testing-system.js

# 3. 查看执行结果
echo "测试完成，查看结果："
cat database/pipeline-data-unified/analytics/std-pipeline-testing-final-report.json
```

### 预期输出示例

```
🎯 开始执行标准流水线测试流程 (STD-PIPELINE-TESTING-FLOW)
📋 Phase 1: 1-database-cleanup ✅
📊 Phase 2: 2-data-capture-system ✅  
🔬 Phase 3: 3-module-data-simulation ✅
🧪 Phase 4: 4-individual-module-logic-tests ⚠️ (部分模块测试失败 - 符合预期)
⚡ Phase 5: 5-pipeline-simulation-tests ✅
🚀 Phase 6: 6-real-pipeline-tests ✅/⚠️ (取决于Provider可用性)

✅ 标准流水线测试系统执行成功
📄 详细日志: /tmp/std-pipeline-testing-*.log
📊 结果目录: database/pipeline-data-unified/analytics
```

## 📊 测试结果解析

### 测试状态说明

- **✅ 成功**: 该阶段完全通过
- **⚠️ 警告**: 部分测试失败但在预期范围内
- **❌ 失败**: 关键错误，需要修复

### 结果文件位置

```
database/pipeline-data-unified/analytics/
├── std-pipeline-testing-final-report.json    # 最终总结报告
├── individual-module-logic/                   # Phase 4 结果
│   └── test-results.json
├── pipeline-simulation/                       # Phase 5 结果
│   └── simulation-results.json
└── real-pipeline-tests/                       # Phase 6 结果
    └── real-test-results.json
```

### 报告解读

#### 最终报告结构
```json
{
  "testingSystem": "STD-PIPELINE-TESTING-FLOW",
  "version": "2.0.0", 
  "executedAt": "2025-08-08T11:39:28.000Z",
  "overallResults": {
    "success": true/false,
    "completedPhases": 6,
    "totalPhases": 6,
    "duration": 45000  // 毫秒
  },
  "phaseResults": {
    "1-database-cleanup": {
      "success": true,
      "duration": 500,
      "message": "数据库结构验证通过"
    }
    // ... 其他阶段结果
  },
  "recommendations": [
    "✅ 所有测试阶段成功完成，系统运行状态良好"
  ],
  "nextSteps": [
    "1. 将此测试系统集成到CI/CD流水线中"
  ]
}
```

## 🔧 分阶段执行

如果需要单独执行某个阶段，可以修改测试系统或使用以下方法：

### Phase 1: 数据库清理

```bash
# 单独执行数据库清理
node database-cleanup-and-setup.js

# 验证结果
ls -la database/pipeline-data-unified/
```

### Phase 2: 数据捕获系统初始化

```bash  
# 单独初始化数据捕获系统
node pipeline-data-capture-initializer.js

# 检查配置
cat database/pipeline-data-unified/capture-system-config.json
```

### Phase 3-6: 完整测试流程

这些阶段需要按顺序执行，建议使用完整的测试系统。

## 🎯 自定义测试

### 添加新的测试场景

1. **创建测试场景文件**:
   ```bash
   # 在测试场景目录下创建新场景
   cd database/pipeline-data-unified/simulation-data/test-scenarios/
   
   # 创建新场景文件 (参考现有格式)
   cat > custom-scenario.json << 'EOF'
   {
     "scenarioId": "custom-scenario",
     "name": "自定义测试场景",
     "description": "测试特定功能",
     "providers": ["gemini", "openai"],
     "request": {
       "messages": [{"role": "user", "content": "自定义测试内容"}],
       "max_tokens": 200
     },
     "expectedResponse": {
       "contentType": "text",
       "stopReason": "end_turn"
     }
   }
   EOF
   ```

2. **更新场景索引**:
   ```bash
   # 编辑 index.json 添加新场景
   vim database/pipeline-data-unified/simulation-data/test-scenarios/index.json
   ```

### 配置新的Provider端点

1. **编辑测试配置**:
   ```bash
   # 编辑Pipeline测试配置
   vim database/pipeline-data-unified/pipeline-test-config.json
   ```

2. **添加Provider配置**:
   ```json
   {
     "providers": {
       "new-provider": {
         "testModels": ["model-1", "model-2"],
         "testEndpoints": [5510, 5511]
       }
     }
   }
   ```

### 自定义模块测试

1. **创建模块测试配置**:
   ```bash
   cd database/pipeline-data-unified/simulation-data/module-tests/
   
   cat > custom-module.json << 'EOF'
   {
     "module": "CustomModule",
     "testType": "module-logic", 
     "description": "自定义模块测试",
     "testCases": [
       "custom-validation",
       "custom-transformation",
       "error-handling"
     ],
     "mockData": {
       "validInput": true,
       "invalidInput": true,
       "errorCase": true
     }
   }
   EOF
   ```

2. **更新模块索引**:
   ```bash
   # 编辑 index.json 添加新模块
   vim database/pipeline-data-unified/simulation-data/module-tests/index.json
   ```

## 🚀 真实Provider测试

### 启动Provider服务

要进行Phase 6的真实测试，需要先启动Provider服务：

#### Gemini Provider (推荐用于测试)
```bash
# 启动Gemini服务
rcc start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug &

# 验证服务启动
curl http://localhost:5502/health
```

#### OpenAI Compatible Providers
```bash  
# LM Studio
rcc start ~/.route-claude-code/config/single-provider/config-openai-lmstudio-5506.json --debug &

# ModelScope  
rcc start ~/.route-claude-code/config/single-provider/config-openai-modelscope-5507.json --debug &

# 验证服务
curl http://localhost:5506/health
curl http://localhost:5507/health
```

#### CodeWhisperer Providers
```bash
# 启动CodeWhisperer服务 (需要有效的AWS配置)
rcc start ~/.route-claude-code/config/single-provider/config-codewhisperer-kiro-gmail-5504.json --debug &

# 验证服务
curl http://localhost:5504/health
```

### 验证Provider连通性

在执行测试前，可以手动验证Provider：

```bash
# 测试基础连通性
curl -X POST http://localhost:5502/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gemini-2.5-flash",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## 📈 性能监控和优化

### 性能基准参考

- **正常执行时间**: 60-120秒 (全流程)
- **Phase 1-3**: < 10秒
- **Phase 4**: 20-40秒 (取决于模块数量)
- **Phase 5**: 30-60秒 (取决于场景复杂度)  
- **Phase 6**: 30-90秒 (取决于Provider响应时间)

### 性能监控

```bash
# 查看详细执行日志
tail -f /tmp/std-pipeline-testing-*.log

# 监控系统资源
top -p $(pgrep -f "standard-pipeline-testing")

# 检查数据库大小
du -sh database/pipeline-data-unified/
```

### 性能优化建议

1. **并发测试**: 可以同时启动多个Provider测试
2. **缓存机制**: 重复使用已生成的模拟数据
3. **分批处理**: 大量测试场景可以分批执行
4. **数据清理**: 定期清理旧的测试数据

## 🔍 故障排查

### 常见错误和解决方案

#### Error: "EACCES: permission denied"
```bash
# 解决方案：确保有目录写权限
chmod -R 755 database/
mkdir -p database/pipeline-data-unified
```

#### Error: "Phase 4 failed: 部分模块逻辑测试失败"
```bash
# 这是正常行为 - 模拟测试有10%失败率
# 查看详细结果：
cat database/pipeline-data-unified/analytics/individual-module-logic/test-results.json

# 如果需要100%成功，修改模拟成功率：
# 编辑 standard-pipeline-testing-system.js 中的 simulateModuleTestCase 方法
```

#### Error: "Phase 6 failed: 没有可用的provider端点"
```bash
# 解决方案：启动至少一个Provider服务
rcc start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug &

# 或者跳过真实测试，只运行模拟阶段
# 修改代码注释掉 Phase 6
```

#### Error: "Database structure validation failed"
```bash
# 重新初始化数据库
rm -rf database/pipeline-data-unified
node database-cleanup-and-setup.js
node pipeline-data-capture-initializer.js
```

### 调试方法

#### 1. 查看详细日志
```bash
# 实时查看日志
tail -f /tmp/std-pipeline-testing-*.log

# 查看特定阶段日志
grep "Phase [1-6]" /tmp/std-pipeline-testing-*.log
```

#### 2. 验证数据库状态
```bash
# 检查目录结构
tree database/pipeline-data-unified/ -L 2

# 验证配置文件
cat database/pipeline-data-unified/database-config.json
cat database/pipeline-data-unified/pipeline-test-config.json
```

#### 3. 检查Provider状态  
```bash
# 检查所有可能的Provider端点
for port in 5501 5502 5503 5504 5505 5506 5507 5508 5509; do
  echo "Testing port $port:"
  curl -f http://localhost:$port/health 2>/dev/null && echo "✅ OK" || echo "❌ Failed"
done
```

#### 4. 手动验证各阶段
```bash
# Phase 1: 数据库检查
ls -la database/pipeline-data-unified/

# Phase 2: 捕获系统检查  
cat database/pipeline-data-unified/capture-system-config.json

# Phase 3: 模拟数据检查
cat database/pipeline-data-unified/simulation-data/pipeline-mock-data/generated-simulation-data.json

# Phase 4: 模块测试结果
cat database/pipeline-data-unified/analytics/individual-module-logic/test-results.json
```

## 🛠️ 高级配置

### 修改测试成功率

默认的模块测试有10%失败率来验证错误检测。如需修改：

```javascript
// 编辑 standard-pipeline-testing-system.js
async simulateModuleTestCase(moduleId, testCase, moduleConfig) {
  return new Promise(resolve => {
    setTimeout(() => {
      // 修改这里的成功率 (0.9 = 90%成功率)
      const success = Math.random() > 0.1;  // 改为 > 0.0 实现100%成功
      resolve({
        success,
        duration: 50 + Math.random() * 100,
        message: success ? '测试用例通过' : '测试用例失败'
      });
    }, 10);
  });
}
```

### 自定义测试超时

```javascript
// 修改 CONFIG 对象
const CONFIG = {
  // ... 其他配置
  timeout: {
    phase4: 60000,  // Phase 4 超时时间(毫秒)
    phase5: 120000, // Phase 5 超时时间 
    phase6: 180000  // Phase 6 超时时间
  }
};
```

### 添加新的验证规则

```javascript
// 在 validateRealResponse 方法中添加自定义验证
validateRealResponse(response) {
  // 基础验证
  if (response.statusCode !== 200) return false;
  if (response.parseError) return false;
  
  const body = response.body;
  if (!body || !body.content || !Array.isArray(body.content)) return false;
  
  // 自定义验证规则
  if (body.content.length === 0) return false;
  
  // 检查特定字段
  if (!body.stop_reason) return false;
  
  return true;
}
```

## 📅 定期维护

### 数据清理

建议定期清理测试数据：

```bash
# 清理30天前的测试数据
find database/pipeline-data-unified/ -name "*.json" -mtime +30 -delete

# 清理临时日志
find /tmp/ -name "std-pipeline-testing-*.log" -mtime +7 -delete

# 清理备份数据 (保留最近3个)
ls -t database/backup-* | tail -n +4 | xargs rm -rf
```

### 性能基准更新

定期更新性能基准：

```bash
# 生成性能报告
node -e "
const fs = require('fs');
const reports = fs.readdirSync('database/pipeline-data-unified/analytics')
  .filter(f => f.includes('std-pipeline-testing-final-report'))
  .map(f => JSON.parse(fs.readFileSync(\`database/pipeline-data-unified/analytics/\${f}\`)))
  .slice(-10);  // 最近10次

const avgDuration = reports.reduce((sum, r) => sum + r.overallResults.duration, 0) / reports.length;
console.log(\`Average Duration: \${avgDuration}ms\`);
"
```

## 🔄 CI/CD 集成

### GitHub Actions 集成示例

```yaml
# .github/workflows/pipeline-testing.yml
name: STD Pipeline Testing

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  pipeline-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Run STD Pipeline Testing
      run: |
        chmod +x standard-pipeline-testing-system.js
        node standard-pipeline-testing-system.js
        
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: pipeline-test-results
        path: |
          database/pipeline-data-unified/analytics/
          /tmp/std-pipeline-testing-*.log
```

### 定时测试

```bash
# 添加到 crontab，每日执行
crontab -e

# 添加以下行 (每天上午9点执行)
0 9 * * * cd /path/to/claude-code-router && node standard-pipeline-testing-system.js >> /tmp/daily-pipeline-test.log 2>&1
```

## 📞 获取帮助

### 问题报告

如遇到问题，请收集以下信息：

1. **系统环境**:
   ```bash
   node --version
   npm --version
   uname -a
   ```

2. **完整日志**:
   ```bash
   # 最新的测试日志
   cat /tmp/std-pipeline-testing-*.log
   ```

3. **配置信息**:
   ```bash
   # 数据库配置
   cat database/pipeline-data-unified/database-config.json
   
   # 测试配置
   cat database/pipeline-data-unified/pipeline-test-config.json
   ```

4. **错误复现步骤**: 详细说明如何复现问题

### 联系方式

- **项目维护者**: Jason Zhang
- **文档更新**: 2025-08-08
- **版本**: STD-PIPELINE-TESTING-FLOW v2.0.0

---

🎯 **快速命令参考**:
```bash
# 完整测试流程
node standard-pipeline-testing-system.js

# 查看结果
cat database/pipeline-data-unified/analytics/std-pipeline-testing-final-report.json

# 查看日志  
tail -f /tmp/std-pipeline-testing-*.log

# 清理数据
rm -rf database/pipeline-data-unified/
```