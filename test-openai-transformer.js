/**
 * OpenAI Transformer Unit Test
 * 测试工具转换功能的正确性
 */

console.log('🧪 OpenAI Transformer Tool Conversion Unit Test');
console.log('==============================================');

// Import the transformer
import('./dist/v3/transformer/openai-transformer.js')
  .then(module => {
    const { OpenAITransformer } = module;
    const transformer = new OpenAITransformer();
    
    console.log('✅ Transformer loaded successfully');
    console.log('Transformer name:', transformer.name);
    console.log('Transformer version:', transformer.version);
    
    // Test data - typical Claude Code tool
    const testAnthropicTool = {
      name: 'Task',
      description: 'Launch a new agent to handle complex, multi-step tasks autonomously.',
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'A short description of the task' },
          prompt: { type: 'string', description: 'The task for the agent to perform' },
          subagent_type: { type: 'string', description: 'The type of specialized agent' }
        },
        required: ['description', 'prompt', 'subagent_type']
      }
    };
    
    console.log('\n🔧 Test Input (Anthropic Tool):');
    console.log(JSON.stringify(testAnthropicTool, null, 2));
    
    // Test the convertAnthropicToolsToOpenAI method
    console.log('\n🔄 Running convertAnthropicToolsToOpenAI...');
    try {
      const result = transformer.convertAnthropicToolsToOpenAI([testAnthropicTool], 'test-request-id');
      
      console.log('\n✅ Conversion Result:');
      console.log(JSON.stringify(result, null, 2));
      
      // Validate the result
      if (result && result.length > 0) {
        const tool = result[0];
        
        console.log('\n🔍 Validation:');
        console.log('- Has type field:', Boolean(tool.type), '(', tool.type, ')');
        console.log('- Has function field:', Boolean(tool.function));
        console.log('- Function is object:', typeof tool.function === 'object');
        
        if (tool.function) {
          console.log('- Function.name:', tool.function.name);
          console.log('- Function.description:', Boolean(tool.function.description));
          console.log('- Function.parameters:', Boolean(tool.function.parameters));
          console.log('- Parameters.type:', tool.function.parameters?.type);
          console.log('- Parameters.properties:', Boolean(tool.function.parameters?.properties));
        } else {
          console.log('❌ CRITICAL: function field is undefined!');
        }
        
        // Check if this matches OpenAI format
        const isValidOpenAI = tool.type === 'function' && 
                             tool.function && 
                             typeof tool.function === 'object' &&
                             tool.function.name &&
                             tool.function.parameters;
        
        console.log('\n🎯 OpenAI Format Valid:', isValidOpenAI ? '✅ YES' : '❌ NO');
        
        // Test multiple tools (like Claude Code's 16 tools)
        console.log('\n🔄 Testing Multiple Tools...');
        const multipleTools = [
          testAnthropicTool,
          {
            name: 'Bash',
            description: 'Execute bash commands',
            input_schema: {
              type: 'object',
              properties: {
                command: { type: 'string', description: 'The command to execute' }
              },
              required: ['command']
            }
          },
          {
            name: 'Read',
            description: 'Read a file from filesystem',
            input_schema: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: 'Path to the file' }
              },
              required: ['file_path']
            }
          }
        ];
        
        const multiResult = transformer.convertAnthropicToolsToOpenAI(multipleTools, 'multi-test');
        console.log('Multiple tools result count:', multiResult.length);
        
        let allValid = true;
        multiResult.forEach((tool, index) => {
          const valid = tool.type === 'function' && 
                       tool.function && 
                       tool.function.name &&
                       tool.function.parameters;
          console.log(`- Tool ${index + 1} (${tool.function?.name || 'unknown'}):`, valid ? '✅' : '❌');
          if (!valid) {
            console.log('  Issues:', {
              hasType: Boolean(tool.type),
              hasFunction: Boolean(tool.function),
              hasName: Boolean(tool.function?.name),
              hasParameters: Boolean(tool.function?.parameters)
            });
            allValid = false;
          }
        });
        
        console.log('\n🎯 All Tools Valid:', allValid ? '✅ YES' : '❌ NO');
        
      } else {
        console.log('❌ No tools returned');
      }
      
    } catch (error) {
      console.log('❌ Error during conversion:', error.message);
      console.log('Stack:', error.stack);
    }
  })
  .catch(error => {
    console.log('❌ Failed to load transformer:', error.message);
    console.log('Stack:', error.stack);
  });