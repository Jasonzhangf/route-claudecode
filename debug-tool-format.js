#!/usr/bin/env node
/**
 * 调试工具格式转换问题
 */

console.log('OpenAI格式工具:');
const openaiTool = {
  type: "function",
  function: {
    name: "get_weather", 
    parameters: { type: "object", properties: {} }
  }
};
console.log(JSON.stringify(openaiTool, null, 2));

console.log('\nAnthropic格式工具:');
const anthropicTool = {
  name: "get_weather",
  input_schema: { type: "object", properties: {} }
};
console.log(JSON.stringify(anthropicTool, null, 2));

console.log('\n当前convertTools方法只检查tool.function，但Anthropic格式没有这个字段！');