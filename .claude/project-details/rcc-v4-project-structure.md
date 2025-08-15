# RCC v4.0 项目结构

## 完整目录结构

```
route-claude-code/
├── .claude/
│   └── project-details/
│       ├── v3-architecture-overview.md      # 旧版架构文档
│       ├── rcc-v4-specification.md          # v4.0规格书
│       ├── rcc-v4-detailed-design.md        # v4.0详细设计
│       └── rcc-v4-project-structure.md      # 项目结构文档
├── src/
│   ├── types/
│   │   └── index.ts                         # 核心类型定义
│   ├── client/                              # 客户端模块
│   │   ├── README.md                        # 客户端模块文档
│   │   ├── index.ts                         # 客户端模块入口
│   │   ├── cli/                             # CLI命令系统
│   │   │   ├── cli-server.ts                # Server模式CLI
│   │   │   ├── cli-client.ts                # Client模式CLI
│   │   │   ├── cli-manager.ts               # CLI管理器
│   │   │   └── process-manager.ts           # 进程管理器
│   │   ├── server-manager.ts                # HTTP服务器管理
│   │   ├── session-extractor.ts             # 会话提取器
│   │   ├── session-manager.ts               # 会话管理器
│   │   └── error-handler.ts                 # 错误处理
│   ├── router/                              # 路由器模块
│   │   ├── README.md                        # 路由器模块文档
│   │   ├── index.ts                         # 路由器模块入口
│   │   ├── router-manager.ts                # 路由器管理器
│   │   ├── config-manager.ts                # 配置管理
│   │   ├── request-router.ts                # 请求路由
│   │   ├── pipeline-manager.ts              # 流水线管理
│   │   └── session-flow-controller.ts       # 会话流控管理器
│   ├── pipeline/                            # 流水线Worker模块
│   │   ├── README.md                        # 流水线模块文档
│   │   ├── index.ts                         # 流水线模块入口
│   │   ├── pipeline-framework.ts            # 流水线框架
│   │   └── modules/                         # 流水线子模块
│   │       ├── transformer/                 # Transformer模块
│   │       │   ├── index.ts                 # Transformer入口
│   │       │   ├── transformer-module.ts    # 基础Transformer类
│   │       │   ├── openai-transformer.ts    # OpenAI转换器
│   │       │   └── anthropic-transformer.ts # Anthropic转换器(待实现)
│   │       ├── transformer.ts               # Transformer模块主类
│   │       ├── protocol.ts                  # Protocol模块
│   │       ├── server-compatibility.ts      # Server-Compatibility模块
│   │       └── server.ts                    # Server模块
│   ├── debug/                               # Debug系统
│   │   ├── README.md                        # Debug系统文档
│   │   ├── index.ts                         # Debug系统入口
│   │   ├── debug-manager.ts                 # Debug管理器
│   │   ├── debug-recorder.ts                # Debug记录器
│   │   └── replay-system.ts                 # 回放系统
│   ├── __tests__/                           # 测试文件
│   │   └── integration.test.ts              # 集成测试
│   ├── cli.ts                               # CLI入口文件
│   └── index.ts                             # 主入口文件
├── dist/                                    # 编译输出目录
├── coverage/                                # 测试覆盖率报告
├── node_modules/                            # 依赖包
├── package.json                             # 项目配置
├── tsconfig.json                            # TypeScript配置
├── jest.config.js                           # Jest测试配置
├── config.example.json                      # 示例配置文件
└── README.md                                # 项目说明文档
```

## 运行时目录结构

```
~/.route-claudecode/
├── config/                                  # 配置目录
│   ├── providers.json                       # Provider配置
│   ├── routing.json                         # 路由配置
│   ├── blacklist.json                       # 模型黑名单
│   ├── long-context-whitelist.json          # 长上下文白名单
│   └── generated/                           # 动态生成的配置
│       ├── routing-table.json               # 生成的路由表
│       └── provider-status.json             # Provider状态
├── debug/                                   # Debug记录目录
│   ├── port-3456/                          # 按端口分组
│   │   ├── session-2024-08-15_14-30-22/    # 按会话分组(可读时间)
│   │   │   ├── requests/                    # 请求记录
│   │   │   │   ├── req_2024-08-15_14-30-22_001.json # 单个请求记录
│   │   │   │   └── ...
│   │   │   ├── pipelines/                   # 流水线记录
│   │   │   │   ├── openai_gpt-4/           # 按流水线分组
│   │   │   │   │   ├── pipeline_2024-08-15_14-30-22_001.json
│   │   │   │   │   └── ...
│   │   │   │   └── deepseek_chat/
│   │   │   ├── session.json                # 会话信息(包含可读时间)
│   │   │   └── summary.json                # 会话摘要
│   │   └── ...
│   ├── port-8080/                          # 其他端口
│   └── current/                             # 当前活跃会话软链接
│       ├── port-3456 -> ../port-3456/session-2024-08-15_14-30-22/
│       └── port-8080 -> ../port-8080/session-2024-08-15_15-45-10/
└── logs/                                    # 日志目录(按端口分组)
    ├── port-3456/                          # 端口3456的日志
    │   ├── client-2024-08-15_14-30-22.log      # 客户端日志
    │   ├── router-2024-08-15_14-30-22.log      # 路由器日志
    │   ├── pipeline-2024-08-15_14-30-22.log    # 流水线日志
    │   ├── debug-2024-08-15_14-30-22.log       # Debug系统日志
    │   ├── error-2024-08-15_14-30-22.log       # 错误日志
    │   ├── access-2024-08-15_14-30-22.log      # 访问日志
    │   └── performance-2024-08-15_14-30-22.log # 性能日志
    ├── port-8080/                          # 端口8080的日志
    └── current/                             # 当前活跃日志软链接
        ├── port-3456 -> ../port-3456/
        └── port-8080 -> ../port-8080/
```

## 核心文件说明

### 配置文件
- `package.json` - 项目依赖和脚本配置
- `tsconfig.json` - TypeScript编译配置
- `jest.config.js` - 测试框架配置
- `config.example.json` - 示例配置文件

### 核心模块
- `src/types/index.ts` - 全局类型定义
- `src/cli.ts` - CLI入口点
- `src/index.ts` - 库入口点

### 客户端模块
- `src/client/cli.ts` - CLI命令处理
- `src/client/server-manager.ts` - HTTP服务器管理
- `src/client/error-handler.ts` - 统一错误处理

### 路由器模块
- `src/router/router-manager.ts` - 路由器主管理器
- `src/router/config-manager.ts` - 配置文件管理
- `src/router/request-router.ts` - 请求路由逻辑
- `src/router/pipeline-manager.ts` - 流水线生命周期管理

### 流水线模块
- `src/pipeline/pipeline-framework.ts` - 流水线框架
- `src/pipeline/modules/transformer.ts` - 格式转换模块
- `src/pipeline/modules/protocol.ts` - 协议处理模块
- `src/pipeline/modules/server-compatibility.ts` - 服务器兼容模块
- `src/pipeline/modules/server.ts` - 服务器通信模块

### Debug系统
- `src/debug/debug-manager.ts` - Debug系统管理器
- `src/debug/debug-recorder.ts` - 数据记录器
- `src/debug/replay-system.ts` - 回放测试系统

## 构建和运行

### 开发环境
```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建项目
npm run build

# 运行测试
npm test

# 监听测试
npm run test:watch
```

### 生产环境
```bash
# 全局安装
npm install -g route-claude-code

# 启动服务器
rcc start

# 导出环境变量
rcc code --port

# 查看状态
rcc status

# 停止服务器
rcc stop
```

## 开发规范

### 模块边界
1. **严格模块化**：每个模块只能在职责范围内工作
2. **接口通信**：模块间只能通过定义的接口通信
3. **不允许跨模块**：不能直接调用其他模块的内部方法

### 错误处理
1. **不允许静默失败**：所有错误必须抛出
2. **统一错误格式**：使用RCCError类型
3. **完整错误链**：保持错误追踪链完整

### 测试要求
1. **真实流水线测试**：不允许mockup测试
2. **集成测试优先**：重点测试模块间集成
3. **Debug回放测试**：利用Debug系统进行回放测试

### 代码质量
1. **TypeScript严格模式**：启用所有严格检查
2. **完整类型定义**：所有接口都有完整类型
3. **文档完整性**：每个模块都有README文档

## 部署架构

### 单机部署
```
Claude Code → RCC Server (localhost:3456) → AI Providers
```

### 分布式部署（未来）
```
Claude Code → Load Balancer → Multiple RCC Instances → AI Providers
```

## 监控和调试

### Debug系统
- 全局debug开关控制
- 按流水线分组记录
- 支持实时回放测试

### 日志系统
- 分模块日志记录
- 结构化日志格式
- 日志轮转和清理

### 性能监控
- 请求处理时间统计
- 流水线性能分析
- 资源使用监控

这个项目结构完全符合你提出的模块化设计要求，每个模块职责清晰，边界明确，支持真实流水线测试和完整的错误处理机制。