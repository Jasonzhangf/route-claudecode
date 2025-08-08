/**
 * OpenAI格式输入处理调试脚本
 * 项目所有者: Jason Zhang
 * 
 * 目标：直接测试UnifiedInputProcessor和OpenAIInputProcessor的canProcess方法
 * 来精确定位为什么OpenAI格式请求被拒绝
 */

// 模拟OpenAI格式的工具调用请求
const testRequests = [
  {
    name: 'OpenAI_Simple_Tool_Call',
    request: {
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: "Use the math calculator tool to calculate 157 * 234."
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "calculator",
            description: "Perform mathematical calculations",
            parameters: {
              type: "object",
              properties: {
                expression: {
                  type: "string",
                  description: "Mathematical expression to calculate"
                }
              },
              required: ["expression"]
            }
          }
        }
      ]
    }
  },
  {
    name: 'Anthropic_Simple_Tool_Call',
    request: {
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: "Use the math calculator tool to calculate 157 * 234."
        }
      ],
      tools: [
        {
          name: "calculator",
          description: "Perform mathematical calculations",
          input_schema: {
            type: "object",
            properties: {
              expression: {
                type: "string",
                description: "Mathematical expression to calculate"
              }
            },
            required: ["expression"]
          }
        }
      ]
    }
  }
];

/**
 * 模拟InputProcessor的canProcess方法
 */
function mockCanProcess() {
  console.log('🔍 模拟InputProcessor的canProcess检查');
  console.log('='.repeat(60));
  
  testRequests.forEach((testCase) => {
    console.log(`\n📋 测试案例: ${testCase.name}`);
    const request = testCase.request;
    
    // 模拟UnifiedInputProcessor的canProcess逻辑
    console.log('🧪 基本格式检查:');
    console.log(`  typeof request === 'object': ${typeof request === 'object'}`);
    console.log(`  request !== null: ${request !== null}`);
    console.log(`  Array.isArray(messages): ${Array.isArray(request.messages)}`);
    console.log(`  messages.length > 0: ${request.messages?.length > 0}`);
    
    // 模拟OpenAI格式检查
    console.log('\n🔧 OpenAI格式特定检查:');
    const hasSystemString = request.system === undefined || typeof request.system === 'string';
    console.log(`  system field ok: ${hasSystemString} (${typeof request.system})`);
    
    // 模拟isOpenAIToolsFormat检查
    console.log('\n🛠️  工具格式检查:');
    if (!request.tools) {
      console.log('  ✅ 无工具定义，通过');
    } else {
      console.log(`  工具数量: ${request.tools.length}`);
      request.tools.forEach((tool, index) => {
        console.log(`  工具[${index}]:`);
        console.log(`    type === 'function': ${tool.type === 'function'}`);
        console.log(`    has function: ${!!tool.function}`);
        console.log(`    function.name: ${typeof tool.function?.name} (${tool.function?.name})`);
        console.log(`    function.description: ${typeof tool.function?.description}`);
        console.log(`    function.parameters: ${typeof tool.function?.parameters}`);
        
        // 检查是否符合OpenAI格式
        const isValidOpenAITool = tool &&
          tool.type === 'function' &&
          tool.function &&
          typeof tool.function.name === 'string' &&
          typeof tool.function.description === 'string' &&
          tool.function.parameters &&
          typeof tool.function.parameters === 'object';
        
        console.log(`    ✅ OpenAI工具格式: ${isValidOpenAITool}`);
        
        // 检查是否符合Anthropic格式
        const hasAnthropicSchema = !tool.function && !!tool.input_schema;
        console.log(`    📝 Anthropic工具格式: ${hasAnthropicSchema}`);
      });
      
      // 整体判断
      const allOpenAIFormat = request.tools.every(tool =>
        tool &&
        tool.type === 'function' &&
        tool.function &&
        typeof tool.function.name === 'string' &&
        typeof tool.function.description === 'string' &&
        tool.function.parameters &&
        typeof tool.function.parameters === 'object'
      );
      console.log(`  📊 所有工具符合OpenAI格式: ${allOpenAIFormat}`);
    }
    
    // 综合判断
    const canProcessOpenAI = (
      typeof request === 'object' &&
      request !== null &&
      Array.isArray(request.messages) &&
      hasSystemString &&
      (!request.tools || request.tools.every(tool =>
        tool &&
        tool.type === 'function' &&
        tool.function &&
        typeof tool.function.name === 'string' &&
        typeof tool.function.description === 'string' &&
        tool.function.parameters &&
        typeof tool.function.parameters === 'object'
      ))
    );
    
    console.log(`\n🎯 OpenAI处理器canProcess结果: ${canProcessOpenAI ? '✅ 可处理' : '❌ 不可处理'}`);
    
    // 模拟Anthropic格式检查
    const canProcessAnthropic = (
      typeof request === 'object' &&
      request !== null &&
      Array.isArray(request.messages) &&
      // Anthropic可能有system作为数组
      (!request.tools || request.tools.every(tool =>
        tool && (tool.input_schema || (tool.function && tool.function.parameters))
      ))
    );
    
    console.log(`🎯 Anthropic处理器canProcess结果: ${canProcessAnthropic ? '✅ 可处理' : '❌ 不可处理'}`);
    
    // 总结
    const anyCanProcess = canProcessOpenAI || canProcessAnthropic;
    console.log(`\n📈 统一处理器最终结果: ${anyCanProcess ? '✅ 可处理' : '❌ 不可处理'}`);
    
    if (!anyCanProcess) {
      console.log('⚠️  这将导致"Request format not supported"错误！');
    }
  });
}

/**
 * 生成修复建议
 */
function generateFixRecommendations() {
  console.log('\n💡 修复建议分析');
  console.log('='.repeat(60));
  
  console.log('\n🔍 问题分析:');
  console.log('1. OpenAIInputProcessor的canProcess方法可能过于严格');
  console.log('2. isOpenAIToolsFormat验证逻辑可能存在Bug');
  console.log('3. 需要详细检查每个验证步骤');
  
  console.log('\n🔧 建议的修复步骤:');
  console.log('1. 在OpenAIInputProcessor中添加更详细的调试日志');
  console.log('2. 检查isOpenAIToolsFormat方法的实现');
  console.log('3. 确保OpenAI格式的tools能够正确通过验证');
  console.log('4. 测试修复后的效果');
  
  console.log('\n📁 需要检查的文件:');
  console.log('- src/input/openai/processor.ts (canProcess方法)');
  console.log('- src/input/openai/processor.ts (isOpenAIToolsFormat方法)');
  console.log('- src/input/unified-processor.ts (处理器选择逻辑)');
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 OpenAI格式输入处理调试分析');
  console.log('目标：模拟和分析为什么OpenAI格式请求被拒绝');
  console.log('='.repeat(60));
  
  mockCanProcess();
  generateFixRecommendations();
  
  console.log('\n🎯 下一步行动:');
  console.log('1. 基于上述分析修复OpenAIInputProcessor');
  console.log('2. 添加更详细的调试日志');
  console.log('3. 重新测试OpenAI格式工具调用');
}

main();