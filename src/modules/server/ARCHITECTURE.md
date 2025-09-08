/**
 * HTTP服务器模块架构文档
 * 
 * 描述HTTP服务器模块的组件架构和设计原则
 * 
 * @author RCC v4.0
 */

/**
 * 模块架构概述
 * 
 * HTTP服务器模块采用组件化设计，将功能拆分为多个独立的组件：
 * 
 * 1. HTTPServer (主类)
 *    - 负责服务器的启动、停止和生命周期管理
 *    - 组合所有其他组件
 *    - 处理服务器级别的配置和状态管理
 * 
 * 2. HTTPContextManager
 *    - 负责HTTP请求/响应上下文的创建和管理
 *    - 处理请求体解析和响应发送
 *    - 生成请求ID和时间戳等上下文信息
 * 
 * 3. HTTPRoutingSystemImpl
 *    - 负责路由注册、匹配和执行
 *    - 支持多种HTTP方法和路径匹配
 *    - 提供路由统计和管理功能
 * 
 * 4. HTTPRequestHandlersImpl
 *    - 处理内置路由请求（健康检查、状态、版本等）
 *    - 提供服务器状态查询功能
 *    - 管理健康检查和性能监控
 * 
 * 5. AnthropicMessageHandlerImpl
 *    - 专门处理Anthropic格式的messages请求
 *    - 与流水线系统集成，执行模型调用
 *    - 处理调试信息和错误记录
 * 
 * 6. HTTPErrorCenter
 *    - 负责HTTP错误响应的生成和处理
 *    - 与错误处理系统协同工作
 *    - 提供错误统计和监控功能
 * 
 * 设计原则：
 * 1. 单一职责原则：每个组件只负责一个特定功能领域
 * 2. 组合优于继承：HTTPServer通过组合其他组件实现功能
 * 3. 接口隔离：组件之间通过明确定义的接口交互
 * 4. 零接口暴露：内部实现细节不对外暴露
 * 5. 可测试性：每个组件都可以独立测试
 * 
 * 使用示例：
 * 
 * // 创建服务器实例
 * const config = { port: 5506, host: '0.0.0.0' };
 * const server = new HTTPServer(config);
 * 
 * // 启动服务器
 * await server.start();
 * 
 * // 集成流水线
 * server.setPipelines(pipelineArray, true);
 * 
 * // 获取状态
 * const status = server.getStatus();
 * 
 * 组件间交互：
 * 
 * HTTPServer
 * ├── HTTPContextManager (请求/响应处理)
 * ├── HTTPRoutingSystemImpl (路由管理)
 * ├── HTTPRequestHandlersImpl (内置请求处理)
 * ├── AnthropicMessageHandlerImpl (Anthropic消息处理)
 * └── HTTPErrorCenter (错误处理)
 */