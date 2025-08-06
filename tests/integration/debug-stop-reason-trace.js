#!/usr/bin/env node

/**
 * Debug stop_reason 字段追踪
 * 添加专门的调试钩子来追踪 stop_reason 字段在处理链中的变化
 */

// 这个脚本用于向代码中添加调试语句，然后运行测试来追踪问题

console.log('🔍 Stop Reason 字段追踪调试计划');
console.log('='.repeat(50));

console.log(`
计划添加调试钩子到以下关键位置：

1. Enhanced Client - Raw OpenAI response 接收后
   位置: src/providers/openai/enhanced-client.ts ~1057行
   目的: 确认原始OpenAI响应是否包含finish_reason

2. Enhanced Client - transformOpenAIResponseToAnthropic 调用后  
   位置: src/providers/openai/enhanced-client.ts ~1063行
   目的: 确认转换后的Anthropic响应是否包含stop_reason

3. Enhanced Client - BaseResponse 构建后
   位置: src/providers/openai/enhanced-client.ts ~1089行
   目的: 确认BaseResponse是否保持了stop_reason

4. Output Processor - 输入检查
   位置: src/output/anthropic/processor.ts ~31行
   目的: 确认Output Processor接收到的响应数据

5. Output Processor - 路由选择后
   位置: src/output/anthropic/processor.ts ~41行
   目的: 确认选择了哪个转换方法

6. Output Processor - 最终输出前
   位置: src/output/anthropic/processor.ts ~53行
   目的: 确认最终响应是否包含stop_reason

调试方法：
1. 添加 console.log 语句追踪 stop_reason 字段
2. 重新构建项目
3. 重启服务
4. 发送测试请求
5. 查看调试输出

关键要追踪的数据点：
- 原始OpenAI响应的 choices[0].finish_reason
- 转换后Anthropic响应的 stop_reason  
- BaseResponse 的 stop_reason
- Output Processor 各阶段的 stop_reason
`);

console.log('\n🚀 执行计划:');
console.log('1. 手动添加调试语句到关键位置');  
console.log('2. 重新构建和测试');
console.log('3. 分析调试输出找出问题点');

console.log('\n💡 基于模拟测试结果，我们知道理论逻辑是正确的');
console.log('   问题一定出现在实际数据流的某个特定环节');
console.log('   通过逐步追踪可以精确定位到赋值null的位置');