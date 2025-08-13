# Claude Code 端到端交互式测试

## 测试用例
使用文件重定向输入模拟真实用户操作，验证Claude Code客户端与LMStudio的完整交互体验

## 测试目标
- 验证真实用户交互场景下的系统表现
- 测试工具调用在交互环境中的准确性
- 检测API错误和请求格式问题
- 验证多轮对话和复杂工具使用场景
- 评估错误处理和恢复能力

## 测试方法

### 🎭 交互模拟方式
使用文件重定向输入（`< input.txt`）模拟用户在Claude Code界面中的真实操作：

```bash
# 传统方式：手动交互
rcc3 code --port 5506
> 列出当前目录下的文件    # 用户手动输入
> 创建一个测试文件        # 用户手动输入

# 自动化方式：文件重定向
echo -e "列出当前目录下的文件\n创建一个测试文件\n/exit" > input.txt
rcc3 code --port 5506 < input.txt
```

### 📋 测试场景

#### 1. **基础文件操作测试**
**目标**: 验证基本的文件系统工具调用
```
输入序列:
- "列出当前目录下的文件"
- "创建一个名为test.txt的文件，内容是'Hello World'"
- "读取test.txt文件的内容" 
- "删除test.txt文件"

期望结果:
- Tool call: ls 或 LS
- Tool call: Write
- Tool call: Read  
- Tool call: 删除/rm
```

#### 2. **复杂工具调用测试**
**目标**: 验证系统工具和复合操作
```
输入序列:
- "帮我检查系统的磁盘使用情况"
- "查看当前正在运行的进程"
- "创建一个包含系统信息的报告文件"

期望结果:
- Tool call: df/disk usage
- Tool call: ps/process
- Tool call: Write (系统报告)
```

#### 3. **多轮对话工具调用测试** 
**目标**: 验证上下文相关的工具调用链
```
输入序列:
- "我需要分析一个项目的代码结构"
- "请先列出项目根目录的内容"
- "然后检查package.json文件是否存在"
- "如果存在，请读取其内容并总结项目信息"

期望结果:
- 理解分析意图
- Tool call: ls (项目目录)
- Tool call: 检查文件存在
- Tool call: Read package.json
```

#### 4. **错误处理和恢复测试**
**目标**: 验证系统的错误处理能力
```
输入序列:
- "读取一个不存在的文件nonexistent.txt"
- "执行一个错误的命令：invalidcommand"  
- "现在正常操作：列出当前目录"

期望结果:
- Tool call: Read (失败处理)
- Tool call: invalidcommand (错误处理)
- Tool call: ls (恢复正常)
```

## 测试实现细节

### 🔧 技术架构
```javascript
class ClaudeCodeE2EInteractiveTest {
  // 1. 创建输入文件
  createInputFile(scenarioName, inputs)
  
  // 2. 启动Claude Code进程 
  runClaudeCodeSession(inputFile, scenario)
  
  // 3. 实时分析输出
  analyzeScenarioResults(scenario, sessionResult)
  
  // 4. 生成详细报告
  generateE2EReport()
}
```

### 📊 自动化流程
1. **环境准备**: 创建测试工作目录，启动LMStudio服务
2. **输入文件生成**: 将测试命令写入文件 (`scenario-input.txt`)
3. **进程启动**: 使用spawn启动 `rcc3 code` 并重定向stdin
4. **实时监控**: 捕获stdout/stderr，解析响应模式
5. **结果分析**: 检测工具调用模式，统计成功率
6. **报告生成**: 多格式报告 (JSON/Markdown)

### ⚡ 核心检测逻辑

#### 工具调用模式识别
```javascript
expectedPatterns: [
  /Tool call:.*ls/i,           // 标准工具调用格式
  /Tool call:.*Write/i,        // 文件写入操作
  /Tool call:.*Read/i,         // 文件读取操作
  /function.*bash/i            // 函数调用格式
]
```

#### 错误模式识别
```javascript
// API错误检测
const apiErrors = fullOutput.match(/Error:.*API error/g) || []

// 400错误检测  
const badRequests = fullOutput.match(/400 Bad Request/g) || []

// 格式问题检测
const toolCallAsText = fullOutput.includes('Tool call:') && 
                      !fullOutput.includes('function')
```

## 成功标准

### ✅ 场景成功标准
- **工具调用成功率**: ≥70%
- **无高危错误**: API错误、400 Bad Request = 0
- **响应完整性**: 每个输入都有对应输出
- **会话稳定性**: 能完成完整的多轮对话

### 📊 整体成功标准
- **场景成功率**: ≥80%
- **工具调用总成功率**: ≥75%
- **高危问题**: = 0
- **系统恢复能力**: 错误后能继续正常工作

## 预期输出示例

### 正常情况
```
📤 输入: 列出当前目录下的文件
📥 输出: Tool call: ls() ...

📤 输入: 创建一个测试文件  
📥 输出: Tool call: Write(filename="test.txt", content="...") ...
```

### 异常情况（需要修复）
```  
📤 输入: 列出当前目录下的文件
📥 输出: ⏺ Error: LM Studio API error: 400 Bad Request

📤 输入: 创建一个测试文件
📥 输出: ⏺ Error: LM Studio API error: 400 Bad Request
```

## 最近执行记录

### 执行时间: 待执行
- **状态**: 新建端到端交互测试
- **执行时长**: 预计8-15分钟
- **日志文件**: 待生成

## 历史执行记录
- 无历史记录

## 相关文件
- **主测试脚本**: test/functional/test-claude-code-e2e-interactive.js
- **配置目录**: ~/.route-claudecode/config/v3/single-provider/
- **输出目录**: test/output/functional/test-claude-e2e-data/

## 使用方法

### 单独运行
```bash
node test/functional/test-claude-code-e2e-interactive.js
```

### 前置条件
1. **LMStudio桌面应用** 已启动并加载模型
2. **rcc3命令** 已安装并可用  
3. **配置文件** config-lmstudio-v3-5506.json 存在
4. **端口5506可用** (会自动清理冲突)

## 预期结果
- 4个测试场景全部完成
- 工具调用成功率≥75%
- 无API错误和400 Bad Request
- 生成完整的交互测试报告
- 识别并报告具体的工具调用问题

## 故障排除

### 常见问题
1. **API错误频发**
   - 检查LMStudio服务状态
   - 验证配置文件正确性
   - 确认模型正确加载

2. **400 Bad Request**
   - 检查请求格式兼容性
   - 验证工具定义格式
   - 确认OpenAI协议兼容性

3. **工具调用解析失败**
   - 检查响应格式处理逻辑
   - 验证工具调用模式识别
   - 确认缓冲处理机制

4. **会话超时**
   - 增加超时时间设置
   - 检查系统资源使用
   - 优化输入发送间隔

### 调试建议
- 查看生成的输入文件确认测试命令正确
- 检查原始输出文件了解具体错误信息
- 运行单独场景进行问题定位
- 开启--debug模式获取详细日志

## 与其他测试的关系

这个端到端交互测试是整个LMStudio验证系统的最终环节：

1. **综合验证系统** → 验证基础架构
2. **协议验证测试** → 验证API兼容性  
3. **数据扫描分析** → 发现历史问题
4. **端到端交互测试** → 验证用户真实体验 ✨

通过这个测试，我们可以确保用户在实际使用Claude Code时能够获得稳定可靠的工具调用体验。