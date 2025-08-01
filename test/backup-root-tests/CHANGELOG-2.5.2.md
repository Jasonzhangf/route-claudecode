# 🚀 route-claudecode v2.5.2 发布日志

## 🎯 重要修复

### ✅ **Gemini API工具调用修复**
- **问题**: Gemini API返回400错误 "Unknown name 'tools': Cannot find field"
- **根本原因**: 使用了不支持工具调用的v1 API版本
- **解决方案**: 升级所有Gemini端点到v1beta版本
- **影响**: 解决Gemini三个API key"同时失效"问题

### 🔧 **双端口独立实体架构**
- **问题**: 开发端口(3456)和发布端口(8888)共享logger配置
- **解决方案**: 
  - 每个RouterServer实例创建独立logger
  - 分离日志目录：`logs/dev/` 和 `logs/release/`
  - 完全独立的服务器实例

### 📝 **修复详情**

#### Gemini API端点升级
```javascript
// 修复前
/v1/models/{model}:generateContent        → ❌ 不支持tools
/v1/models/{model}:streamGenerateContent  → ❌ 不支持tools  
/v1/models                                → ❌ 有限功能

// 修复后  
/v1beta/models/{model}:generateContent        → ✅ 支持tools
/v1beta/models/{model}:streamGenerateContent  → ✅ 支持tools
/v1beta/models                                → ✅ 完整功能
```

#### 独立日志系统
```typescript
// 修复前: 共享全局logger
const devServer = new RouterServer(devConfig);
const releaseServer = new RouterServer(releaseConfig);

// 修复后: 独立logger实例
const devServer = new RouterServer(devConfig, 'dev');
const releaseServer = new RouterServer(releaseConfig, 'release');
```

## 📊 测试验证

### API版本验证测试
- ✅ v1 基础请求：成功
- ❌ v1 工具请求：400错误 "Unknown name tools"
- ✅ v1beta 基础请求：成功
- ✅ v1beta 工具请求：成功 (包含工具调用响应)

### 双端口测试
- ✅ 开发服务器独立日志：`logs/dev/ccr-session-dev-*.log`
- ✅ 发布服务器独立日志：`logs/release/ccr-session-release-*.log`
- ✅ 配置完全隔离，无相互干扰

## 🎉 预期改进

### Gemini Provider
- 🔥 **工具调用完全正常**：不再有400错误
- 🔄 **API Key轮询恢复**：三个key正常轮换使用
- ⚡ **响应速度提升**：消除无效重试循环
- 📈 **成功率大幅提升**：从0%提升到正常水平

### 双端口服务
- 🎯 **完全独立运行**：dev和release互不影响
- 📋 **清晰日志分离**：调试更容易，日志不混合
- 🛡️ **稳定性增强**：单个服务器问题不影响另一个
- 🔧 **维护性提升**：可以独立重启和调试

## 🚧 技术改进

### 代码质量
- 🏗️ **架构优化**：RouterServer支持独立logger实例
- 🔧 **类型安全**：修复TypeScript类型定义问题
- 📦 **构建稳定**：解决esbuild和tsc兼容性问题

### 错误处理
- 🎯 **精确错误定位**：每个服务器独立错误上下文
- 📊 **详细日志记录**：包含服务器类型标识
- 🔍 **调试友好**：分离的日志便于问题诊断

## 📋 升级指南

### 安装新版本
```bash
npm install -g route-claudecode@2.5.2
```

### 验证修复效果
1. **重启服务器**：应用Gemini API版本修复
2. **测试工具调用**：发送包含工具的请求到Gemini
3. **检查日志分离**：验证dev和release日志独立存储
4. **确认Gemini正常**：不再有400 "Unknown name tools"错误

## 🙏 致谢

感谢用户的准确问题反馈：
- 🎯 "一看log就知道不是服务器问题，明是我们的工具格式不对"
- 🔍 "谷歌的服务不可能三个key同时都出错"
- 💡 正确指出了根本问题方向，促成了彻底解决方案

---

**版本**: 2.5.2  
**发布日期**: 2025-07-31  
**重要程度**: 🔥 关键修复 - 强烈建议升级