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

## 分离式调试原则
1. **流水线分段**: 对于长流水线问题，建立不同阶段的独立测试脚本
   - `test-step1-输入格式解析.js` - 测试Anthropic输入格式处理
   - `test-step2-路由决策.js` - 测试模型路由逻辑
   - `test-step3-输出格式转换.js` - 测试格式转换
   - `test-step4-供应商调用.js` - 测试CodeWhisperer/OpenAI调用
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