# 🔧 服务管理规则 (Service Management Rules)

## ⚠️ 服务管理重要规则 (CRITICAL SERVICE MANAGEMENT RULES)

**🚨 强制执行服务管理约束 - 违反将导致系统不稳定**

### 1. **服务类型区分**
- **`rcc start`服务**: API服务器，可以停止/重启/管理
- **`rcc code`服务**: Claude Code客户端会话，**绝对不可杀掉**

### 2. **服务操作权限**
```bash
# ✅ 允许的操作 - 可以管理API服务器
pkill -f "rcc start"           # 只杀掉API服务器
ps aux | grep "rcc start"      # 查看API服务器状态

# ❌ 禁止的操作 - 不可杀掉客户端会话  
pkill -f "rcc code"           # 绝对禁止！会断掉用户会话
kill <rcc code的PID>          # 绝对禁止！
```

### 3. **配置文件管理约束**
- **🔒 只读原则**: `~/.route-claude-code/config/single-provider/`下的配置文件为只读
- **🚫 禁止修改**: 不允许修改配置文件中的端口设置
- **🚫 禁止创建**: 不允许创建新的配置文件
- **✅ 使用现有**: 只能使用文件夹内现有的配置文件启动服务

### 4. **端口管理规则**
- **端口固定**: 每个配置文件的端口由文件名和内容预定义
- **不可变更**: 配置文件中的端口设置不可修改
- **冲突处理**: 如端口被占用，停止冲突的`rcc start`服务，不修改配置

### 5. **服务启动标准流程**
```bash
# 步骤1: 检查现有API服务器(只检查rcc start)
ps aux | grep "rcc start" | grep -v grep

# 步骤2: 停止冲突的API服务器(如果需要)
pkill -f "rcc start.*5508"  # 只停止特定端口的API服务器

# 步骤3: 使用现有配置启动服务
rcc start ~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json --debug

# 注意: 绝不触碰 rcc code 进程！
```

### 6. **调试和测试约束**
- **测试隔离**: 调试单个provider时使用single-provider配置
- **配置不变**: 测试过程中不修改任何配置文件
- **会话保护**: 调试期间保护用户的`rcc code`会话不被中断

## 🌐 端口配置管理

### 主服务端口
- **Development**: 3456 (开发环境)
- **Production**: 3457 (生产环境)
- **日志监控**: `~/.route-claude-code/logs/ccr-*.log`

### Single-Provider配置端口映射表
调试时使用以下端口和配置文件启动特定provider服务：

| 端口 | Provider类型 | 账号/服务 | 配置文件 | 主要模型 |
|------|-------------|-----------|----------|----------|
| **5501** | CodeWhisperer | Primary Account | `config-codewhisperer-primary-5501.json` | CLAUDE_SONNET_4_20250514_V1_0 |
| **5502** | Google Gemini | API Keys | `config-google-gemini-5502.json` | gemini-2.5-pro, gemini-2.5-flash |
| **5503** | CodeWhisperer | Kiro-GitHub | `config-codewhisperer-kiro-github-5503.json` | CLAUDE_SONNET_4_20250514_V1_0 |
| **5504** | CodeWhisperer | Kiro-Gmail | `config-codewhisperer-kiro-gmail-5504.json` | CLAUDE_SONNET_4, CLAUDE_3_7_SONNET |
| **5505** | CodeWhisperer | Kiro-Zcam | `config-codewhisperer-kiro-zcam-5505.json` | CLAUDE_SONNET_4, CLAUDE_3_7_SONNET |
| **5506** | OpenAI Compatible | LM Studio | `config-openai-lmstudio-5506.json` | qwen3-30b, glm-4.5-air |
| **5507** | OpenAI Compatible | ModelScope | `config-openai-modelscope-5507.json` | Qwen3-Coder-480B |
| **5508** | OpenAI Compatible | ShuaiHong | `config-openai-shuaihong-5508.json` | claude-4-sonnet, gemini-2.5-pro |
| **5509** | OpenAI Compatible | ModelScope GLM | `config-openai-modelscope-glm-5509.json` | ZhipuAI/GLM-4.5 |

### 调试使用示例
```bash
# 启动服务器的标准格式
rcc start ~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json --debug

# 启动Claude Code连接到特定端口
rcc code --port 5508

# 具体启动命令示例:
# 启动CodeWhisperer主账号服务 (端口5501)
rcc start ~/.route-claude-code/config/single-provider/config-codewhisperer-primary-5501.json --debug

# 启动Gemini服务 (端口5502) 
rcc start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug

# 启动ModelScope GLM服务 (端口5509)
rcc start ~/.route-claude-code/config/single-provider/config-openai-modelscope-glm-5509.json --debug

# 启动ShuaiHong服务 (端口5508)
rcc start ~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json --debug

# 检查特定端口服务状态
curl http://localhost:5502/health

# 连接Claude Code到特定端口进行交互
rcc code --port 5509  # 连接到ModelScope GLM服务
rcc code --port 5508  # 连接到ShuaiHong服务
```

### 配置文件位置
- **单provider配置**: `~/.route-claude-code/config/single-provider/`
- **多provider配置**: `~/.route-claude-code/config/load-balancing/`
- **生产环境配置**: `~/.route-claude-code/config/production-ready/`

## 🚀 启动和部署管理

### 推荐启动方式
```bash
./rcc start              # 简化启动器，支持Ctrl+C退出
./rcc status             # 检查服务状态
./rcc stop               # 停止服务
```

### 开发工具集
- **完整开发流程**: `./fix-and-test.sh` (构建+启动+测试)
- **开发模式**: `./start-dev.sh` (自动构建+日志记录)
- **构建项目**: `./build.sh` (清理和构建)
- **本地安装**: `./install-local.sh` (打包+全局安装)

## 🔒 安全和权限管理

### 环境保护规则
- **🔒 配置只读**: 生产配置文件不可修改
- **🔒 权限最小化**: 服务以最小必要权限运行
- **🔒 凭据分离**: 敏感信息与代码完全分离

### 操作审计
- **操作记录**: 所有服务管理操作都有日志记录
- **权限验证**: 关键操作需要权限验证
- **变更追踪**: 配置变更有完整的追踪记录

---
**规则版本**: v2.7.0  
**项目所有者**: Jason Zhang  
**最后更新**: 2025-08-05