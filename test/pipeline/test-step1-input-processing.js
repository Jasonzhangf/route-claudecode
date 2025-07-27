#!/usr/bin/env node
/**
 * 测试用例: 第一步输入处理验证
 * 测试目标: 验证API请求链路通畅性，确保请求成功发送并收到响应
 * Step 1: 测试输入处理模块 - 验证原始请求如何被处理和路由
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

async function testStep1() {
  console.log('🔍 Step 1: Testing Input Processing');
  
  const testRequest = {
    model: "claude-3-5-haiku-20241022",
    messages: [{ role: "user", content: "hello test" }],
    stream: false
  };
  
  console.log('📥 Input Request:', JSON.stringify(testRequest, null, 2));
  
  try {
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('📤 Raw Response:', JSON.stringify(response.data, null, 2));
    
    // Save outputs for next step
    const outputs = {
      timestamp: new Date().toISOString(),
      step: 'step1-input-processing',
      input: testRequest,
      output: response.data,
      success: true
    };
    
    fs.writeFileSync('step1-output.json', JSON.stringify(outputs, null, 2));
    console.log('✅ Step 1 completed - output saved to step1-output.json');
    
    return outputs;
    
  } catch (error) {
    console.error('❌ Step 1 failed:', error.response?.data || error.message);
    
    const outputs = {
      timestamp: new Date().toISOString(),
      step: 'step1-input-processing',
      input: testRequest,
      output: null,
      error: error.response?.data || error.message,
      success: false
    };
    
    fs.writeFileSync('step1-output.json', JSON.stringify(outputs, null, 2));
    return outputs;
  }
}

// 运行测试
if (require.main === module) {
  testStep1().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { testStep1 };