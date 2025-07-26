# CodeWhisperer空响应问题调试记录

**问题记录**: test-empty-response-20250726-0430  
**发现时间**: 2025-07-26 04:30  
**项目所有者**: Jason Zhang

## 问题描述

### 现象
- 路由器能正常启动和接收请求
- 路由决策正确，成功选择k2cc-codewhisperer提供商
- 格式转换成功，生成正确的CodeWhisperer请求格式
- API调用完成，但返回**空响应内容**

### 具体表现
1. **非流式请求**:
   ```json
   {
     "content": [],  // 空内容
     "usage": {"input_tokens": 17, "output_tokens": 0}  // 0个输出token
   }
   ```

2. **流式请求**:
   ```
   event: content_block_start
   event: content_block_stop  // 没有content_block_delta事件
   ```

### 日志分析
```log
[2025-07-26T04:22:57.264Z] DEBUG: Request completed successfully
Data: {
  "responseLength": 0,      // 响应长度为0
  "usage": {
    "input_tokens": 17,
    "output_tokens": 0      // 输出token为0
  }
}

[2025-07-26T04:23:18.526Z] DEBUG: Streaming request completed  
Data: {
  "eventCount": 0,          // 事件数量为0
  "totalYielded": 0         // 总生成量为0
}
```

## 测试方法

### 测试环境
- 路由器版本: 2.0.0
- 端口: 3456 (debug模式)
- 配置: k2cc-codewhisperer (default路由)

### 测试请求
```json  
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {
      "role": "user", 
      "content": "Hello, please respond with a simple greeting"
    }
  ],
  "max_tokens": 100,
  "stream": false/true
}
```

### 健康检查结果
```json
{
  "overall": "degraded",
  "providers": {
    "codewhisperer-primary": false,  // 认证失败
    "shuaihong-openai": true,
    "k2cc-codewhisperer": false      // 认证失败
  }
}
```

## 发现结果

### 根本原因分析
1. **Token认证问题**: 
   - 日志显示 "CodeWhisperer token validation failed"
   - 两个CodeWhisperer提供商都认证失败
   - 但路由器仍然尝试调用失败的提供商

2. **流水线数据缺失**:
   - 没有保存各节点的中间数据
   - 无法确定是API调用失败还是响应解析失败
   - 缺乏二进制响应的原始数据

3. **错误处理不完善**:
   - 认证失败后仍然路由到失败的提供商
   - 没有自动fallback到健康的提供商
   - API调用失败但返回200状态码

## 解决方案

### 立即修复
1. **修复Token认证**:
   - 检查Kiro token文件路径和格式
   - 验证token的有效性和权限
   - 实现token自动刷新机制

2. **修复路由逻辑**:
   - 健康检查失败的提供商应该从路由中排除
   - 实现自动fallback到健康提供商
   - 添加更详细的错误处理

3. **建立节点数据保存系统**:
   - 为每个流水线节点添加数据捕获点
   - 保存原始API请求和响应数据
   - 实现节点级调试脚本

### 长期改进
1. **完善监控系统**:
   - 实时监控提供商健康状态
   - 自动切换到健康提供商
   - 提供商故障告警机制

2. **增强调试能力**:
   - 节点级数据保存和重放
   - 完整的链路追踪系统
   - 自动化问题诊断工具

## 下一步行动

### 优先级1: 数据收集系统
- [ ] 创建节点数据保存机制
- [ ] 实现CodeWhisperer API原始响应捕获
- [ ] 建立节点级调试脚本

### 优先级2: 问题修复
- [ ] 修复Token认证问题
- [ ] 实现健康提供商路由
- [ ] 添加错误处理和fallback机制

### 优先级3: 验证测试
- [ ] 使用保存的数据进行节点级调试
- [ ] 修复后的端到端测试
- [ ] 完整功能验证

## 参考信息
- 相关测试脚本: `test/test-claude-response-pipeline.js`
- 日志文件: `/tmp/ccr-output.log`
- 配置文件: `~/.claude-code-router/config-router.json`