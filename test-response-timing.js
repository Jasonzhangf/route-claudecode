#!/usr/bin/env node

/**
 * 响应时间分析测试脚本
 * 分析SSE处理vs后续处理的时间消耗
 */

const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

async function testResponseTiming() {
  console.log('🔍 开始响应时间分析测试...\n');
  
  const testData = {
    model: "claude-3-5-haiku-20241022", 
    messages: [
      {
        role: "user",
        content: "简单回复：你好"
      }
    ],
    max_tokens: 50,
    stream: true
  };

  const postData = JSON.stringify(testData);
  
  const options = {
    hostname: 'localhost',
    port: 3456,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let firstByteTime = null;
    let lastByteTime = null;
    let sseStartTime = null;
    let sseEndTime = null;
    let responseComplete = false;
    
    console.log(`⏱️  请求开始时间: ${new Date().toISOString()}`);
    
    const req = http.request(options, (res) => {
      firstByteTime = performance.now();
      console.log(`📊 状态码: ${res.statusCode}`);
      console.log(`⚡ 首字节时间: ${(firstByteTime - startTime).toFixed(2)}ms`);
      
      let buffer = '';
      let eventCount = 0;
      
      res.on('data', (chunk) => {
        if (!sseStartTime) {
          sseStartTime = performance.now();
          console.log(`🔥 SSE流开始时间: ${(sseStartTime - startTime).toFixed(2)}ms`);
        }
        
        buffer += chunk.toString();
        
        // 统计SSE事件
        const newlineCount = (chunk.toString().match(/\n\n/g) || []).length;
        eventCount += newlineCount;
        
        lastByteTime = performance.now();
      });
      
      res.on('end', () => {
        sseEndTime = performance.now();
        responseComplete = true;
        
        console.log(`\n📈 时间分析结果:`);
        console.log(`├─ 总请求时间: ${(sseEndTime - startTime).toFixed(2)}ms`);
        console.log(`├─ 首字节延迟: ${(firstByteTime - startTime).toFixed(2)}ms`);
        console.log(`├─ SSE流处理时间: ${(sseEndTime - sseStartTime).toFixed(2)}ms`);
        console.log(`├─ 前置处理时间: ${(sseStartTime - startTime).toFixed(2)}ms`);
        console.log(`└─ SSE事件数量: ${eventCount}`);
        
        // 分析瓶颈
        const preprocessTime = sseStartTime - startTime;
        const sseProcessTime = sseEndTime - sseStartTime;
        
        console.log(`\n🎯 瓶颈分析:`);
        if (preprocessTime > sseProcessTime * 2) {
          console.log(`⚠️  主要延迟在前置处理 (${preprocessTime.toFixed(2)}ms)`);
          console.log(`   - 可能是token刷新、认证或路由问题`);
        } else if (sseProcessTime > preprocessTime * 2) {
          console.log(`⚠️  主要延迟在SSE处理 (${sseProcessTime.toFixed(2)}ms)`);
          console.log(`   - 可能是服务器响应慢或网络问题`);
        } else {
          console.log(`✅ 各环节时间相对均衡`);
        }
        
        // 分析buffer内容
        console.log(`\n📝 响应内容分析:`);
        console.log(`├─ 总字节数: ${buffer.length}`);
        console.log(`├─ 包含'error': ${buffer.includes('error')}`);
        console.log(`├─ 包含'message_start': ${buffer.includes('message_start')}`);
        console.log(`├─ 包含'content_block_delta': ${buffer.includes('content_block_delta')}`);
        console.log(`└─ 包含'message_stop': ${buffer.includes('message_stop')}`);
        
        if (buffer.length < 200) {
          console.log(`\n📄 完整响应内容:`);
          console.log(buffer);
        } else {
          console.log(`\n📄 响应开头 (前200字符):`);
          console.log(buffer.substring(0, 200) + '...');
        }
        
        resolve({
          totalTime: sseEndTime - startTime,
          firstByteTime: firstByteTime - startTime,
          preprocessTime: sseStartTime - startTime,
          sseProcessTime: sseEndTime - sseStartTime,
          eventCount,
          responseLength: buffer.length,
          buffer
        });
      });
    });
    
    req.on('error', (err) => {
      console.error(`❌ 请求错误:`, err.message);
      reject(err);
    });
    
    req.on('timeout', () => {
      console.error(`⏰ 请求超时`);
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    // 设置30秒超时
    req.setTimeout(30000);
    
    req.write(postData);
    req.end();
  });
}

// 运行测试
testResponseTiming()
  .then((result) => {
    console.log(`\n✅ 测试完成 - 总时间: ${result.totalTime.toFixed(2)}ms`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ 测试失败:`, error.message);
    process.exit(1);
  });