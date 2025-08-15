/**
 * Transformation Manager Unit Test
 * 测试完整的transformation manager工作流程
 */

console.log('🧪 Transformation Manager Unit Test');
console.log('=====================================');

// Import the transformation manager
import('./dist/v3/transformer/manager.js')
  .then(module => {
    const { transformationManager } = module;
    
    console.log('✅ Transformation Manager loaded successfully');
    
    // Test data - simulating Claude Code request with tools
    const testAnthropicRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: '简单测试Claude客户端连接'
        }
      ],
      tools: [
        {
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
        },
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
        }
      ],
      max_tokens: 1000,
      temperature: 1.0
    };
    
    console.log('\n🔧 Test Input (Anthropic Request):');
    console.log('- Model:', testAnthropicRequest.model);
    console.log('- Tools count:', testAnthropicRequest.tools.length);
    console.log('- Tool names:', testAnthropicRequest.tools.map(t => t.name));
    
    // Test the complete transformation through manager
    console.log('\n🔄 Running transformInput through TransformationManager...');
    
    const transformationContext = {
      provider: 'openai',
      direction: 'input',
      requestId: 'test-manager-001',
      originalRequest: testAnthropicRequest
    };
    
    transformationManager.transformInput(testAnthropicRequest, transformationContext)
      .then(transformedRequest => {
        console.log('\n✅ Transformation completed successfully');
        
        console.log('\n🔍 Transformed Request Analysis:');
        console.log('- Model:', transformedRequest.model);
        console.log('- Has tools:', Boolean(transformedRequest.tools));
        console.log('- Tools count:', transformedRequest.tools?.length || 0);
        
        if (transformedRequest.tools && transformedRequest.tools.length > 0) {
          console.log('\n🔧 Tools Analysis:');
          
          transformedRequest.tools.forEach((tool, index) => {
            console.log(`\\nTool ${index + 1}:`);
            console.log('- Type:', tool.type);
            console.log('- Has function:', Boolean(tool.function));
            console.log('- Function type:', typeof tool.function);
            
            if (tool.function) {
              console.log('- Function.name:', tool.function.name);
              console.log('- Function.description exists:', Boolean(tool.function.description));
              console.log('- Function.parameters exists:', Boolean(tool.function.parameters));
              
              // Check if parameters are valid
              if (tool.function.parameters) {
                console.log('- Parameters.type:', tool.function.parameters.type);
                console.log('- Parameters.properties exists:', Boolean(tool.function.parameters.properties));
              }
            } else {
              console.log('❌ CRITICAL: function field is undefined!');
            }
            
            // Validate OpenAI format
            const isValid = tool.type === 'function' && 
                           tool.function && 
                           tool.function.name &&
                           tool.function.parameters;
            
            console.log('- OpenAI format valid:', isValid ? '✅ YES' : '❌ NO');
          });
          
          // Overall validation
          const allToolsValid = transformedRequest.tools.every(tool => 
            tool.type === 'function' && 
            tool.function && 
            tool.function.name &&
            tool.function.parameters
          );
          
          console.log('\\n🎯 All Tools Valid:', allToolsValid ? '✅ YES' : '❌ NO');
          
          // Show exact structure that would be sent to LM Studio
          console.log('\\n📤 Exact JSON that would be sent to LM Studio:');
          console.log(JSON.stringify({
            model: transformedRequest.model,
            messages: transformedRequest.messages,
            tools: transformedRequest.tools,
            tool_choice: transformedRequest.tool_choice
          }, null, 2));
          
        } else {
          console.log('❌ No tools in transformed request');
        }
        
      })
      .catch(error => {
        console.log('❌ Transformation failed:', error.message);
        console.log('Stack:', error.stack);
      });
      
  })
  .catch(error => {
    console.log('❌ Failed to load transformation manager:', error.message);
    console.log('Stack:', error.stack);
  });