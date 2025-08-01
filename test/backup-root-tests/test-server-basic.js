#!/usr/bin/env node

/**
 * Basic Server Test - 最基础的服务器连接测试
 */

const fetch = require('node-fetch');

async function testBasicConnection() {
  console.log('🔧 Testing basic server connection...');
  
  try {
    // 测试健康检查
    console.log('1. Testing health check...');
    const healthResponse = await fetch('http://localhost:8888/health', {
      timeout: 5000
    });
    
    console.log(`Health check status: ${healthResponse.status}`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health check passed:', healthData);
    } else {
      console.log('❌ Health check failed');
      return;
    }
    
    // 测试状态端点
    console.log('\n2. Testing status endpoint...');
    const statusResponse = await fetch('http://localhost:8888/status', {
      timeout: 5000
    });
    
    console.log(`Status endpoint status: ${statusResponse.status}`);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ Status endpoint passed');
      console.log('Providers:', statusData.providers?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Server is not running on port 8888');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 Cannot resolve localhost');
    } else {
      console.log('💡 Network error or timeout');
    }
  }
}

async function main() {
  console.log('=== Basic Server Connection Test ===\n');
  await testBasicConnection();
}

main().catch(console.error);