# Claude Code工具表和虚拟模型映射规则

## 📋 Claude Code工具表（16个工具）

### 🤖 任务和智能体管理
1. **Task** - 启动新智能体处理复杂的多步骤任务
   - 支持多种专用智能体：general-purpose, code-refactorer, security-auditor, project-rules-architect等

### 💻 系统操作工具
2. **Bash** - 执行bash命令，支持超时和后台运行
3. **BashOutput** - 获取后台bash shell的输出
4. **KillBash** - 终止运行中的后台bash shell

### 📁 文件系统操作工具
5. **Read** - 读取文件（支持文本、图片、PDF、Jupyter notebook）
6. **Write** - 写入文件到本地文件系统
7. **Edit** - 执行精确的字符串替换编辑
8. **MultiEdit** - 在单个文件中执行多个编辑操作
9. **NotebookEdit** - 编辑Jupyter notebook中的特定单元格

### 🔍 搜索和查找工具
10. **Glob** - 快速文件模式匹配，支持glob模式
11. **Grep** - 基于ripgrep的强大搜索工具，支持正则表达式
12. **LS** - 列出目录中的文件和目录

### 🌐 网络和Web工具
13. **WebFetch** - 获取指定URL的内容并使用AI模型处理
14. **WebSearch** - 搜索网络并使用结果来回答问题

### 📝 项目管理工具
15. **TodoWrite** - 创建和管理结构化任务列表
16. **ExitPlanMode** - 退出计划模式，准备开始编码

## 🎯 虚拟模型映射规则（更新版）

### 虚拟模型类型定义
```typescript
export enum VirtualModelType {
  DEFAULT = 'default',           // 通用对话
  CODING = 'coding',            // 编程任务（工具调用）
  REASONING = 'reasoning',      // 推理任务
  LONG_CONTEXT = 'longContext', // 长文本处理
  WEB_SEARCH = 'webSearch',     // Web搜索
  IMAGE_PROCESSING = 'imageProcessing'  // 🆕 图片处理
}
```

### 映射优先级规则（数字越小优先级越高）

#### 1. **longContext** (priority: 1) - 长文本优先
- **条件**: Token数量 > 60K
- **Provider优先级**: `shuaihong,gemini-2.5-pro;qwen,qwen3-coder-plus`
- **原因**: Gemini在长上下文处理方面表现优异，qwen作为可靠备份

#### 2. **imageProcessing** (priority: 2) - 🆕 图片处理
- **条件**: 请求包含图片内容或Read工具读取图片文件
- **Provider优先级**: `shuaihong,gemini-2.5-pro;qwen,qwen3-coder-plus` 
- **原因**: Gemini系列在多模态图片理解方面表现优异

#### 3. **webSearch** (priority: 3) - Web搜索
- **条件**: 工具名称包含 `web`、`search`、`browser` 关键字
- **Provider优先级**: `modelscope,qwen3-480b;qwen,qwen3-coder-plus`
- **原因**: ModelScope作为网络操作主力，qwen作为备份

#### 4. **reasoning** (priority: 4) - 推理任务
- **条件**: 包含thinking参数
- **Provider优先级**: `qwen,qwen3-coder-plus;modelscope,qwen3-480b`
- **原因**: 推理任务需要强大的逻辑分析能力

#### 5. **coding** (priority: 5) - 编程任务
- **条件**: 
  - 包含工具调用 (`hasTools: true`)
  - 排除Web搜索工具和图片处理工具
- **Provider优先级**: `modelscope,qwen3-480b;qwen,qwen3-coder-plus` 
- **Security备份**: `shuaihong,gemini-2.5-pro`
- **原因**: ModelScope作为文件编辑主力，qwen作为备份，Gemini作为security备用

#### 6. **default** (priority: 99) - 默认类型
- **条件**: 其他所有情况
- **Provider优先级**: `qwen,qwen3-coder-plus;modelscope,qwen3-480b;shuaihong,gemini-2.5-pro`

## 🔧 映射逻辑细节

### 图片处理检测逻辑
```typescript
// 检测图片处理请求
function isImageProcessingRequest(request: any): boolean {
  // 1. 检查消息内容中是否包含图片
  if (request.messages) {
    for (const message of request.messages) {
      if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'image') {
            return true;
          }
        }
      }
    }
  }
  
  // 2. 检查工具调用中是否有Read工具读取图片文件
  if (request.tools) {
    const hasReadTool = request.tools.some(tool => tool.name === 'Read');
    if (hasReadTool && request.context?.readingImageFile) {
      return true;
    }
  }
  
  return false;
}
```

### Provider角色定位
- **ModelScope**: 文件编辑和网络操作主力
- **Qwen**: 推理任务主力，各类任务的可靠备份
- **Gemini (shuaihong)**: 长文本和图片处理主力，文件编辑的security备用
- **LM Studio**: 本地安全备用

## 🎯 实际应用场景

### 场景1：图片分析 → `imageProcessing`
```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "分析这张截图"},
        {"type": "image", "source": {...}}
      ]
    }
  ]
}
```
**路由**: shuaihong → qwen

### 场景2：文件编辑 → `coding` (避免Gemini)
```json
{
  "tools": [
    {"name": "Read"}, 
    {"name": "Edit"}
  ]
}
```
**路由**: qwen → modelscope (跳过shuaihong)

### 场景3：Web搜索 → `webSearch`
```json
{
  "tools": [
    {"name": "WebSearch"}
  ]
}
```
**路由**: shuaihong → qwen

### 场景4：长文档+工具调用 → `longContext`
```json
{
  "messages": [...], // >60K tokens
  "tools": [{"name": "Bash"}]
}
```
**路由**: modelscope → qwen (长文本优先级更高)

## 📊 Provider特性对照表

| Provider | 编程能力 | 图片理解 | 长文本 | 稳定性 | 适用场景 |
|----------|---------|---------|--------|--------|----------|
| qwen | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 编程、推理、默认 |
| shuaihong | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 图片处理、Web搜索 |
| modelscope | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 长文本、编程辅助 |
| lmstudio | ⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | 本地安全备用 |

## 🔄 配置示例

```json
{
  "router": {
    "default": "qwen,qwen3-coder-plus;modelscope,qwen3-480b;shuaihong,gemini-2.5-pro",
    "coding": "modelscope,qwen3-480b;qwen,qwen3-coder-plus",
    "imageProcessing": "shuaihong,gemini-2.5-pro;qwen,qwen3-coder-plus",
    "longContext": "shuaihong,gemini-2.5-pro;qwen,qwen3-coder-plus",
    "webSearch": "modelscope,qwen3-480b;qwen,qwen3-coder-plus",
    "reasoning": "qwen,qwen3-coder-plus;modelscope,qwen3-480b"
  },
  "security": {
    "coding": "shuaihong,gemini-2.5-pro",
    "imageProcessing": "lmstudio,gpt-oss-20b-mlx",
    "longContext": "lmstudio,gpt-oss-20b-mlx"
  }
}
```

这个映射表确保了：
1. **图片处理和长文本优先使用Gemini的多模态和长上下文能力**
2. **文件编辑和网络操作使用ModelScope作为主力**
3. **Gemini在文件编辑中作为security备用**
4. **各类任务都有qwen作为可靠备份**