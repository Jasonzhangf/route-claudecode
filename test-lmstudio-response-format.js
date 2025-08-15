/**
 * Test LM Studio Response Format
 * 测试LM Studio返回的响应格式是否符合OpenAI标准
 */

const toolCallRequest = {
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1000,
    "messages": [
        {
            "role": "user",
            "content": "Create a simple hello world bash script"
        }
    ],
    "tools": [
        {
            "name": "bash",
            "description": "Execute bash commands",
            "input_schema": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The bash command to execute"
                    }
                },
                "required": ["command"]
            }
        }
    ]
};

async function testLMStudioResponse() {
    console.log('🧪 Testing LM Studio Response Format...\n');
    
    try {
        console.log('📤 Sending request to LM Studio (port 5506)...');
        
        const response = await fetch('http://localhost:5506/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-key',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(toolCallRequest)
        });
        
        console.log('📥 Response Status:', response.status);
        console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Error Response Body:');
            console.log(errorText);
            return;
        }
        
        const responseText = await response.text();
        console.log('\n📋 Raw Response Body:');
        console.log(responseText);
        
        try {
            const responseData = JSON.parse(responseText);
            console.log('\n🔍 Parsed Response Structure:');
            console.log(`- Response type: ${typeof responseData}`);
            console.log(`- Has 'choices' field: ${!!responseData.choices}`);
            console.log(`- Choices is array: ${Array.isArray(responseData.choices)}`);
            console.log(`- Choices length: ${responseData.choices?.length || 0}`);
            
            if (responseData.choices && Array.isArray(responseData.choices) && responseData.choices.length > 0) {
                console.log('\n✅ Response has valid choices array');
                const choice = responseData.choices[0];
                console.log('📋 First Choice Structure:');
                console.log(`- Has message: ${!!choice.message}`);
                console.log(`- Message role: ${choice.message?.role}`);
                console.log(`- Message content: ${choice.message?.content ? 'YES' : 'NO'}`);
                console.log(`- Has tool_calls: ${!!choice.message?.tool_calls}`);
                console.log(`- Tool calls count: ${choice.message?.tool_calls?.length || 0}`);
                console.log(`- Finish reason: ${choice.finish_reason}`);
                
                if (choice.message?.tool_calls && Array.isArray(choice.message.tool_calls)) {
                    console.log('\n🔧 Tool Calls Analysis:');
                    choice.message.tool_calls.forEach((toolCall, index) => {
                        console.log(`Tool Call ${index}:`);
                        console.log(`  - id: ${toolCall.id}`);
                        console.log(`  - type: ${toolCall.type}`);
                        console.log(`  - function.name: ${toolCall.function?.name}`);
                        console.log(`  - function.arguments: ${toolCall.function?.arguments ? 'YES' : 'NO'}`);
                    });
                }
                
                console.log('\n🎯 This response should work with OpenAI transformer!');
            } else {
                console.log('\n❌ Response missing valid choices array!');
                console.log('🔍 This is why transformer fails with "Invalid OpenAI response: no choices"');
                
                // Check what fields are actually present
                console.log('\n📋 Available Response Fields:');
                Object.keys(responseData).forEach(key => {
                    console.log(`- ${key}: ${typeof responseData[key]}`);
                    if (Array.isArray(responseData[key])) {
                        console.log(`  └─ Array length: ${responseData[key].length}`);
                    }
                });
            }
            
        } catch (parseError) {
            console.error('❌ Failed to parse response as JSON:', parseError);
            console.log('🔍 This could indicate a streaming response or malformed JSON');
        }
        
    } catch (error) {
        console.error('❌ Request failed:', error);
    }
}

testLMStudioResponse();