import { transformAnthropicToOpenAI } from './src/modules/transformers/anthropic-openai-converter';
import { SecureAnthropicToOpenAITransformer } from './src/modules/transformers/secure-anthropic-openai-transformer';

// 测试用例1: 包含工具定义的Anthropic请求
const anthropicRequestWithTools = {
  model: "claude-3-5-sonnet-20240620",
  messages: [
    {
      role: "user",
      content: "请使用工具获取当前天气信息"
    }
  ],
  tools: [
    {
      name: "get_weather",
      description: "获取指定城市的天气信息",
      input_schema: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "城市名称"
          }
        },
        required: ["city"]
      }
    }
  ],
  max_tokens: 1024,
  temperature: 0.7
};

// 测试用例2: 不包含工具定义的简单请求
const anthropicRequestWithoutTools = {
  model: "claude-3-5-sonnet-20240620",
  messages: [
    {
      role: "user",
      content: "你好，今天天气怎么样？"
    }
  ],
  max_tokens: 1024,
  temperature: 0.7
};

// 测试用例3: 包含系统消息的请求
const anthropicRequestWithSystem = {
  model: "claude-3-5-sonnet-20240620",
  system: "你是一个天气助手，请使用工具获取天气信息",
  messages: [
    {
      role: "user",
      content: "请告诉我北京的天气"
    }
  ],
  tools: [
    {
      name: "get_weather",
      description: "获取指定城市的天气信息",
      input_schema: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "城市名称"
          }
        },
        required: ["city"]
      }
    }
  ],
  max_tokens: 1024,
  temperature: 0.7
};

async function runTests() {
  console.log("🔍 开始测试转换器...\n");
  
  // 测试直接函数调用
  console.log("🧪 测试1: 直接函数调用 - 包含工具定义");
  const result1 = transformAnthropicToOpenAI(anthropicRequestWithTools);
  console.log("输入:", JSON.stringify(anthropicRequestWithTools, null, 2));
  console.log("输出:", JSON.stringify(result1, null, 2));
  console.log("输出类型:", typeof result1);
  console.log("是否为空对象:", result1 && typeof result1 === 'object' ? Object.keys(result1).length === 0 : 'N/A');
  console.log("\n" + "=".repeat(50) + "\n");
  
  console.log("🧪 测试2: 直接函数调用 - 不包含工具定义");
  const result2 = transformAnthropicToOpenAI(anthropicRequestWithoutTools);
  console.log("输入:", JSON.stringify(anthropicRequestWithoutTools, null, 2));
  console.log("输出:", JSON.stringify(result2, null, 2));
  console.log("输出类型:", typeof result2);
  console.log("是否为空对象:", result2 && typeof result2 === 'object' ? Object.keys(result2).length === 0 : 'N/A');
  console.log("\n" + "=".repeat(50) + "\n");
  
  console.log("🧪 测试3: 直接函数调用 - 包含系统消息");
  const result3 = transformAnthropicToOpenAI(anthropicRequestWithSystem);
  console.log("输入:", JSON.stringify(anthropicRequestWithSystem, null, 2));
  console.log("输出:", JSON.stringify(result3, null, 2));
  console.log("输出类型:", typeof result3);
  console.log("是否为空对象:", result3 && typeof result3 === 'object' ? Object.keys(result3).length === 0 : 'N/A');
  console.log("\n" + "=".repeat(50) + "\n");
  
  // 测试模块化调用
  console.log("🧪 测试4: 模块化调用 - 包含工具定义");
  const transformer = new SecureAnthropicToOpenAITransformer();
  await transformer.start();
  try {
    const result4 = await transformer.process(anthropicRequestWithTools);
    console.log("输入:", JSON.stringify(anthropicRequestWithTools, null, 2));
    console.log("输出:", JSON.stringify(result4, null, 2));
    console.log("输出类型:", typeof result4);
    console.log("是否为空对象:", result4 && typeof result4 === 'object' ? Object.keys(result4).length === 0 : 'N/A');
  } catch (error) {
    console.error("模块化调用出错:", error);
  }
  console.log("\n" + "=".repeat(50) + "\n");
  
  console.log("🧪 测试5: 模块化调用 - 不包含工具定义");
  try {
    const result5 = await transformer.process(anthropicRequestWithoutTools);
    console.log("输入:", JSON.stringify(anthropicRequestWithoutTools, null, 2));
    console.log("输出:", JSON.stringify(result5, null, 2));
    console.log("输出类型:", typeof result5);
    console.log("是否为空对象:", result5 && typeof result5 === 'object' ? Object.keys(result5).length === 0 : 'N/A');
  } catch (error) {
    console.error("模块化调用出错:", error);
  }
  console.log("\n" + "=".repeat(50) + "\n");
  
  console.log("🧪 测试6: 模块化调用 - 包含系统消息");
  try {
    const result6 = await transformer.process(anthropicRequestWithSystem);
    console.log("输入:", JSON.stringify(anthropicRequestWithSystem, null, 2));
    console.log("输出:", JSON.stringify(result6, null, 2));
    console.log("输出类型:", typeof result6);
    console.log("是否为空对象:", result6 && typeof result6 === 'object' ? Object.keys(result6).length === 0 : 'N/A');
  } catch (error) {
    console.error("模块化调用出错:", error);
  }
  
  console.log("\n✅ 测试完成!");
}

runTests().catch(console.error);