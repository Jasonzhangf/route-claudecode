#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

// Simple test request with object content (the problem case)
const testRequest = {
    model: "ZhipuAI/GLM-4.5-Air",
    max_tokens: 200,
    messages: [{
        role: "user",
        content: {
            type: "text",
            text: "Test object content format"
        }
    }]
};

console.log('🧪 Simple Debug Test - Object Content Format');
console.log('============================================');

const tempFile = `/tmp/simple-test-${Date.now()}.json`;
fs.writeFileSync(tempFile, JSON.stringify(testRequest, null, 2));

console.log('📋 Request structure:', {
    model: testRequest.model,
    contentType: typeof testRequest.messages[0].content,
    contentIsObject: typeof testRequest.messages[0].content === 'object' && !Array.isArray(testRequest.messages[0].content)
});

console.log('📡 Sending request...');

try {
    const response = execSync(`curl -s -X POST http://127.0.0.1:5509/v1/messages \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer test-key" \
        -H "anthropic-version: 2023-06-01" \
        -d @${tempFile} \
        --connect-timeout 3 \
        --max-time 10`, {
        timeout: 15000,
        encoding: 'utf8'
    });

    let result;
    try {
        result = JSON.parse(response);
    } catch (e) {
        result = { raw: response };
    }

    if (result.error && result.error.code === "400") {
        console.log('❌ 400 Error still occurring - Fix not working');
        console.log('📄 Error:', result.error.message);
        console.log('📄 Provider:', result.error.provider);
    } else {
        console.log('✅ Request processed - Fix may be working');
        console.log('📄 Response type:', result.type || result.object);
    }

} catch (error) {
    console.log('💥 Request failed:', error.message);
} finally {
    fs.unlinkSync(tempFile);
}

console.log('\n⏳ Waiting for logs to appear...');

// Wait for logs and check for our debug messages
setTimeout(() => {
    console.log('\n📋 Checking server logs for debug output...');
    
    try {
        const logFiles = [
            '~/.route-claude-code/logs/port-5509/*/system.log',
            '~/.route-claude-code/logs/port-5509/*/pipeline.log'
        ].map(p => p.replace('~', process.env.HOME));
        
        for (const logPattern of logFiles) {
            try {
                const recentLogs = execSync(`tail -20 ${logPattern}`, { encoding: 'utf8' });
                if (recentLogs.includes('UNIVERSAL-FIX-DEBUG') || recentLogs.includes('DETECTED OBJECT CONTENT')) {
                    console.log('✅ Found universal fix debug logs:');
                    const lines = recentLogs.split('\n');
                    lines.forEach(line => {
                        if (line.includes('UNIVERSAL-FIX') || line.includes('DETECTED OBJECT')) {
                            console.log(`   ${line}`);
                        }
                    });
                } else {
                    console.log('❌ No universal fix debug logs found - method may not be called');
                }
            } catch (e) {
                // Skip if log file doesn't exist
            }
        }
        
    } catch (e) {
        console.log('⚠️ Could not read logs:', e.message);
    }
}, 3000);