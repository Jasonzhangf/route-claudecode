# Gemini API版本修复测试

## 测试用例
验证Gemini API从v1升级到v1beta解决工具调用问题

## 测试目标
- 解决"Unknown name 'tools': Cannot find field"错误
- 验证工具调用功能在v1beta端点正常工作
- 确认三个API key轮询机制正常

## 根本问题分析

### 问题发现过程
1. **初始误判**: 认为是工具格式问题
2. **实际调试**: 通过debug-gemini-request.js发现版本问题
3. **API测试结果**:
   - v1 + tools → ❌ 400错误 "Unknown name 'tools'"
   - v1beta + tools → ✅ 成功响应

### 真正原因
**Gemini API的v1版本不支持tools字段，必须使用v1beta版本**

## 修复详情

### 修复前 (错误版本)
```javascript
// generateContent
const url = `${this.baseUrl}/v1/models/${modelName}:generateContent?key=${apiKey}`;

// streamGenerateContent  
const url = `${this.baseUrl}/v1/models/${modelName}:streamGenerateContent?key=${currentApiKey}`;

// health check
const response = await fetch(`${this.baseUrl}/v1/models?key=${apiKey}`, {
```

### 修复后 (正确版本)
```javascript
// generateContent
const url = `${this.baseUrl}/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

// streamGenerateContent
const url = `${this.baseUrl}/v1beta/models/${modelName}:streamGenerateContent?key=${currentApiKey}`;

// health check
const response = await fetch(`${this.baseUrl}/v1beta/models?key=${apiKey}`, {
```

## 最近执行记录

### 2025-07-31 14:45:00 - ✅ 修复完成
- **状态**: 修复应用成功
- **执行时长**: <1秒
- **修复文件**: src/providers/gemini/client.ts
- **变更**: 3处API端点从v1改为v1beta
- **构建**: ✅ 成功

## 预期效果

### 修复前症状
- 所有Gemini工具调用返回400错误
- 三个API key"同时失效" (实际是格式错误)
- 重复的429/400错误和重试

### 修复后预期
- ✅ Gemini工具调用正常工作
- ✅ 三个API key轮询恢复正常
- ✅ 不再有"Unknown name tools"错误
- ✅ 工具调用响应格式正确

## 验证步骤
1. 重启服务器应用v1beta端点修复
2. 发送包含工具的请求测试Gemini provider
3. 验证不再出现400错误
4. 检查工具调用返回正确响应格式

## 相关文件
- 修复文件: `src/providers/gemini/client.ts` (107, 169, 67行)  
- 调试脚本: `debug-gemini-request.js`
- 官方文档: https://ai.google.dev/gemini-api/docs/function-calling

## 学习点
- **重要**: Gemini API工具调用必须使用v1beta版本，v1不支持
- **调试方法**: 直接测试API端点比分析代码格式更有效
- **版本差异**: Google API不同版本功能支持差异很大