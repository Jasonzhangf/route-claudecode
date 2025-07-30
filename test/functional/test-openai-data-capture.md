# OpenAI Data Capture Test

## 测试用例
测试OpenAI provider的数据捕获功能

## 测试目标
1. 验证数据捕获功能是否正常工作
2. 检查捕获的数据是否完整和正确
3. 验证数据保存到指定目录的功能

## 测试方法
1. 检查~/.route-claude-code/database/captures/openai目录是否存在
2. 列出所有已捕获的文件
3. 加载并验证最新的捕获数据
4. 生成统计信息报告

## 预期结果
- 数据捕获目录应该存在且可访问
- 应该能够列出捕获的文件
- 捕获的数据应该包含完整的请求和响应信息
- 统计信息应该正确反映provider和model的使用情况

## 相关文件
- 测试脚本: `test-openai-data-capture.js`
- 数据捕获模块: `src/providers/openai/data-capture.ts`
- 捕获数据目录: `~/.route-claude-code/database/captures/openai/`

## 执行历史
- 首次执行: 2025-07-30
- 状态: 已创建，待执行

## 执行说明
```bash
# 运行测试
node test/functional/test-openai-data-capture.js

# 查看详细数据
 cat test/functional/test-openai-data-capture-latest.json

# 查看统计信息
cat test/functional/test-openai-data-capture-stats.json
```

## 注意事项
1. 需要先有OpenAI请求才能捕获数据
2. 确保~/.route-claude-code/database目录存在且有写权限
3. 测试结果将保存为JSON格式的详细数据和统计信息

## 数据结构说明
捕获的数据包含以下字段：
- `timestamp`: 捕获时间戳
- `requestId`: 请求ID
- `provider`: provider名称
- `model`: 模型名称
- `request`: 完整的请求数据
- `response`: 完整的响应数据（成功时）
- `error`: 错误信息（失败时）

## 验证点
1. ✅ 数据目录存在性检查
2. ✅ 文件列表功能
3. ✅ 数据加载功能
4. ✅ 统计信息生成
5. ✅ 数据完整性验证