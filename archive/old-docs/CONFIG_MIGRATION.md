# 配置文件迁移说明

## 📋 概述

为了保护API密钥和敏感信息，所有包含真实API密钥的配置文件已迁移到用户目录 `~/.route-claudecode/config/v4/`，不再提交到GitHub仓库。

## 🗂️ 迁移后的目录结构

```
~/.route-claudecode/config/v4/
├── providers/
│   ├── lmstudio-openai.json5          # LM Studio OpenAI配置
│   ├── lmstudio-anthropic.json5       # LM Studio Anthropic配置
│   └── server-compatibility-providers.json
├── routing/
│   └── pipeline-routing.json
├── security/
│   └── security-config.json
├── hybrid-multi-provider-v3-5509.json # 混合多Provider配置
├── test-gemini-endpoint.js            # Gemini测试脚本
├── test-modelscope-endpoint.js         # ModelScope测试脚本
├── test-rcc-endpoint.js               # RCC测试脚本
├── test-shuaihong-endpoint.js         # 水洪测试脚本
└── gemini-provider-updater.js         # Gemini Provider更新脚本
```

## 🔧 本地配置模板

项目中保留了去敏感化的模板文件：

```
config/
├── hybrid-multi-provider.template.json    # 混合配置模板
├── providers/
│   ├── lmstudio-openai.template.json5    # LM Studio模板
│   └── example.json5                     # 通用Provider模板
└── test-endpoint.template.js              # 测试脚本模板
```

## 🚀 使用方法

### 1. 创建个人配置

1. 复制模板文件到用户目录：
   ```bash
   mkdir -p ~/.route-claudecode/config/v4/providers
   cp config/hybrid-multi-provider.template.json ~/.route-claudecode/config/v4/hybrid-multi-provider-v3-5509.json
   cp config/providers/lmstudio-openai.template.json5 ~/.route-claudecode/config/v4/providers/lmstudio-openai.json5
   ```

2. 编辑配置文件，替换API密钥占位符：
   ```bash
   # 编辑混合配置
   vim ~/.route-claudecode/config/v4/hybrid-multi-provider-v3-5509.json
   
   # 替换以下占位符：
   # YOUR_GEMINI_API_KEY_1 -> 实际的Gemini API密钥
   # YOUR_MODELSCOPE_API_KEY_1 -> 实际的ModelScope API密钥
   # YOUR_LM_STUDIO_API_KEY -> 实际的LM Studio API密钥
   ```

### 2. 测试配置

```bash
# 测试混合配置
node test-hybrid-config.js

# 验证降级链配置
node validate-hybrid-fallback-config.js

# 使用rcc3全局命令测试
rcc3 start ~/.route-claudecode/config/v4/hybrid-multi-provider-v3-5509.json

# 使用v4本地命令测试
npm run build
./dist/cli.js start ~/.route-claudecode/config/v4/hybrid-multi-provider-v3-5509.json
```

### 3. 当前可用的测试命令

| 命令 | 描述 | 配置文件位置 |
|------|------|--------------|
| `rcc3` | v3全局安装命令 | 用户目录配置 |
| `./dist/cli.js` | v4本地构建命令 | 用户目录配置 |
| `npm run build` | 构建TypeScript | 本地项目 |
| `npm test` | 运行单元测试 | 本地项目 |
| `node test-hybrid-config.js` | 混合配置测试 | 用户目录配置 |

## 🛡️ 安全措施

### 已实施的安全保护

1. **GitIgnore更新**: 添加了全面的`.gitignore`规则防止敏感文件提交
2. **文件迁移**: 所有包含真实API密钥的文件已移至用户目录
3. **模板文件**: 提供去敏感化的模板供参考
4. **路径修正**: 更新了引用配置文件的脚本路径

### GitIgnore保护范围

```gitignore
# 配置文件保护
config/hybrid-multi-provider-v3-*.json
config/providers/lmstudio-*.json5
config/providers/modelscope-*.json5
test-*-endpoint.js
**/config-*.json

# API密钥保护
**/*apikey*
**/*api-key*
**/*secret*
**/*credential*
```

## 📝 配置文件说明

### LM Studio配置

**端点**: `http://localhost:1234/v1/chat/completions`
**默认端口**: 1234
**协议**: OpenAI兼容API

```json5
{
  "connection": {
    "endpoint": "http://localhost:1234/v1/chat/completions",
    "apiKey": "YOUR_LM_STUDIO_API_KEY"
  }
}
```

### ModelScope配置

**端点**: `https://api-inference.modelscope.cn/v1/chat/completions`
**主要模型**: `Qwen/Qwen3-Coder-480B-A35B-Instruct`

```json
{
  "modelscope-qwen": {
    "endpoint": "https://api-inference.modelscope.cn/v1/chat/completions",
    "apiKeys": ["YOUR_MODELSCOPE_API_KEY"]
  }
}
```

### Gemini配置

**端点**: `https://generativelanguage.googleapis.com`
**主要模型**: `gemini-2.5-pro`, `gemini-2.5-flash`

```json
{
  "google-gemini": {
    "endpoint": "https://generativelanguage.googleapis.com",
    "apiKeys": ["YOUR_GEMINI_API_KEY"]
  }
}
```

## 🔄 配置加载器

项目提供了 `UserConfigLoader` 类来管理用户配置：

```typescript
import { userConfigLoader } from './src/config/user-config-loader';

// 加载混合配置
const hybridConfig = userConfigLoader.loadHybridConfig();

// 加载LM Studio配置
const lmstudioConfig = userConfigLoader.loadLMStudioConfig('openai');

// 检查配置是否存在
const hasConfig = userConfigLoader.hasConfig('hybrid-multi-provider-v3-5509.json');
```

## ⚠️ 注意事项

1. **不要提交敏感配置**: 确保不要将包含真实API密钥的文件提交到Git
2. **使用模板文件**: 开发时使用模板文件，运行时使用用户目录配置
3. **定期更新密钥**: 建议定期轮换API密钥提升安全性
4. **备份配置**: 建议备份用户目录的配置文件（去敏感化后）

## 🆘 故障排除

### 配置文件找不到

```bash
# 检查配置目录结构
ls -la ~/.route-claudecode/config/v4/

# 从模板创建配置
cp config/hybrid-multi-provider.template.json ~/.route-claudecode/config/v4/hybrid-multi-provider-v3-5509.json
```

### 测试命令失败

```bash
# 检查rcc3是否全局安装
which rcc3

# 构建v4本地版本
npm run build

# 检查配置文件语法
node -c ~/.route-claudecode/config/v4/hybrid-multi-provider-v3-5509.json
```

### API密钥无效

1. 确认API密钥格式正确
2. 检查API密钥是否过期
3. 验证端点URL是否正确
4. 查看服务商文档确认使用方法