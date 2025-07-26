#!/usr/bin/env node

/**
 * 测试demo2（kiro2cc）的各个流程并记录响应数据
 * 用作我们自己测试的输入输出参考
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试用例
const testCases = [
  {
    name: "simple_greeting",
    description: "简单问候测试",
    request: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: "Hello, can you help me with a simple task?"
        }
      ]
    }
  },
  {
    name: "multi_turn_conversation",
    description: "多轮对话测试",
    request: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: "What is the capital of France?"
        },
        {
          role: "assistant",
          content: "The capital of France is Paris."
        },
        {
          role: "user",
          content: "What about Germany?"
        }
      ]
    }
  },
  {
    name: "with_system_message",
    description: "带系统消息的测试",
    request: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: [
        {
          type: "text",
          text: "You are a helpful assistant that always responds in a friendly manner."
        }
      ],
      messages: [
        {
          role: "user",
          content: "Tell me a joke."
        }
      ]
    }
  },
  {
    name: "with_tools",
    description: "带工具的测试",
    request: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [
        {
          name: "get_weather",
          description: "Get the current weather for a location",
          input_schema: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA"
              }
            },
            required: ["location"]
          }
        }
      ],
      messages: [
        {
          role: "user",
          content: "What's the weather like in San Francisco?"
        }
      ]
    }
  }
];

// 创建输出目录
const outputDir = 'demo2-test-data';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function testDemo2NonStreaming(testCase) {
  console.log(`\n🔍 Testing demo2 non-streaming: ${testCase.name}`);
  
  try {
    const startTime = Date.now();
    const response = await axios.post('http://localhost:8080/v1/messages', testCase.request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });
    const endTime = Date.now();
    
    const result = {
      testCase: testCase.name,
      description: testCase.description,
      type: 'non-streaming',
      timestamp: new Date().toISOString(),
      duration: endTime - startTime,
      request: testCase.request,
      response: {
        status: response.status,
        headers: response.headers,
        data: response.data
      }
    };
    
    // 保存结果
    const filename = `${testCase.name}_non_streaming.json`;
    fs.writeFileSync(
      path.join(outputDir, filename), 
      JSON.stringify(result, null, 2)
    );
    
    console.log(`✅ Demo2 non-streaming response saved to ${filename}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Duration: ${endTime - startTime}ms`);
    console.log(`   Content blocks: ${response.data.content?.length || 0}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Demo2 non-streaming failed: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function testDemo2Streaming(testCase) {
  console.log(`\n🔍 Testing demo2 streaming: ${testCase.name}`);
  
  try {
    const streamRequest = { ...testCase.request, stream: true };
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:8080/v1/messages', streamRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      responseType: 'stream',
      timeout: 30000
    });
    
    const events = [];
    let buffer = '';
    
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        
        // 解析SSE事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一行（可能不完整）
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.substring(7);
            events.push({ event: eventType, data: null });
          } else if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            try {
              const data = JSON.parse(dataStr);
              if (events.length > 0) {
                events[events.length - 1].data = data;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });
      
      response.data.on('end', () => {
        const endTime = Date.now();
        
        const result = {
          testCase: testCase.name,
          description: testCase.description,
          type: 'streaming',
          timestamp: new Date().toISOString(),
          duration: endTime - startTime,
          request: streamRequest,
          response: {
            status: response.status,
            headers: response.headers,
            events: events
          }
        };
        
        // 保存结果
        const filename = `${testCase.name}_streaming.json`;
        fs.writeFileSync(
          path.join(outputDir, filename), 
          JSON.stringify(result, null, 2)
        );
        
        console.log(`✅ Demo2 streaming response saved to ${filename}`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Duration: ${endTime - startTime}ms`);
        console.log(`   Events: ${events.length}`);
        
        resolve(result);
      });
      
      response.data.on('error', (error) => {
        console.error(`❌ Demo2 streaming failed: ${error.message}`);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error(`❌ Demo2 streaming failed: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function testOurRouter(testCase) {
  console.log(`\n🔍 Testing our router: ${testCase.name}`);
  
  try {
    const startTime = Date.now();
    const response = await axios.post('http://localhost:3000/v1/messages', testCase.request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });
    const endTime = Date.now();
    
    const result = {
      testCase: testCase.name,
      description: testCase.description,
      type: 'our-router',
      timestamp: new Date().toISOString(),
      duration: endTime - startTime,
      request: testCase.request,
      response: {
        status: response.status,
        headers: response.headers,
        data: response.data
      }
    };
    
    // 保存结果
    const filename = `${testCase.name}_our_router.json`;
    fs.writeFileSync(
      path.join(outputDir, filename), 
      JSON.stringify(result, null, 2)
    );
    
    console.log(`✅ Our router response saved to ${filename}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Duration: ${endTime - startTime}ms`);
    console.log(`   Content blocks: ${response.data.content?.length || 0}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Our router failed: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function compareResponses(demo2Result, ourResult) {
  if (!demo2Result || !ourResult) {
    console.log('❌ Cannot compare - missing results');
    return;
  }
  
  console.log(`\n📊 Comparing responses for ${demo2Result.testCase}:`);
  
  const demo2Data = demo2Result.response.data;
  const ourData = ourResult.response.data;
  
  // 比较基本结构
  console.log('🔍 Basic structure:');
  console.log(`   Demo2 keys: ${Object.keys(demo2Data)}`);
  console.log(`   Our keys: ${Object.keys(ourData)}`);
  
  // 比较关键字段
  const keyFields = ['content', 'model', 'role', 'stop_reason', 'type', 'usage'];
  keyFields.forEach(field => {
    const demo2Value = demo2Data[field];
    const ourValue = ourData[field];
    const match = JSON.stringify(demo2Value) === JSON.stringify(ourValue);
    console.log(`   ${field}: ${match ? '✅' : '❌'}`);
    if (!match) {
      console.log(`     Demo2: ${JSON.stringify(demo2Value)}`);
      console.log(`     Ours:  ${JSON.stringify(ourValue)}`);
    }
  });
  
  // 保存比较结果
  const comparison = {
    testCase: demo2Result.testCase,
    timestamp: new Date().toISOString(),
    demo2: demo2Data,
    ours: ourData,
    differences: {}
  };
  
  keyFields.forEach(field => {
    const demo2Value = demo2Data[field];
    const ourValue = ourData[field];
    const match = JSON.stringify(demo2Value) === JSON.stringify(ourValue);
    comparison.differences[field] = {
      match,
      demo2: demo2Value,
      ours: ourValue
    };
  });
  
  const filename = `${demo2Result.testCase}_comparison.json`;
  fs.writeFileSync(
    path.join(outputDir, filename), 
    JSON.stringify(comparison, null, 2)
  );
  
  console.log(`📄 Comparison saved to ${filename}`);
}

async function main() {
  console.log('🚀 Starting demo2 response testing and data collection...\n');
  
  // 检查demo2服务器是否运行
  try {
    await axios.get('http://localhost:8080/health', { timeout: 5000 });
    console.log('✅ Demo2 server is running on port 8080');
  } catch (error) {
    console.error('❌ Demo2 server is not running on port 8080');
    console.log('💡 Please start demo2 server first:');
    console.log('   cd examples/demo2 && go run main.go server');
    return;
  }
  
  // 检查我们的路由器是否运行
  try {
    await axios.get('http://localhost:3000/health', { timeout: 5000 });
    console.log('✅ Our router is running on port 3000');
  } catch (error) {
    console.error('❌ Our router is not running on port 3000');
    console.log('💡 Please start our router first');
  }
  
  console.log(`\n📁 Test data will be saved to: ${outputDir}/\n`);
  
  // 运行所有测试用例
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Testing: ${testCase.description}`);
    console.log(`${'='.repeat(60)}`);
    
    // 测试demo2非流式
    const demo2Result = await testDemo2NonStreaming(testCase);
    
    // 测试demo2流式
    await testDemo2Streaming(testCase);
    
    // 测试我们的路由器
    const ourResult = await testOurRouter(testCase);
    
    // 比较结果
    if (demo2Result && ourResult) {
      await compareResponses(demo2Result, ourResult);
    }
    
    // 等待一下再进行下一个测试
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✨ All tests completed!');
  console.log(`📁 Check ${outputDir}/ for detailed results`);
}

main().catch(console.error);