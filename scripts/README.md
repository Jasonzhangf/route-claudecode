# RCC4 测试脚本

## 流水线测试运行器 (pipeline-test-runner.sh)

这是RCC4项目的标准化测试脚本，用于替代直接的服务启动命令，提供可配置的模块化测试能力。

### 主要特性

- ✅ **模块化测试**: 支持测试特定模块 (router, pipeline, client, debug)
- ✅ **可配置数据源**: 支持 mock、file、live 数据源
- ✅ **多种测试模式**: unit、integration、e2e、performance
- ✅ **预设配置**: basic、full、debug、performance
- ✅ **详细日志**: 自动记录测试过程和结果
- ✅ **报告生成**: JSON和控制台格式输出

### 快速开始

```bash
# 基础流水线测试
./scripts/pipeline-test-runner.sh basic

# 完整端到端测试
./scripts/pipeline-test-runner.sh full

# 指定配置文件测试
./scripts/pipeline-test-runner.sh --config ~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json

# 自定义模块测试
./scripts/pipeline-test-runner.sh --module router --data-source file --mode integration
```

### 使用场景

1. **开发阶段**: 使用 `basic` 预设进行快速验证
2. **集成测试**: 使用 `full` 预设进行完整测试
3. **调试问题**: 使用 `debug` 预设进行问题诊断
4. **性能验证**: 使用 `performance` 预设进行性能测试

### 输出文件

- **日志**: `logs/pipeline-tests/pipeline-test-YYYYMMDD.log`
- **结果**: `test-results/pipeline/`
- **配置**: `.rcc-pipeline-test/`

### 集成到开发工作流

当钩子检测到直接的服务启动命令时，会引导开发者使用此脚本进行标准化测试，确保：

- TypeScript编译检查
- 模块依赖验证
- 端到端功能测试
- 调试日志收集

这样可以避免直接启动可能存在问题的服务，而是通过结构化的测试流程验证系统状态。