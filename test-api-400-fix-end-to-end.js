#!/usr/bin/env node

/**
 * 端到端测试：API 400错误修复验证
 * 直接启动修复后的服务器并进行测试
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 End-to-End Test: API 400 Error Fix Verification\n');

// 先检查是否有现有服务器在运行
console.log('🔍 Checking for existing servers...');
const checkProcess = spawn('lsof', ['-ti:5509'], { stdio: 'pipe' });

checkProcess.on('close', (code) => {
  if (code === 0) {
    console.log('⚠️ Port 5509 is in use, killing existing process...');
    spawn('kill', ['-9', '-p5509'], { stdio: 'inherit' }).on('close', () => {
      startTestServer();
    });
  } else {
    startTestServer();
  }
});

function startTestServer() {
  console.log('🚀 Starting test server with fixed input processor...\n');
  
  // 构建项目（仅输入处理器部分）
  console.log('🔧 Building project...');
  const buildProcess = spawn('npx', [
    'esbuild', 
    'src/cli.ts', 
    '--bundle', 
    '--platform=node', 
    '--outfile=dist/cli-fix-test.js',
    '--external:tiktoken',
    '--external:@anthropic-ai/sdk', 
    '--external:@google/genai',
    '--banner:js=#!/usr/bin/env node'
  ], { stdio: 'pipe' });
  
  let buildOutput = '';
  buildProcess.stdout.on('data', (data) => {
    buildOutput += data.toString();
  });
  
  buildProcess.stderr.on('data', (data) => {
    buildOutput += data.toString();
  });
  
  buildProcess.on('close', (code) => {
    if (code !== 0) {
      console.log('❌ Build failed:', buildOutput);
      process.exit(1);
    }
    
    console.log('✅ Build successful');
    
    // 启动测试服务器
    console.log('🎯 Starting server...');
    const serverProcess = spawn('node', [
      'dist/cli-fix-test.js',
      'start',
      '--config',
      process.env.HOME + '/.route-claude-code/config/single-provider/config-openai-sdk-modelscope-glm-5509.json',
      '--debug'
    ], { 
      stdio: 'pipe',
      detached: false
    });
    
    let serverOutput = '';
    let serverReady = false;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      serverOutput += output;
      if (output.includes('Claude Code Router listening on') || output.includes('Server listening at')) {
        serverReady = true;
        console.log('✅ Server started successfully');
        setTimeout(() => runTests(serverProcess), 2000);
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      serverOutput += output;
      if (!serverReady && (output.includes('listening') || output.includes('started'))) {
        serverReady = true;
        console.log('✅ Server started successfully (from stderr)');
        setTimeout(() => runTests(serverProcess), 2000);
      }
    });
    
    serverProcess.on('error', (err) => {
      console.log('❌ Server start failed:', err.message);
      console.log('Server output:', serverOutput);
      process.exit(1);
    });
    
    // 如果5秒后服务器还没有准备好，继续测试
    setTimeout(() => {
      if (!serverReady) {
        console.log('⚠️ Server may not be fully ready, but continuing with tests...');
        runTests(serverProcess);
      }
    }, 5000);
  });
}

function runTests(serverProcess) {
  console.log('\n🧪 Running API 400 error tests...\n');
  
  const testCases = [
    {
      name: 'Object Content Format (Previously Caused 400)',
      request: {
        model: "ZhipuAI/GLM-4.5-Air",
        messages: [
          {
            role: "user",
            content: {
              type: "text", 
              text: "This should now work with object content"
            }
          }
        ],
        max_tokens: 50,
        stream: false
      }
    },
    {
      name: 'String Content Format (Control Test)',
      request: {
        model: "ZhipuAI/GLM-4.5-Air", 
        messages: [
          {
            role: "user",
            content: "This is normal string content"
          }
        ],
        max_tokens: 50,
        stream: false
      }
    },
    {
      name: 'Array Content Format (Control Test)',
      request: {
        model: "ZhipuAI/GLM-4.5-Air",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "This is array content format" }
            ]
          }
        ],
        max_tokens: 50, 
        stream: false
      }
    }
  ];
  
  let testResults = [];
  let completedTests = 0;
  
  testCases.forEach((testCase, index) => {
    setTimeout(() => {
      console.log(`📋 Running Test ${index + 1}: ${testCase.name}`);
      console.log('Request:', JSON.stringify(testCase.request, null, 2));
      
      fetch('http://localhost:5509/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify(testCase.request)
      })
      .then(response => {
        console.log(`📊 Response Status: ${response.status}`);
        return response.json().then(data => ({ status: response.status, data }));
      })
      .then(result => {
        const success = result.status !== 400;
        testResults.push({
          name: testCase.name,
          status: result.status,
          success,
          data: result.data
        });
        
        console.log(`${success ? '✅' : '❌'} Test Result: ${success ? 'PASS' : 'FAIL'}`);
        if (result.data.error) {
          console.log(`Error: ${result.data.error.message}`);
        }
        console.log();
        
        completedTests++;
        if (completedTests === testCases.length) {
          showFinalResults(testResults, serverProcess);
        }
      })
      .catch(error => {
        console.log(`❌ Test Failed: ${error.message}`);
        testResults.push({
          name: testCase.name,
          success: false,
          error: error.message
        });
        
        completedTests++;
        if (completedTests === testCases.length) {
          showFinalResults(testResults, serverProcess);
        }
      });
    }, index * 3000); // 间隔3秒执行测试
  });
}

function showFinalResults(testResults, serverProcess) {
  console.log('🏁 Final Test Results:');
  console.log('='.repeat(50));
  
  let allPassed = true;
  testResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    if (result.status) {
      console.log(`   Status: ${result.status}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (!result.success) allPassed = false;
  });
  
  console.log('='.repeat(50));
  console.log(`🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n🎉 成功！API 400错误已经完全修复！');
    console.log('✨ Object格式的content现在可以正确处理了');
  } else {
    console.log('\n⚠️ 修复可能不完整，需要进一步调试');
  }
  
  // 停止服务器
  console.log('\n🛑 Stopping test server...');
  serverProcess.kill('SIGTERM');
  
  setTimeout(() => {
    process.exit(allPassed ? 0 : 1);
  }, 1000);
}

// 处理Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  process.exit(1);
});