import { transformAnthropicToOpenAI } from './src/modules/transformers/anthropic-openai-converter';
import { SecureAnthropicToOpenAITransformer } from './src/modules/transformers/secure-anthropic-openai-transformer';
import { secureLogger } from './src/utils/secure-logger';

// 测试用例1: 包含工具定义的Anthropic请求
const testInput1 = {
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "列出本地文件"
        }
      ]
    }
  ],
  "tools": [
    {
      "name": "list_files",
      "description": "List files in directory",
      "input_schema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          }
        },
        "required": ["path"]
      }
    }
  ],
  "max_tokens": 4096,
  "temperature": 0.7,
  "stream": false
};

// 测试用例2: 复杂的工具定义
const testInput2 = {
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {
      "role": "user",
      "content": "帮我创建一个文件夹并写入一些内容"
    }
  ],
  "tools": [
    {
      "name": "create_directory",
      "description": "Create a new directory",
      "input_schema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "The path where to create the directory"
          }
        },
        "required": ["path"]
      }
    },
    {
      "name": "write_file",
      "description": "Write content to a file",
      "input_schema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "The file path to write to"
          },
          "content": {
            "type": "string",
            "description": "The content to write"
          }
        },
        "required": ["path", "content"]
      }
    }
  ],
  "max_tokens": 4096,
  "temperature": 0.7
};

async function testTransformer() {
  console.log('🧪 开始测试转换器修复...');
  
  // 测试直接转换函数
  console.log('\n=== 测试直接转换函数 ===');
  
  console.log('\n📝 测试用例1: 基本工具定义');
  const result1 = transformAnthropicToOpenAI(testInput1);
  console.log('输入工具数量:', testInput1.tools?.length);
  console.log('输出工具数量:', result1.tools?.length);
  console.log('输出是否为空对象:', Object.keys(result1).length === 0);
  console.log('输出是否包含调试错误:', !!result1.__debug_error);
  console.log('输出结果:', JSON.stringify(result1, null, 2));
  
  console.log('\n📝 测试用例2: 复杂工具定义');
  const result2 = transformAnthropicToOpenAI(testInput2);
  console.log('输入工具数量:', testInput2.tools?.length);
  console.log('输出工具数量:', result2.tools?.length);
  console.log('输出是否为空对象:', Object.keys(result2).length === 0);
  console.log('输出是否包含调试错误:', !!result2.__debug_error);
  console.log('输出结果:', JSON.stringify(result2, null, 2));
  
  // 测试安全转换器模块
  console.log('\n=== 测试安全转换器模块 ===');
  
  const transformer = new SecureAnthropicToOpenAITransformer();
  await transformer.start();
  
  console.log('\n📝 测试用例1: 基本工具定义');
  try {
    const moduleResult1 = await transformer.process(testInput1);
    console.log('模块输出是否为空对象:', Object.keys(moduleResult1).length === 0);
    console.log('模块输出结果:', JSON.stringify(moduleResult1, null, 2));
  } catch (error) {
    console.error('模块处理出错:', error);
  }
  
  console.log('\n📝 测试用例2: 复杂工具定义');
  try {
    const moduleResult2 = await transformer.process(testInput2);
    console.log('模块输出是否为空对象:', Object.keys(moduleResult2).length === 0);
    console.log('模块输出结果:', JSON.stringify(moduleResult2, null, 2));
  } catch (error) {
    console.error('模块处理出错:', error);
  }
  
  await transformer.stop();
  console.log('\n✅ 测试完成');
}

testTransformer().catch(console.error);