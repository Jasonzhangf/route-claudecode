# 底层抓包对比系统测试

## 测试用例
Demo2 vs Router CodeWhisperer实现的完整HTTP请求差异分析

## 测试目标
1. **Demo2抓包**: 捕获demo2发送到CodeWhisperer API的原始HTTP请求和响应
2. **Router抓包**: 捕获router发送的HTTP请求和400错误响应详情
3. **逐字节对比**: 分析请求URL、请求头、请求体的具体差异
4. **修复建议**: 基于差异分析生成具体的修复方案

## 最近执行记录

### 执行时间: 待执行
- **状态**: PENDING
- **执行时长**: -
- **日志文件**: `/tmp/packet-capture-comparison/`

### 测试范围
- **simple_text**: 基础文本请求测试 (claude-sonnet-4-20250514)
- **background_model**: 背景模型映射测试 (claude-3-5-haiku-20241022)
- **with_tools**: 工具调用请求测试 (带TodoWrite工具)

### 关键分析点
1. **模型映射验证**: 
   - 当前错误: `claude-3-5-haiku-20241022` → `CLAUDE_SONNET_4_20250514_V1_0`
   - 预期正确: `claude-3-5-haiku-20241022` → `CLAUDE_3_7_SONNET_20250219_V1_0`

2. **请求格式对比**:
   - Demo2的userInputMessageContext处理策略
   - 工具定义的处理差异
   - profileArn获取和设置

3. **认证机制对比**:
   - Token获取方式
   - Authorization头格式
   - 认证失败处理

### 输出文件结构
```
/tmp/packet-capture-comparison/
├── demo2-simple_text-capture.json      # Demo2请求捕获
├── router-simple_text-capture.json     # Router请求捕获
├── comparison-simple_text.json         # 对比结果
├── demo2-background_model-capture.json
├── router-background_model-capture.json
├── comparison-background_model.json
├── demo2-with_tools-capture.json
├── router-with_tools-capture.json
├── comparison-with_tools.json
├── fix-suggestions.json                # 修复建议
└── packet-comparison-report.json       # 完整报告
```

## 历史执行记录
*首次运行，无历史记录*

## 相关文件
- **测试脚本**: `/Users/fanzhang/Documents/github/claude-code-router/test/debug/debug-packet-capture-comparison.js`
- **Demo2路径**: `/Users/fanzhang/Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent/c8a1031074c0308699739f156aa70303/74a08cf8613c7dec4db7b264470db812/a5e967c0/examples/demo2`
- **输出目录**: `/tmp/packet-capture-comparison/`

## 使用方法
```bash
# 确保Router服务运行
./rcc start

# 运行抓包对比测试
node test/debug/debug-packet-capture-comparison.js
```

## 预期问题分析
1. **400错误根因**: 请求体格式不符合CodeWhisperer API规范
2. **模型映射错误**: MODEL_MAP配置与demo2不一致
3. **认证机制**: Token获取或格式化差异
4. **工具处理**: userInputMessageContext字段处理策略差异

## 修复验证流程
1. 运行抓包对比获得差异分析
2. 根据fix-suggestions.json修复代码
3. 重新运行验证修复效果
4. 直到所有测试用例都获得相同的成功响应