#!/usr/bin/env node

/**
 * 调试工具对象结构
 * 理解为什么工具名称在标准化过程中丢失
 */

console.log('🔍 调试工具对象结构...');
console.log('=' + '='.repeat(50));

// 模拟工具定义
const testTools = [
  {
    name: "ValidTool",
    description: "A valid tool",
    input_schema: {
      type: "object", 
      properties: {
        param: { type: "string", description: "Valid parameter" }
      },
      required: ["param"]
    }
  },
  {
    name: "ProblematicTool",
    description: "This tool has malformed input_schema", 
    input_schema: {
      type: "object",
      properties: {
        test: "invalid_format"  // 错误格式
      }
    }
  }
];

function analyzeToolStructure() {
  testTools.forEach((tool, index) => {
    console.log(`\n🔍 工具 ${index} 结构分析:`);
    console.log(`名称: "${tool.name}" (类型: ${typeof tool.name})`);
    console.log(`描述: "${tool.description}" (类型: ${typeof tool.description})`);
    console.log(`有name属性: ${!!tool.name}`);
    console.log(`有function属性: ${!!tool.function}`);
    console.log(`有input_schema属性: ${!!tool.input_schema}`);
    
    // 检查条件匹配
    console.log(`\n📋 条件匹配:`);
    console.log(`- tool.function && typeof tool.function === 'object': ${tool.function && typeof tool.function === 'object'}`);
    console.log(`- tool.name (直接格式检查): ${!!tool.name}`);
    
    if (tool.input_schema) {
      console.log(`\n📝 input_schema 内容:`);
      console.log(`类型: ${tool.input_schema.type}`);
      console.log(`属性数量: ${Object.keys(tool.input_schema.properties || {}).length}`);
      if (tool.input_schema.properties) {
        Object.entries(tool.input_schema.properties).forEach(([key, value]) => {
          console.log(`  ${key}: ${JSON.stringify(value)} (类型: ${typeof value})`);
        });
      }
    }
  });
}

// 测试标准化逻辑
function simulateStandardization() {
  console.log('\n🧪 模拟标准化逻辑:');
  
  testTools.forEach((tool, index) => {
    console.log(`\n🔧 处理工具 ${index}: ${tool.name}`);
    
    let standardizedTool = {
      type: 'function'
    };
    
    // 模拟原始逻辑
    if (tool.function && typeof tool.function === 'object') {
      console.log('  → 路径: 使用现有function字段');
      standardizedTool.function = {
        name: tool.function.name || 'unknown',
        description: tool.function.description || `Function: ${tool.function.name || 'unknown'}`,
        parameters: tool.function.parameters || {}
      };
    } else if (tool.name) {
      console.log('  → 路径: 转换直接格式');
      standardizedTool.function = {
        name: tool.name,
        description: tool.description || `Function: ${tool.name}`,
        parameters: {}
      };
      
      if (tool.input_schema && typeof tool.input_schema === 'object') {
        console.log('  → 处理input_schema转换');
        // 这里应该调用convertInputSchemaToParameters
        standardizedTool.function.parameters = simulateInputSchemaConversion(tool.input_schema);
      }
    } else {
      console.log('  → 路径: 备用处理');
      const toolName = tool.name || tool.function?.name || `tool_${index}`;
      standardizedTool.function = {
        name: toolName,
        description: tool.description || `Function: ${toolName}`,
        parameters: {}
      };
    }
    
    console.log(`  ✅ 结果: name="${standardizedTool.function.name}", description="${standardizedTool.function.description}"`);
    console.log(`  ✅ 参数键数量: ${Object.keys(standardizedTool.function.parameters).length}`);
  });
}

function simulateInputSchemaConversion(inputSchema) {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return {};
  }
  
  const parameters = {
    type: inputSchema.type || 'object',
    properties: {},
    required: inputSchema.required || []
  };
  
  if (inputSchema.properties && typeof inputSchema.properties === 'object') {
    for (const [key, value] of Object.entries(inputSchema.properties)) {
      if (typeof value === 'string') {
        console.log(`    修复malformed属性 ${key}: "${value}" → {type: "string", description: "${value}"}`);
        parameters.properties[key] = {
          type: 'string',
          description: value
        };
      } else if (typeof value === 'object' && value !== null) {
        parameters.properties[key] = { ...value };
      } else {
        console.log(`    修复异常属性 ${key}: ${value} → {type: "string"}`);
        parameters.properties[key] = {
          type: 'string',
          description: `Parameter: ${key}`
        };
      }
    }
  }
  
  return parameters;
}

function main() {
  analyzeToolStructure();
  simulateStandardization();
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 结论:');
  console.log('✅ 工具对象结构正常，包含name和input_schema字段');
  console.log('✅ 标准化逻辑应该走"转换直接格式"路径');
  console.log('✅ malformed的input_schema可以被修复');
  console.log('🔍 如果实际测试中名称丢失，可能是其他代码问题');
}

main();