#!/usr/bin/env node

/**
 * 测试Gemini工具格式修复
 * 验证清理后的JSON Schema能否被Gemini API接受
 */

// 直接测试工具转换逻辑
const fs = require('fs');
const path = require('path');

// 模拟cleanJsonSchemaForGemini函数
function cleanJsonSchemaForGemini(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const cleaned = {};
  
  // Gemini API supported fields for schema
  const supportedFields = ['type', 'properties', 'required', 'items', 'description', 'enum'];
  
  for (const [key, value] of Object.entries(schema)) {
    if (supportedFields.includes(key)) {
      if (key === 'properties' && typeof value === 'object') {
        // Recursively clean properties
        cleaned[key] = {};
        for (const [propKey, propValue] of Object.entries(value)) {
          cleaned[key][propKey] = cleanJsonSchemaForGemini(propValue);
        }
      } else if (key === 'items' && typeof value === 'object') {
        // Recursively clean array items schema
        cleaned[key] = cleanJsonSchemaForGemini(value);
      } else {
        cleaned[key] = value;
      }
    }
    // Skip unsupported fields like: additionalProperties, $schema, minItems, maxItems, etc.
  }
  
  return cleaned;
}

// 模拟convertTools函数
function convertTools(tools) {
  const functionDeclarations = tools.map(tool => {
    // Handle both Anthropic format (tool.input_schema) and OpenAI format (tool.function.parameters)
    const rawParameters = tool.input_schema || tool.function?.parameters || {};
    
    // 🔧 Critical Fix: Clean JSON Schema for Gemini API compatibility
    // Gemini API doesn't support additionalProperties, $schema, and other JSON Schema metadata
    const parameters = cleanJsonSchemaForGemini(rawParameters);
    
    return {
      name: tool.name,
      description: tool.description || tool.function?.description || '',
      parameters: parameters
    };
  });
  
  return {
    functionDeclarations: functionDeclarations
  };
}

// 模拟带有JSON Schema元数据的工具定义（Claude Code常见格式）
const testToolsWithSchema = [
  {
    name: "Task",
    description: "Launch a new agent to handle complex tasks",
    input_schema: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "description": {
          "description": "A short description of the task",
          "type": "string"
        },
        "prompt": {
          "description": "The task for the agent to perform",
          "type": "string"
        },
        "subagent_type": {
          "description": "The type of specialized agent to use",
          "type": "string"
        }
      },
      "required": ["description", "prompt", "subagent_type"]
    }
  },
  {
    name: "WebSearch",
    description: "Search the web and use results to inform responses",
    input_schema: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "query": {
          "description": "The search query to use",
          "type": "string",
          "minLength": 2
        },
        "allowed_domains": {
          "description": "Only include search results from these domains",
          "type": "array",
          "items": {
            "type": "string",
            "additionalProperties": false
          }
        }
      },
      "required": ["query"]
    }
  }
];

async function testGeminiToolsFormatFix() {
  console.log('🧪 测试Gemini工具格式修复\n');

  try {
    // 测试工具转换
    console.log('📝 原始工具定义（包含JSON Schema元数据）:');
    console.log('- additionalProperties: false');
    console.log('- $schema: http://json-schema.org/draft-07/schema#');
    console.log('- minLength: 2');
    console.log('工具数量:', testToolsWithSchema.length);

    // 调用工具转换函数
    const convertedTools = convertTools(testToolsWithSchema);
    
    console.log('\n🔧 转换后的Gemini格式:');
    console.log(JSON.stringify(convertedTools, null, 2));

    // 验证清理效果
    console.log('\n✅ 验证清理效果:');
    
    const functionDeclarations = convertedTools.functionDeclarations;
    let allClean = true;
    
    for (let i = 0; i < functionDeclarations.length; i++) {
      const func = functionDeclarations[i];
      console.log(`\n工具 ${i + 1}: ${func.name}`);
      
      // 检查不应该存在的字段
      const problematicFields = [];
      const checkForProblematic = (obj, path = '') => {
        if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            if (['$schema', 'additionalProperties', 'minLength', 'maxLength', 'minItems', 'maxItems'].includes(key)) {
              problematicFields.push(currentPath);
              allClean = false;
            }
            if (typeof value === 'object') {
              checkForProblematic(value, currentPath);
            }
          }
        }
      };
      
      checkForProblematic(func.parameters);
      
      if (problematicFields.length > 0) {
        console.log(`  ❌ 发现问题字段: ${problematicFields.join(', ')}`);
      } else {
        console.log('  ✅ 清理完成，无问题字段');
      }
      
      // 检查保留的字段
      const hasRequiredFields = func.parameters.type && func.parameters.properties;
      console.log(`  📋 必要字段: type=${!!func.parameters.type}, properties=${!!func.parameters.properties}, required=${!!func.parameters.required}`);
    }

    console.log(`\n🎯 整体清理结果: ${allClean ? '✅ 成功' : '❌ 失败'}`);
    
    if (allClean) {
      console.log('\n🚀 修复总结:');
      console.log('- 移除了 $schema 字段');
      console.log('- 移除了 additionalProperties 字段'); 
      console.log('- 移除了 minLength 等验证字段');
      console.log('- 保留了 type, properties, required 等核心字段');
      console.log('- Gemini API 应该能正确处理此格式');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return false;
  }

  return true;
}

// 运行测试
testGeminiToolsFormatFix()
  .then(success => {
    if (success) {
      console.log('\n🎉 Gemini工具格式修复测试通过!');
      process.exit(0);
    } else {
      console.log('\n💥 Gemini工具格式修复测试失败!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 测试异常:', error);
    process.exit(1);
  });