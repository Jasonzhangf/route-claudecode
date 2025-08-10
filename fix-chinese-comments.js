#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 文件路径
const filePath = '/Users/fanzhang/Documents/github/claude-code-router/src/preprocessing/unified-patch-preprocessor.ts';

// 读取文件内容
let content = fs.readFileSync(filePath, 'utf8');

// 简单的中文到英文替换映射（只替换注释中的关键短语）
const replacements = [
  // 特定注释翻译
  ['解决 "OpenAI response missing choices" 错误和工具调用解析问题', 'Solve "OpenAI response missing choices" error and tool call parsing issue'],
  ['基于模型匹配而不是Provider，更精确', 'Model-based matching instead of Provider, more precise'],
  ['检查模型名称是否匹配', 'Check if model name matches'],
  ['对于非OpenAI原生Provider，也可能需要格式修复，放宽检查', 'For non-native OpenAI Providers, format fixes may also be needed, relax checks'],
  ['检查是否缺少choices字段（核心问题）', 'Check if choices field is missing (core issue)'],
  ['构造标准OpenAI格式响应', 'Construct standard OpenAI format response'],
  ['如果有工具调用但没有内容，设置content为null', 'If there are tool calls but no content, set content to null'],
  ['检查choices存在但格式不完整的情况', 'Check if choices exist but format is incomplete'],
  ['LM Studio特殊处理：解析嵌入在内容中的工具调用', 'LM Studio special handling: Parse tool calls embedded in content'],
  ['尝试解析LM Studio格式的工具调用', 'Try to parse LM Studio format tool calls'],
  ['移除工具调用标记后的内容', 'Content after removing tool call markers'],
  ['移除工具调用标记（这里需要根据实际格式调整）', 'Remove tool call markers (needs adjustment based on actual format)'],
  ['简化处理，实际应该更精确地移除标记', 'Simplified processing, should actually remove markers more precisely'],
  ['数据格式正常，直接返回', 'Data format is normal, return directly'],
  ['从非标准响应中提取内容', 'Extract content from non-standard response'],
  ['尝试多种可能的内容字段', 'Try multiple possible content fields'],
  ['从非标准响应中提取工具调用', 'Extract tool calls from non-standard response'],
  ['检查标准位置', 'Check standard locations'],
  ['检查嵌套位置', 'Check nested locations'],
  ['从非标准响应中提取finish_reason', 'Extract finish_reason from non-standard response'],
  ['尝试多种可能的finish_reason字段', 'Try multiple possible finish_reason fields'],
  ['检测非正常的API响应', 'Detect abnormal API responses'],
  ['根据用户诊断结果：ModelScope不发送finish_reason字段的情况', 'Based on user diagnosis: ModelScope not sending finish_reason field situation'],
  ['检测是否为ModelScope类型的provider', 'Detect if provider is ModelScope type'],
  ['检测是否为流结束但缺少finish_reason的情况', 'Detect if stream ends but finish_reason is missing'],
  ['生成友好的错误信息（限制500字以内）', 'Generate friendly error message (limited to 500 characters)'],
  ['验证正常响应中的finish_reason（原有逻辑保持不变）', 'Validate finish_reason in normal response (original logic remains unchanged)'],
  ['记录原始finish reason', 'Record original finish reason'],
  ['对于正常响应，只有明确为\'unknown\'时才处理', 'For normal responses, only process when explicitly "unknown"'],
  ['记录有效的finish reason', 'Record valid finish reason'],
  ['智能检测：判断数据是否需要处理', 'Smart detection: Determine if data needs processing'],
  ['检查绕过条件', 'Check bypass conditions'],
  ['检测输入是否需要预处理', 'Detect if input needs preprocessing'],
  ['检查消息中是否包含工具调用内容', 'Check if messages contain tool call content'],
  ['检测响应是否需要预处理', 'Detect if response needs preprocessing'],
  ['检查是否包含文本格式的工具调用', 'Check if text format tool calls are included'],
  ['检查OpenAI格式的工具调用', 'Check OpenAI format tool calls'],
  ['检测流式数据是否需要预处理', 'Detect if streaming data needs preprocessing'],
  ['检查流式事件中的工具调用', 'Check tool calls in streaming events'],
  ['滑动窗口工具调用检测 - 处理各种不规范格式', 'Sliding window tool call detection - Handle various non-standard formats'],
  ['分析单个窗口中的工具调用', 'Analyze tool calls in individual windows'],
  ['强制工具调用检测 - 不可配置关闭', 'Force tool call detection - Cannot be disabled by configuration'],
  ['使用滑动窗口解析各种不规范的工具调用格式', 'Use sliding window to parse various non-standard tool call formats'],
  ['简化的文本工具调用检测', 'Simplified text tool call detection'],
  ['CRITICAL FIX: ShuaiHong/ModelScope格式兼容性补丁', 'CRITICAL FIX: ShuaiHong/ModelScope format compatibility patch'],
  ['ShuaiHong/ModelScope格式兼容性补丁', 'ShuaiHong/ModelScope format compatibility patch'],
  ['解决 "OpenAI response missing choices" 错误', 'Solve "OpenAI response missing choices" error'],
  ['工具调用解析问题', 'Tool call parsing issue'],
  ['宽松准入条件 - 强制所有响应都进入预处理', 'Relaxed entry conditions - Force all responses to go through preprocessing'],
  ['强制工具调用检测和finish reason覆盖', 'Force tool call detection and finish reason override'],
  ['强制覆盖finish_reason', 'Force override finish_reason'],
  ['CRITICAL: 在预处理阶段检测unknown finish reason', 'CRITICAL: Detect unknown finish reason in preprocessing stage'],
  ['非正常响应直接抛出API错误', 'Abnormal response directly throws API error'],
  ['HTTP 200等正常情况才进行finish_reason处理', 'Only process finish_reason for normal cases like HTTP 200'],
  ['原有逻辑保持不变', 'Original logic remains unchanged'],
  ['后处理和一致性验证', 'Post-processing and consistency validation'],
  ['transformer后的处理层guard', 'Post-transformer processing layer guard'],
  ['统一finish reason记录点', 'Unified finish reason recording point'],
  ['集中模拟流式响应', 'Centralized streaming response simulation'],
  ['滑动窗口解析机制', 'Sliding window parsing mechanism'],
  ['检查各种不规范格式', 'Check various non-standard formats'],
  ['文本格式的工具调用', 'Text format tool calls'],
  ['非标准响应', 'Non-standard response'],
  ['正常响应', 'Normal response'],
  ['工具调用', 'Tool call'],
  ['响应', 'Response'],
  ['请求', 'Request'],
  ['预处理', 'Preprocessing'],
  ['流式', 'Streaming'],
  ['非流式', 'Non-streaming'],
  ['模型', 'Model'],
  ['提供者', 'Provider'],
  ['格式', 'Format'],
  ['字段', 'Field'],
  ['内容', 'Content'],
  ['参数', 'Parameters']
];

// 执行替换
for (const [chinese, english] of replacements) {
  // 转义特殊字符
  const escapedChinese = chinese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedChinese, 'g');
  content = content.replace(regex, english);
}

// 写回文件
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ 文件中的中文注释已替换为英文');