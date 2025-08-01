# 📁 配置管理规则 (Configuration Management Rules)

## 🚨 **强制配置文件查阅规则 (MANDATORY CONFIG CONSULTATION)**

⚠️ **AI模型强制执行指令**:
- **MUST CHECK CONFIG FIRST**: 每次操作前必须先查阅配置文件结构和规则
- **MUST VALIDATE CONFIG PATH**: 必须确认配置文件路径的正确性
- **MUST FOLLOW NAMING RULES**: 必须严格遵循配置文件命名规范
- **NO EXCEPTIONS ALLOWED**: 不允许任何配置规则例外情况

## 🏗️ **配置目录结构标准 (Configuration Directory Standards)**

### 主配置目录 ~/.route-claude-code
```
~/.route-claude-code/           # 项目主配置文件夹
├── config.json                 # 测试环境主配置文件
├── config.release.json         # 生产环境主配置文件 (待创建)
├── config.*.json               # 各种特定配置文件
├── config/                     # 各种组合配置目录 (待创建)
│   ├── delivery-testing/       # 交付测试配置组合
│   ├── single-provider/        # 单Provider配置组合
│   ├── load-balancing/         # 负载均衡配置组合
│   └── production-ready/       # 生产就绪配置组合
├── database/                   # 原始raw码流数据总目录
│   ├── captures/               # 实时数据捕获
│   ├── codewhisperer/          # CodeWhisperer Provider数据
│   ├── gemini/                 # Gemini Provider数据
│   ├── modelscope-openai/      # ModelScope OpenAI Provider数据
│   ├── shuaihong-openai/       # Shuaihong OpenAI Provider数据
│   ├── pipeline-tests/         # 流水线测试数据
│   └── test-sessions/          # 测试会话记录
├── logs/                       # 日志目录
└── auth_files/                 # 认证文件目录
```

## 🔧 **双启动配置要求 (Dual Startup Configuration)**

### 核心配置文件
1. **config.json**: 测试环境配置
   - 用于日常开发和测试
   - 包含测试用的Provider配置
   - 端口: 3456 (开发模式)

2. **config.release.json**: 生产环境配置 (待创建)
   - 用于生产环境部署
   - 包含生产级Provider配置
   - 端口: 3457 (生产模式)
   - 需要更严格的认证和限流配置

### 双启动支持
- **开发启动**: `./rcc start --config ~/.route-claude-code/config.json`
- **生产启动**: `./rcc start --config ~/.route-claude-code/config.release.json`
- **同时启动**: 支持测试和生产环境同时运行，端口隔离

## 📂 **config/ 目录组合配置规范**

### 配置组合分类
```
config/
├── delivery-testing/              # 交付测试配置组合
│   ├── config-codewhisperer-only.json    # 单CodeWhisperer配置
│   ├── config-openai-only.json           # 单OpenAI配置
│   ├── config-gemini-only.json           # 单Gemini配置
│   ├── config-anthropic-only.json        # 单Anthropic配置
│   └── config-mixed-validation.json      # 混合验证配置
├── single-provider/               # 单Provider配置系列
│   ├── config-codewhisperer-primary.json
│   ├── config-shuaihong-openai.json
│   ├── config-modelscope-openai.json
│   └── config-google-gemini.json
├── load-balancing/                # 负载均衡配置系列
│   ├── config-multi-codewhisperer.json   # 多CodeWhisperer实例
│   ├── config-openai-rotation.json       # OpenAI轮换配置
│   └── config-cross-provider.json        # 跨Provider负载均衡
└── production-ready/              # 生产就绪配置系列
    ├── config-high-availability.json      # 高可用配置
    ├── config-security-enhanced.json      # 安全增强配置
    └── config-performance-optimized.json  # 性能优化配置
```

### 配置命名规范
- **单Provider**: `config-{provider-name}.json`
- **功能特定**: `config-{feature-name}.json`
- **环境特定**: `config-{environment}.json`
- **测试专用**: `config-{test-scenario}.json`

## 🗄️ **database/ 目录数据保存规则**

### 数据存储路径规范
```
database/
├── captures/                      # 实时数据捕获
│   └── YYYY-MM-DD/               # 按日期组织
│       ├── session-{id}-{timestamp}.json
│       └── request-{id}-{timestamp}.json
├── {provider-name}/               # 按Provider分类存储
│   ├── requests/                  # 原始请求数据
│   ├── responses/                 # 原始响应数据
│   └── processed/                 # 处理后数据
├── pipeline-tests/                # 流水线测试数据
│   ├── step1-input-{timestamp}.json
│   ├── step2-routing-{timestamp}.json
│   └── step3-output-{timestamp}.json
├── test-sessions/                 # 测试会话完整记录
│   ├── {test-category}-{timestamp}.json
│   └── {scenario-name}-{session-id}.json
└── daily-aggregates/              # 按日聚合数据
    └── YYYY-MM-DD/
        ├── {provider}-aggregate.json
        └── error-summary.json
```

### 数据文件命名规则
1. **时间戳格式**: ISO 8601 格式 `YYYY-MM-DDTHH-mm-ss-sssZ`
2. **会话标识**: `{test-type}-{provider}-{timestamp}`
3. **请求标识**: `{session-id}-{request-id}-{timestamp}`
4. **错误记录**: `error-{category}-{provider}-{timestamp}.json`
5. **聚合数据**: `{provider}-{date}-aggregate.json`

### 数据保留策略
- **实时捕获**: 保留7天，自动清理
- **测试会话**: 保留30天
- **Pipeline数据**: 保留14天
- **聚合数据**: 保留90天
- **错误记录**: 保留60天

## 🔍 **配置文件验证规则**

### 强制验证检查
1. **JSON格式验证**: 所有配置文件必须是有效JSON
2. **必需字段检查**: providers, routing, logging等核心字段
3. **端口冲突检查**: 确保不同配置使用不同端口
4. **Provider配置验证**: 确保所有Provider配置完整且有效
5. **路径存在性检查**: 确保所有引用的路径存在

### 配置模板规范
```json
{
  "version": "2.6.0",
  "environment": "development|production",
  "server": {
    "port": 3456,
    "host": "localhost"
  },
  "routing": {
    "default": { "provider": "...", "model": "..." },
    "background": { "provider": "...", "model": "..." },
    "thinking": { "provider": "...", "model": "..." },
    "longcontext": { "provider": "...", "model": "..." },
    "search": { "provider": "...", "model": "..." }
  },
  "providers": {
    "{provider-name}": {
      "type": "...",
      "config": { ... },
      "auth": { ... }
    }
  },
  "logging": {
    "level": "info|debug",
    "dataCapture": true|false,
    "outputDir": "~/.route-claude-code/database"
  }
}
```

## 🚨 **配置安全规则**

### 敏感信息保护
1. **禁止硬编码凭据**: 任何API密钥都不能直接写在配置文件中
2. **环境变量引用**: 使用 `${ENV_VAR}` 格式引用环境变量
3. **文件权限**: 配置文件权限设置为 600 (仅所有者可读写)
4. **版本控制排除**: 包含真实凭据的配置文件不能提交到版本控制

### 示例安全配置
```json
{
  "providers": {
    "codewhisperer-primary": {
      "auth": {
        "profile": "${AWS_PROFILE}",
        "region": "${AWS_REGION}"
      }
    },
    "openai-compatible": {
      "auth": {
        "apiKey": "${OPENAI_API_KEY}",
        "baseURL": "${OPENAI_BASE_URL}"
      }
    }
  }
}
```

## 📋 **配置维护任务清单**

### 定期维护任务
- [ ] **每周**: 检查配置文件有效性
- [ ] **每月**: 清理过期的数据文件
- [ ] **每季度**: 审查和更新配置模板
- [ ] **发布前**: 验证所有环境配置的一致性

### 配置变更流程
1. **变更前**: 备份当前配置文件
2. **变更中**: 使用配置验证工具检查
3. **变更后**: 运行完整测试套件验证
4. **回滚计划**: 准备快速回滚方案

## 🔧 **配置工具和命令**

### 配置管理命令
```bash
# 配置验证
./rcc config --validate ~/.route-claude-code/config.json

# 配置切换
./rcc config --switch production

# 配置备份
./rcc config --backup ~/.route-claude-code/backups/

# 配置恢复
./rcc config --restore ~/.route-claude-code/backups/config-backup-20250801.json

# 数据清理
./rcc database --cleanup --older-than 30d

# 配置模板生成
./rcc config --generate-template --type single-provider --provider codewhisperer
```

### 自动化脚本
- **配置检查**: `check-config-integrity.sh`
- **数据清理**: `cleanup-database.sh`
- **配置同步**: `sync-config-environments.sh`
- **备份管理**: `manage-config-backups.sh`

---

**配置管理规则版本**: v2.6.0  
**维护者**: Jason Zhang  
**最后更新**: 2025-08-01  
**强制执行**: 是 - 所有配置操作必须遵循此规则

## 🎯 **配置规则速查表**

| **配置类型** | **路径位置** | **用途说明** | **强制要求** |
|-------------|-------------|------------|-------------|
| **主配置** | `~/.route-claude-code/config.json` | 测试环境配置 | **必须先检查** |
| **生产配置** | `~/.route-claude-code/config.release.json` | 生产环境配置 | **双启动支持** |
| **组合配置** | `~/.route-claude-code/config/` | 各种配置组合 | **按功能分类** |
| **数据存储** | `~/.route-claude-code/database/` | Raw数据保存 | **强制命名规范** |
| **Provider数据** | `database/{provider-name}/` | 按Provider分类 | **完整数据捕获** |
| **测试数据** | `database/test-sessions/` | 测试会话记录 | **会话追踪** |