/**
 * Send a simple tool call request to trace data flow
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

async function sendToolRequest() {
    try {
        console.log('🚀 Sending tool call request to trace data flow...\n');
        
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
        
        const responseText = await response.text();
        console.log('📥 Response Body:');
        console.log(responseText);
        
        if (!response.ok) {
            console.log('❌ Request failed - this helps us see where tools are broken');
        } else {
            console.log('✅ Request successful');
        }
        
    } catch (error) {
        console.error('❌ Error sending request:', error);
    }
}

sendToolRequest();