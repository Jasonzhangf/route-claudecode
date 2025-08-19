# RCC v4.0 模块化路由代理系统 - 需求文档

## 项目介绍

RCC (Route Claude Code) v4.0 是一个完全重构的模块化路由代理系统，用于将Claude Code的请求智能路由到不同的AI服务提供商。系统采用严格的模块化架构，每个模块职责单一，支持动态流水线管理、完整的调试系统和真实流水线测试。

## 模块设计基本要求

1. **功能不重叠**: 每个模块的功能彼此不覆盖，职责单一明确
2. **标准接口**: 模块间通过标准接口连接，不允许直接调用内部方法
3. **物理隔离**: 每个模块物理上存在于独立的文件夹中
4. **文档完整**: 每个模块文件夹内必须有README说明功能和接口
5. **数据校验**: 每个模块的输入输出都有标准的数据校验方式
6. **错误处理**: 输入输出有问题时第一时间调用error handler处理
7. **禁止Mockup**: 严禁mockup响应，这是最高优先级要求

## 模块交付检查标准

每个模块完成交付时必须通过以下检查：
- ✅ 是否有静默失败？（必须无静默失败）
- ✅ 是否有mockup响应？（必须无mockup响应）
- ✅ 是否有重复代码？（必须无重复代码）
- ✅ 是否有硬编码实现？（必须无硬编码实现）

## 需求

### 需求 1: 客户端模块

**用户故事**: 作为开发者，我希望通过简单的CLI命令来管理路由服务器，以便能够快速启动、停止和监控系统状态。

#### 验收标准

1. WHEN 用户执行 `rcc start` THEN 系统 SHALL 启动路由服务器并监听指定端口
2. WHEN 用户执行 `rcc stop` THEN 系统 SHALL 优雅地停止服务器并清理资源
3. WHEN 用户执行 `rcc code --port` THEN 系统 SHALL 输出Claude Code所需的环境变量
4. WHEN 用户执行 `rcc status` THEN 系统 SHALL 显示服务器运行状态和活跃流水线数量
5. WHEN 系统发生任何错误 THEN 客户端模块 SHALL 使用标准API error handler生成错误响应并显示用户友好的错误信息
6. WHEN 错误发生 THEN 系统 SHALL NOT 静默失败，必须通过标准API error handler向用户报告
7. WHEN 客户端模块存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明模块功能和接口定义
8. WHEN 客户端模块接收输入 THEN 系统 SHALL 进行标准数据校验，校验失败时立即调用error handler
9. WHEN 客户端模块实现 THEN 系统 SHALL NOT 包含任何mockup响应、静默失败、重复代码或硬编码实现

### 需求 2: 路由器模块

**用户故事**: 作为系统管理员，我希望通过配置文件来定义路由规则和供应商信息，以便灵活地管理不同AI服务的负载均衡。

#### 验收标准

1. WHEN 系统启动 THEN 路由器模块 SHALL 读取 `~/.route-claudecode/config` 下的配置文件
2. WHEN 配置文件更新 THEN 系统 SHALL 自动重新加载配置并更新路由表
3. WHEN 接收到请求 THEN 路由器 SHALL 根据请求内容智能分类（default/think/longContext/background）
4. WHEN 进行路由选择 THEN 系统 SHALL 根据权重进行负载均衡
5. WHEN provider.model.availability为false THEN 系统 SHALL 自动从路由中排除该流水线
6. WHEN 生成路由表 THEN 系统 SHALL 将结果保存到 `~/.route-claudecode/config/generated/` 目录
7. WHEN 路由器模块发生错误 THEN 系统 SHALL 使用标准API error handler生成错误响应
8. WHEN 路由器模块存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明路由逻辑和配置接口
9. WHEN 路由器模块处理请求 THEN 系统 SHALL 对输入进行标准数据校验，校验失败时立即调用error handler
10. WHEN 路由器模块实现 THEN 系统 SHALL NOT 包含任何mockup响应、静默失败、重复代码或硬编码路由规则

### 需求 3: 流水线Worker系统

**用户故事**: 作为系统架构师，我希望每个provider.model组合都有独立的处理流水线，以便实现完全隔离的请求处理和动态管理。

#### 验收标准

1. WHEN 系统初始化 THEN 流水线管理器 SHALL 为每个可用的provider.model创建独立流水线
2. WHEN provider.model.availability变为false THEN 系统 SHALL 动态销毁对应的流水线
3. WHEN 流水线处理请求 THEN 数据 SHALL 依次通过transformer→protocol→server-compatibility→server模块
4. WHEN 任何模块处理失败 THEN 流水线 SHALL 使用标准API error handler立即生成错误响应并停止处理
5. WHEN 模块间传递数据 THEN 系统 SHALL 验证数据格式的正确性
6. WHEN 流水线销毁 THEN 系统 SHALL 完全清理所有相关资源
7. WHEN 流水线模块发生错误 THEN 系统 SHALL 使用标准API error handler填入模块名和详细错误信息
8. WHEN 流水线模块存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明流水线架构和模块接口
9. WHEN 流水线模块间通信 THEN 系统 SHALL 通过标准接口连接，不允许直接调用内部方法
10. WHEN 流水线模块实现 THEN 系统 SHALL NOT 包含任何mockup响应、静默失败、重复代码或硬编码流水线逻辑

### 需求 4: Transformer模块

**用户故事**: 作为API集成开发者，我希望系统能够自动转换Anthropic格式和目标协议格式，以便支持不同的AI服务提供商。

#### 验收标准

1. WHEN 接收Anthropic请求 THEN transformer SHALL 验证请求格式符合Anthropic标准
2. WHEN 转换请求格式 THEN transformer SHALL 将Anthropic格式转换为目标协议格式
3. WHEN 处理响应 THEN transformer SHALL 将目标协议响应转换回Anthropic格式
4. WHEN 格式验证失败 THEN transformer SHALL 使用标准API error handler抛出VALIDATION_ERROR错误
5. WHEN 支持工具调用 THEN transformer SHALL 正确转换工具调用格式
6. WHEN 处理流式响应 THEN transformer SHALL 保持流式特性
7. WHEN transformer模块失败 THEN 系统 SHALL 使用标准API error handler生成包含模块名"transformer"和详细错误信息的API错误响应
8. WHEN transformer模块存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明转换逻辑和支持的协议格式
9. WHEN transformer模块处理数据 THEN 系统 SHALL 对输入输出进行标准数据校验，校验失败时立即调用error handler
10. WHEN transformer模块实现 THEN 系统 SHALL NOT 包含任何mockup转换、静默失败、重复转换代码或硬编码协议格式

### 需求 5: Protocol模块

**用户故事**: 作为协议处理专家，我希望系统能够处理流式和非流式请求的转换，以便适配不同的协议要求。

#### 验收标准

1. WHEN 接收流式请求 THEN protocol模块 SHALL 转换为非流式请求发送给下游
2. WHEN 接收非流式响应 THEN protocol模块 SHALL 转换为流式响应返回上游
3. WHEN 验证协议格式 THEN 系统 SHALL 根据协议类型进行相应的格式检查
4. WHEN 协议验证失败 THEN 模块 SHALL 使用标准API error handler抛出VALIDATION_ERROR错误
5. WHEN 处理OpenAI协议 THEN 系统 SHALL 验证model和messages字段存在
6. WHEN 处理Anthropic协议 THEN 系统 SHALL 验证messages数组格式正确
7. WHEN protocol模块处理失败 THEN 系统 SHALL 使用标准API error handler生成包含模块名"protocol"和协议类型的错误响应
8. WHEN protocol模块存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明协议处理逻辑和支持的协议类型
9. WHEN protocol模块处理协议转换 THEN 系统 SHALL 对输入输出进行标准数据校验，校验失败时立即调用error handler
10. WHEN protocol模块实现 THEN 系统 SHALL NOT 包含任何mockup协议处理、静默失败、重复协议代码或硬编码协议规则

### 需求 6: Server-Compatibility模块

**用户故事**: 作为第三方服务集成者，我希望系统能够处理不同AI服务商的API差异，特别是OpenAI的各种变种和扩展。

#### 验收标准

1. WHEN 处理OpenAI兼容服务 THEN 模块 SHALL 确保工具调用格式符合OpenAI标准
2. WHEN 处理DeepSeek服务 THEN 模块 SHALL 自动设置tool_choice为auto优化工具使用
3. WHEN 处理Anthropic服务 THEN 模块 SHALL 将system消息转换为特殊格式
4. WHEN 处理Gemini服务 THEN 模块 SHALL 转换消息格式和生成配置
5. WHEN 适配响应格式 THEN 模块 SHALL 将各服务商响应统一为标准格式
6. WHEN 遇到未知服务类型 THEN 模块 SHALL 返回原始请求不做修改
7. WHEN server-compatibility模块失败 THEN 系统 SHALL 使用标准API error handler生成包含模块名"server-compatibility"和服务器类型的错误响应
8. WHEN server-compatibility模块存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明兼容性处理逻辑和支持的服务商
9. WHEN server-compatibility模块处理适配 THEN 系统 SHALL 对输入输出进行标准数据校验，校验失败时立即调用error handler
10. WHEN server-compatibility模块实现 THEN 系统 SHALL NOT 包含任何mockup适配、静默失败、重复适配代码或硬编码服务商配置

### 需求 7: Server模块

**用户故事**: 作为网络通信开发者，我希望系统优先使用官方SDK，并在SDK不可用时回退到HTTP客户端，以便确保最佳的兼容性和性能。

#### 验收标准

1. WHEN 支持OpenAI服务 THEN 系统 SHALL 使用官方OpenAI SDK而不是axios实现
2. WHEN 支持LMStudio服务 THEN 系统 SHALL 使用官方LMStudio SDK而不是axios实现
3. WHEN 支持Anthropic服务 THEN 系统 SHALL 使用官方Anthropic SDK而不是axios实现
4. WHEN 支持Ollama服务 THEN 系统 SHALL 使用官方Ollama SDK而不是axios实现
5. WHEN 支持Gemini服务 THEN 系统 SHALL 使用官方Gemini SDK而不是axios实现
6. WHEN 官方SDK不可用 THEN 系统 SHALL 回退到HTTP客户端并记录警告
7. WHEN 使用官方SDK THEN 模块文件夹内 SHALL 保存对应的官方SDK文档
8. WHEN 进行认证 THEN 系统 SHALL 根据服务商要求设置正确的认证头
9. WHEN 健康检查 THEN 模块 SHALL 发送轻量级请求验证服务可用性
10. WHEN 网络请求失败 THEN 模块 SHALL 使用标准API error handler抛出NETWORK_ERROR错误
11. WHEN server模块处理失败 THEN 系统 SHALL 使用标准API error handler生成包含模块名"server"、服务器类型和baseUrl的错误响应
12. WHEN server模块存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明网络通信逻辑、支持的SDK和官方SDK文档
13. WHEN server模块处理网络请求 THEN 系统 SHALL 对输入输出进行标准数据校验，校验失败时立即调用error handler
14. WHEN server模块实现 THEN 系统 SHALL NOT 包含任何mockup网络请求、静默失败、重复网络代码或硬编码API端点

### 需求 8: Debug系统

**用户故事**: 作为系统调试专家，我希望有完整的调试和回放系统，以便能够记录、分析和重现系统的运行状态。

#### 验收标准

1. WHEN 流水线注册 THEN Debug系统 SHALL 自动为其启用调试记录
2. WHEN 处理请求 THEN 系统 SHALL 记录每个模块的输入输出数据
3. WHEN 发生错误 THEN Debug系统 SHALL 记录完整的错误信息和堆栈
4. WHEN 保存记录 THEN 系统 SHALL 按端口和会话组织存储结构
5. WHEN 执行回放 THEN 系统 SHALL 能够重现原始请求的处理过程
6. WHEN 生成单元测试 THEN 系统 SHALL 基于Debug记录创建可执行的测试代码
7. WHEN Debug系统发生错误 THEN 系统 SHALL 使用标准API error handler生成包含模块名"debug"的错误响应
8. WHEN Debug系统存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明调试功能和回放机制
9. WHEN Debug系统处理记录 THEN 系统 SHALL 对输入输出进行标准数据校验，校验失败时立即调用error handler
10. WHEN Debug系统实现 THEN 系统 SHALL NOT 包含任何mockup调试、静默失败、重复调试代码或硬编码调试路径

### 需求 9: 配置系统

**用户故事**: 作为配置管理员，我希望通过JSON配置文件来管理所有的供应商和路由规则，以便实现灵活的系统配置。

#### 验收标准

1. WHEN 首次运行 THEN 系统 SHALL 创建默认的配置文件结构
2. WHEN 配置文件格式错误 THEN 系统 SHALL 使用标准API error handler抛出CONFIG_ERROR并指出具体错误
3. WHEN 环境变量存在 THEN 系统 SHALL 自动替换配置中的${VAR_NAME}占位符
4. WHEN 配置验证 THEN 系统 SHALL 检查所有必需字段的存在性和格式正确性
5. WHEN 动态重载配置 THEN 系统 SHALL 不中断现有请求的处理
6. WHEN 配置文件监听 THEN 系统 SHALL 自动检测文件变化并重新加载
7. WHEN 配置系统发生错误 THEN 系统 SHALL 使用标准API error handler生成包含模块名"config-manager"的错误响应
8. WHEN 配置系统存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明配置格式和验证规则
9. WHEN 配置系统处理配置 THEN 系统 SHALL 对输入输出进行标准数据校验，校验失败时立即调用error handler
10. WHEN 配置系统实现 THEN 系统 SHALL NOT 包含任何mockup配置、静默失败、重复配置代码或硬编码配置值

### 需求 10: 标准API Error Handler系统

**用户故事**: 作为API客户端开发者，我希望所有的错误响应都遵循标准的API错误格式，以便能够统一处理各种错误情况。

#### 验收标准

1. WHEN 标准API error handler处理错误 THEN 系统 SHALL 生成包含以下字段的标准错误响应：error.type, error.message, error.module, error.details, error.timestamp
2. WHEN mockup实现需要返回错误 THEN 所有模块 SHALL 使用标准API error handler生成标准错误信息
3. WHEN 客户端接收错误响应 THEN 响应格式 SHALL 符合API规范，确保客户端可以解析和处理
4. WHEN 错误响应包含模块信息 THEN 标准API error handler SHALL 填入具体的模块名（如"transformer", "protocol", "server-compatibility", "server"等）
5. WHEN 生成错误响应 THEN 标准API error handler SHALL 确保不会静默失败，必须返回可识别的错误信息
6. WHEN 不同类型错误发生 THEN 标准API error handler SHALL 根据错误类型设置相应的HTTP状态码（400, 401, 500等）
7. WHEN 错误包含敏感信息 THEN 标准API error handler SHALL 过滤敏感数据，只返回安全的错误信息给客户端
8. WHEN 标准API error handler存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明错误处理标准和响应格式
9. WHEN 标准API error handler处理错误 THEN 系统 SHALL 对输入输出进行标准数据校验，确保错误格式正确
10. WHEN 标准API error handler实现 THEN 系统 SHALL NOT 包含任何mockup错误处理、静默失败、重复错误代码或硬编码错误信息

### 需求 11: 错误处理系统

**用户故事**: 作为系统可靠性工程师，我希望系统有完整的错误处理机制，确保没有静默失败并提供完整的错误追踪。

#### 验收标准

1. WHEN 任何模块发生错误 THEN 系统 SHALL NOT 静默失败
2. WHEN 错误发生 THEN 系统 SHALL 创建包含完整上下文的RCCError对象
3. WHEN 错误传播 THEN 系统 SHALL 保持完整的错误追踪链
4. WHEN 向用户报告错误 THEN 系统 SHALL 提供用户友好的错误信息和解决建议
5. WHEN 记录错误日志 THEN 系统 SHALL 包含模块名、时间戳和详细错误信息
6. WHEN 系统不允许fallback THEN 错误 SHALL 被明确处理而不是被掩盖
7. WHEN 所有错误处理 THEN 系统 SHALL 统一使用标准API error handler确保错误格式一致性
8. WHEN 错误处理系统存在于独立文件夹 THEN 文件夹内 SHALL 包含README说明错误处理机制和追踪链
9. WHEN 错误处理系统处理错误 THEN 系统 SHALL 对输入输出进行标准数据校验，确保错误信息完整
10. WHEN 错误处理系统实现 THEN 系统 SHALL NOT 包含任何mockup错误处理、静默失败、重复错误处理代码或硬编码错误类型

### 需求 12: 模块交付质量保证

**用户故事**: 作为质量保证工程师，我希望每个模块在交付时都通过严格的质量检查，以确保系统的整体可靠性和一致性。

#### 验收标准

1. WHEN 任何模块完成开发 THEN 模块 SHALL 通过静默失败检查，确保无任何静默失败情况
2. WHEN 任何模块完成开发 THEN 模块 SHALL 通过mockup响应检查，确保无任何mockup响应实现
3. WHEN 任何模块完成开发 THEN 模块 SHALL 通过重复代码检查，确保无重复代码实现
4. WHEN 任何模块完成开发 THEN 模块 SHALL 通过硬编码检查，确保无硬编码实现
5. WHEN 模块交付检查失败 THEN 系统 SHALL 使用标准API error handler报告具体的质量问题
6. WHEN 所有模块通过质量检查 THEN 系统 SHALL 确保模块间功能不重叠且通过标准接口连接
7. WHEN 模块部署 THEN 每个模块 SHALL 存在于独立文件夹并包含完整的README文档
8. WHEN 模块运行 THEN 每个模块 SHALL 对输入输出进行标准数据校验并在问题时立即调用error handler