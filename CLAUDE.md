### 🔄 Claude Code Output Router - 项目架构指南

#### 🏗️ 项目概述
- **Claude Code Output Router** - 结构化设计的路由转换器，支持多格式、多供应商的模型路由
- **模块化设计**: 输入格式模块 → 模型路由模块 → 输出格式模块 → 提供商模块
- **Development Port: 3456, Production Port: 3457** - 分别用于开发和生产环境
- **环境变量劫持**: 通过ANTHROPIC_BASE_URL和ANTHROPIC_API_KEY将Claude Code路由到本地路由器

#### 🧱 核心架构模块

##### 1. 输入格式模块 (Input Format Module)
- **支持格式**: OpenAI, Anthropic, Gemini
- **当前实现**: Anthropic模块 (其余Mock实现)
- **默认限制**: 每个输入模块只支持一个实例
- **主要路由**: 
  - `anthropic <-> anthropic`
  - `anthropic <-> openai` 
  - `anthropic <-> gemini`

##### 2. 模型路由模块 (Model Routing Module)
- **路由依据**: 输入模型的细分类别
- **支持类别**: default, background, thinking, longcontext, search
- **输入模型**: Claude 4, Claude 3.7
- **配置参考**: `../claude-code-router`配置

##### 3. 输出格式模块 (Output Format Module)
- **Anthropic格式**: AWS CodeWhisperer (参考 `../kiro2cc`)
- **OpenAI格式**: 第三方Shuaihong (参考 `~/.claude-code-router/config.json`)
- **负载均衡**: 支持同一路由多个供应商实例的负载均衡
- **动态轮询**: CodeWhisperer多token配置时支持动态轮询

##### 4. 提供商模块 (Provider Module)
- **CodeWhisperer**: AWS提供商 (参考 `../kiro2cc` 实现)
- **Shuaihong**: 第三方OpenAI格式提供商
- **多实例支持**: 每个输出可配置多个实例
- **认证管理**: 启动时验证token，支持多token轮询

#### 🔧 开发规范

##### 代码结构要求 (基于Demo参考实现)
- **Demo1参考**: 模型分层基础概念，路由逻辑，服务管理
- **Demo2参考**: CodeWhisperer完整实现，格式转换，SSE解析
- **文件长度限制**: 单文件不超过500行代码
- **四层架构设计**: 
  ```
  src/
  ├── input/          # 输入格式模块 (基于demo1概念)
  │   ├── anthropic/  # Anthropic格式处理 (当前实现)
  │   ├── openai/     # OpenAI格式处理 (Mock)
  │   └── gemini/     # Gemini格式处理 (Mock)
  ├── routing/        # 模型路由模块 (基于demo1的router.ts)
  │   ├── index.ts    # 路由主逻辑
  │   ├── rules.ts    # 路由规则 (default,background,thinking,longcontext,search)
  │   └── custom.ts   # 自定义路由支持
  ├── output/         # 输出格式模块 (基于demo1的transformer概念)
  │   ├── anthropic/  # Anthropic格式输出
  │   └── openai/     # OpenAI格式输出
  └── providers/      # 提供商模块 (基于demo2的完整实现)
      ├── codewhisperer/  # AWS CodeWhisperer (基于demo2)
      │   ├── auth.ts     # Token管理 (demo2的token逻辑)
      │   ├── converter.ts # 格式转换 (demo2的buildCodeWhispererRequest)
      │   ├── parser.ts   # SSE解析 (demo2的sse_parser.go移植)
      │   └── client.ts   # HTTP客户端
      └── shuaihong/      # 第三方OpenAI提供商
  ```

##### Hook系统设计
- **调试日志**: `--debug` 参数启用完整链路日志保存
- **数据注入**: 支持任意节点的数据注入和模拟测试
- **测试流水线**: 节点级双向测试设计
- **本地保存**: 每个阶段输入输出的本地log保存

#### 🚀 启动和部署

##### 启动机制
- **一键启动**: 本地服务器和Claude Code按顺序启动
- **端口管理**: 启动时自动杀掉占用端口的进程
- **多实例处理**: 最后启动的服务器替代前面的实例
- **对话ID**: 每次对话有独立ID，不受实例替换影响

##### 发布渠道
- **NPM**: 包管理和分发
- **GitHub**: 源码管理和版本控制

#### 🧪 测试策略
- **节点测试**: 每个模块独立测试
- **模拟数据**: 使用模拟数据进行链路测试
- **双向测试**: 输入输出双向验证
- **实地测试**: 完整链路端到端测试

#### 📝 配置管理
- **环境变量**: ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY
- **路由配置**: 模型到供应商的映射关系
- **负载均衡**: 多实例轮询配置
- **认证配置**: 各供应商的token管理

#### 🔍 调试和监控
- **Debug模式**: `--debug` 启用详细日志
- **链路追踪**: 完整请求响应链路记录
- **性能监控**: 各节点处理时间统计
- **错误处理**: 优雅的错误处理和恢复机制

### 📚 开发注意事项
- **参考实现**: 基于 `../kiro2cc` 进行模块化重构
- **配置兼容**: 兼容现有 `~/.claude-code-router/config.json` 配置
- **渐进开发**: 先实现核心功能，再完善负载均衡等高级特性
- **测试优先**: 在实地测试前完成完整的测试用例设计

# 编程规范：细菌式编程
- **小巧（Small）**: 单文件不超过500行代码，每一行代码都有明确目的，杜绝不必要的膨胀
- **模块化（Modular）**: 功能被组织成可插拔的模块（四层架构设计），不同功能单元可以被轻松组合或替换
- **自包含（Self-contained）**: 模块间通过标准接口交互，支持"水平基因转移"式的模块复用，无需理解整个系统上下文

# 项目所有权
- **新文件声明**: 所有新创建文件的项目所有者为 Jason Zhang

# 调试规则（项目适用）
## 🧪 调试前置检查
1. **先检查项目CLAUDE.md和./test目录下的调试进度md文件**: 每次调试前必须先查看项目中的调试规则和已知问题
2. **查看相关测试记录**: 检查项目`test/`目录下相关问题的调试历史记录

## 测试文件组织规则  
1. **统一目录**: 所有测试脚本放在项目根目录的`test/`文件夹下
2. **功能分类**: 按调试功能区分脚本命名
3. **禁止重复**: 如已有相似功能测试脚本，必须修改现有脚本，不允许创建新脚本
4. **记录进展**: 使用`test-[问题关键字]-[YYYYMMDD]-[HHMM].md`格式记录调试发现

## 🔄 标准流程基础测试 (STD-6-STEP-PIPELINE)
**适用场景**: 在正确获得响应之前，这是标准的测试流程，必须按顺序执行

### 📋 六步测试流程

#### Step 1: `test-step1-input-processing.js`
- **目标**: 测试完整的API请求链路通畅性
- **输入**: 原始Anthropic API请求 (model, messages, max_tokens)
- **输出**: 完整API响应数据 → 保存到 `step1-output.json`
- **验证点**: 
  - 请求是否成功发送
  - 是否收到响应
  - 响应格式是否正确
- **失败指示**: API链路中断、服务器错误、网络问题

#### Step 2: `test-step2-routing.js`
- **目标**: 验证模型路由逻辑正确性
- **输入**: `step1-output.json` 的请求和响应数据
- **输出**: 路由分析结果 → 保存到 `step2-output.json`
- **验证点**:
  - 输入模型是否正确识别类别 (default/background/thinking/longcontext/search)
  - 是否路由到正确的provider (codewhisperer-primary/shuaihong-openai)
  - 是否映射到正确的目标模型 (gpt-4o/gemini-2.5-flash/etc)
- **失败指示**: 路由规则错误、模型映射失败、provider选择错误

#### Step 3: `test-step3-transformation.js`
- **目标**: 单独验证transformer转换逻辑
- **输入**: `step2-output.json` 的路由数据
- **输出**: 转换测试结果 → 保存到 `step3-output.json`
- **验证点**:
  - Anthropic请求 → OpenAI请求转换是否正确
  - 模拟OpenAI响应 → Anthropic响应转换是否正确
  - content字段是否正确生成
  - tools/tool_calls转换是否正确
- **失败指示**: Transformer逻辑错误、格式转换失效、内容丢失

#### Step 4: `test-step4-raw-api-response.js`
- **目标**: 直接测试真实的第三方API响应
- **输入**: Step2的路由结果 (确定调用哪个真实API)
- **输出**: 原始第三方API响应 → 保存到 `step4-output.json`
- **验证点**:
  - 第三方API是否可达
  - 是否返回有效响应
  - 响应格式是否符合OpenAI标准
  - content字段是否有实际内容
- **失败指示**: API服务不可用、认证失败、响应格式错误、空内容

#### Step 5: `test-step5-transformer-input.js`
- **目标**: 验证transformer接收到的真实数据
- **输入**: `step4-output.json` 的真实API响应
- **输出**: Transformer实际接收数据 → 保存到 `step5-output.json`
- **验证点**:
  - 数据是否正确传递到transformer
  - 数据结构是否完整
  - 关键字段 (choices, message, content) 是否存在
- **失败指示**: 数据传递中断、结构损坏、字段缺失

#### Step 6: `test-step6-transformer-output.js`
- **目标**: 测试transformer的实际转换输出
- **输入**: `step5-output.json` 的transformer输入数据
- **输出**: Transformer转换结果 → 保存到 `step6-output.json`
- **验证点**:
  - 转换逻辑是否正确执行
  - content数组是否正确构建
  - text内容是否正确提取
  - usage信息是否正确计算
- **失败指示**: 转换逻辑错误、内容丢失、格式错误

#### Step 7: `test-step7-final-response.js`
- **目标**: 验证最终响应构建过程
- **输入**: `step6-output.json` 的转换结果
- **输出**: 最终API响应格式 → 保存到 `step7-output.json`
- **验证点**:
  - BaseResponse格式是否正确
  - 所有必需字段是否完整
  - 响应是否符合Anthropic API规范
- **失败指示**: 响应构建错误、字段映射失败、格式不符合规范

### 🎯 数据流验证链条
```
请求端: Step1 → Step2 → Step3 (请求处理验证)
         ↓
API调用: Step4 (第三方API验证)
         ↓  
响应端: Step5 → Step6 → Step7 (响应处理验证)
```

### 📊 问题定位策略
- **Step1失败**: 基础服务问题 (端口、路由、服务器)
- **Step2失败**: 路由配置问题 (规则、映射、provider配置)
- **Step3失败**: Transformer设计问题 (逻辑、接口、格式定义)
- **Step4失败**: 第三方API问题 (服务、认证、网络)
- **Step5失败**: 数据传递问题 (接口、序列化、结构)
- **Step6失败**: Transformer实现问题 (代码、算法、边界情况)
- **Step7失败**: 响应构建问题 (映射、格式、规范)

### 🚀 执行规范
1. **顺序执行**: 必须按Step1→Step7顺序执行，每步依赖前一步的输出
2. **数据保存**: 每步都必须保存输出到JSON文件供下一步使用
3. **失败终止**: 任何一步失败必须先修复再继续下一步
4. **完整记录**: 所有步骤的输入输出必须记录到调试日志中

## 分离式调试原则
1. **流水线分段**: 对于长流水线问题，使用STD-6-STEP-PIPELINE标准测试流程
2. **问题定位**: 明确每个测试脚本的作用范围和预期结果
3. **阶段验证**: 确定问题出现在哪个具体阶段
4. **脚本映射**: 明确应该使用哪个测试脚本来验证特定问题

## 测试脚本命名规范
- `test-step[N]-[功能描述].js` - 流水线分段测试
- `test-[组件名]-[功能].js` - 组件功能测试  
- `debug-[问题域].js` - 问题诊断脚本
- 示例：
  - `test-anthropic-input.js` - Anthropic输入模块测试
  - `test-routing-rules.js` - 路由规则测试
  - `test-codewhisperer-auth.js` - CodeWhisperer认证测试
  - `debug-sse-parsing.js` - SSE解析问题诊断

## 调试记录规范
- **文件命名**: `test-[问题关键字]-[YYYYMMDD]-[HHMM].md`
- **必含内容**: 问题描述、测试方法、发现结果、解决方案
- **更新机制**: 遇到相关问题时必须先阅读相关记录文件

# 启动脚本规范
## 统一脚本集合
- **完整开发流程**: `./fix-and-test.sh` (构建+启动+测试一体化)
- **开发模式启动**: `./start-dev.sh` (自动构建+启动服务+日志记录)
- **单独构建**: `./build.sh` (清理和构建项目)
- **测试套件**: `./test-all.sh` (完整测试，包括API和transformer验证)
- **本地安装**: `./install-local.sh` (构建+打包+全局安装)

## 端口管理
- **Development Port**: 3456 (主要API端点)
- **Production Port**: 3457 (生产环境)
- **日志监控**: `/tmp/ccr-dev.log`
- **启动脚本端口管理**: 自动监控端口冲突，直接关闭并继续启动，无需人工确认

## 服务管理
- **状态检查**: `node dist/cli.js status`
- **服务监控**: `tail -f /tmp/ccr-dev.log`
- **多实例处理**: 最后启动的服务器替代前面的实例
- **对话ID**: 每次对话有独立ID，不受实例替换影响

# 构建规则
- **完整构建必须成功**: 不使用fallback机制，不手动操作
- **依赖解析**: 必须解决所有外部依赖和workspace包依赖
- **Clean安装验证**: 每次构建后必须验证clean环境下的npm全局安装成功
- **esbuild配置**: 包含完整的external依赖列表和workspace解析
- **构建流程**: 1)修复依赖 2)完整构建 3)npm pack测试 4)clean安装验证

# 发布与提交规则
- **用户确认**: npm和github提交必须要用户确认才可以，禁止自主发布
- **命令脚本化**: 频繁调用的命令请构建脚本，不用等待用户每次批准
- **三次规则**: 一条命令在一个对话里面被调用三次以上就请写成脚本，脚本命名要显而易见

# 安全配置规则
- **环境保护**: 不允许覆盖~/.gemini/.env等全局配置
- **无fallback**: 不允许使用fallback机制，确保构建的完整性