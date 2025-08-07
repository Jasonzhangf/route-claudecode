# Provider Data Collection Template

## 工具信息
- **工具路径**: ./tools/log-parser/server-response-extractor
- **版本**: 1.0.0
- **最后更新**: [EXTRACTION_DATE]
- **数据来源**: 3456端口服务器日志

## 数据格式
### 会话数据结构
```json
{
  "sessionId": "会话标识符",
  "requestId": "请求标识符", 
  "provider": "提供商名称",
  "model": "模型名称",
  "category": "数据类别 (long-text|normal-text|tool-calls)",
  "timestamp": "ISO8601时间戳",
  "request": {
    "method": "HTTP方法",
    "endpoint": "API端点",
    "headers": "请求头",
    "body": "请求内容"
  },
  "response": {
    "status": "HTTP状态码",
    "headers": "响应头",
    "body": "响应内容",
    "finishReason": "完成原因",
    "processingTime": "处理时间(秒)"
  },
  "routing": {
    "category": "路由类别",
    "selectedProvider": "选定的Provider",
    "routingTime": "路由时间(秒)"
  }
}
```

## 数据分类标准
- **long-text**: 响应内容长度 > 2000 字符
- **normal-text**: 普通文本响应
- **tool-calls**: 包含工具调用的响应（检测pattern: tool_calls|function_call）

## 数据统计
- **总记录数**: [TOTAL_RECORDS]
- **时间范围**: [START_DATE] to [END_DATE]
- **平均响应时间**: [AVG_RESPONSE_TIME]s
- **成功率**: [SUCCESS_RATE]%

## 目录结构
```
[PROVIDER_NAME]/
├── long-text/
│   ├── YYYY-MM-DD/          # 按日期分组
│   │   ├── session-001.json # 会话数据
│   │   └── daily-summary.json # 日汇总
│   └── README.md
├── normal-text/
├── tool-calls/
├── metadata/
│   ├── extraction-info.json # 提取元信息
│   ├── statistics.json      # 统计信息
│   └── data-schema.json     # 数据结构
└── README.md               # 本文档
```

## 使用说明
1. 数据按日期分组存储在子目录中
2. 每日自动生成汇总统计文件
3. 支持按时间范围和类别查询数据
4. 提供完整的错误日志跟踪和性能统计
5. 所有敏感信息（API密钥等）已自动过滤

## 质量保证
- **数据完整性**: 每条记录包含完整的请求-响应链路
- **时间精度**: 毫秒级时间戳记录
- **错误处理**: 完整的错误信息和堆栈跟踪
- **性能监控**: 详细的处理时间和资源使用统计

---
**生成工具**: server-response-extractor v1.0.0  
**数据版本**: [DATA_VERSION]  
**最后更新**: [LAST_UPDATE]