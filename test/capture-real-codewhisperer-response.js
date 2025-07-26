#!/usr/bin/env node

/**
 * 捕获真实CodeWhisperer API响应样本
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

// 导入实际的请求数据
const realRequestData = JSON.parse(fs.readFileSync(path.join(__dirname, 'intercepted-request.json'), 'utf8'));

async function captureRealCodeWhispererResponse() {
  console.log('🎯 开始捕获真实CodeWhisperer响应...');

  try {
    // 读取Stage 3的转换结果作为CodeWhisperer请求
    const codewhispererRequestPath = path.join(__dirname, 'stage3-codewhisperer-request.json');
    if (!fs.existsSync(codewhispererRequestPath)) {
      throw new Error('找不到CodeWhisperer请求文件，请先运行Stage 3测试');
    }

    const codewhispererData = JSON.parse(fs.readFileSync(codewhispererRequestPath, 'utf8'));
    const codewhispererRequest = codewhispererData.codewhispererRequest;

    console.log('📋 使用实际请求数据发送CodeWhisperer API调用...');

    // 模拟实际的HTTP请求到CodeWhisperer
    const https = require('https');
    const { parse } = require('url');

    const endpoint = 'https://codewhisperer.us-east-1.amazonaws.com';
    const requestBody = JSON.stringify(codewhispererRequest);

    // 读取token
    const { CodeWhispererAuth } = require('../examples/demo2/src/auth/codewhisperer-auth');
    const auth = new CodeWhispererAuth();
    const token = await auth.getToken();

    const requestOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'User-Agent': 'Claude-Code-Router/2.0.0'
      }
    };

    const parsedUrl = parse(`${endpoint}/conversation`);
    Object.assign(requestOptions, {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path
    });

    console.log('🚀 发送请求到CodeWhisperer...');

    const response = await new Promise((resolve, reject) => {
      const req = https.request(requestOptions, (res) => {
        let data = Buffer.alloc(0);
        
        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });

        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        });

        res.on('error', reject);
      });

      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    console.log(`✅ 收到响应，状态码: ${response.status}`);
    console.log(`📊 响应大小: ${response.data.length} bytes`);

    // 保存原始二进制响应
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawResponseFile = path.join(__dirname, `real-codewhisperer-response-${timestamp}.bin`);
    fs.writeFileSync(rawResponseFile, response.data);
    console.log(`💾 原始响应已保存: ${rawResponseFile}`);

    // 解析响应
    console.log('🔍 解析二进制响应...');
    const { parseCodeWhispererSSE } = require('../examples/demo2/src/parsers/sse-parser');
    const events = parseCodeWhispererSSE(response.data);
    
    console.log(`📨 解析出 ${events.length} 个事件`);

    // 构建响应样本
    const responseSample = {
      metadata: {
        timestamp: new Date().toISOString(),
        endpoint: endpoint,
        requestSize: requestBody.length,
        responseSize: response.data.length,
        statusCode: response.status,
        headers: response.headers
      },
      originalRequest: {
        anthropicRequest: realRequestData,
        codewhispererRequest: codewhispererRequest
      },
      rawResponse: {
        binaryFile: rawResponseFile,
        size: response.data.length,
        status: response.status
      },
      parsedEvents: events,
      eventSummary: {
        totalEvents: events.length,
        textEvents: events.filter(e => e.content && e.content.trim()).length,
        stopEvent: events.find(e => e.stop) ? true : false
      }
    };

    // 保存完整响应样本
    const sampleFile = path.join(__dirname, `codewhisperer-response-sample-${timestamp}.json`);
    fs.writeFileSync(sampleFile, JSON.stringify(responseSample, null, 2));
    console.log(`📋 响应样本已保存: ${sampleFile}`);

    // 生成用于后续测试的模板
    const testTemplate = {
      timestamp: new Date().toISOString(),
      source: 'real-codewhisperer-api',
      request: realRequestData,
      codewhispererRequest: codewhispererRequest,
      realResponse: {
        events: events,
        binarySize: response.data.length,
        eventCount: events.length
      }
    };

    const templateFile = path.join(__dirname, 'real-response-template.json');
    fs.writeFileSync(templateFile, JSON.stringify(testTemplate, null, 2));
    console.log(`🎯 测试模板已保存: ${templateFile}`);

    console.log('\n🎉 真实CodeWhisperer响应捕获完成!');
    console.log(`原始二进制文件: ${rawResponseFile}`);
    console.log(`响应样本文件: ${sampleFile}`);
    console.log(`测试模板文件: ${templateFile}`);

    return {
      rawFile: rawResponseFile,
      sampleFile: sampleFile,
      templateFile: templateFile,
      events: events
    };

  } catch (error) {
    console.error('❌ 捕获失败:', error.message);
    
    // 如果API调用失败，使用现有的模拟数据作为样本
    console.log('🔄 使用现有测试数据创建样本...');
    
    const existingSimulation = JSON.parse(fs.readFileSync(path.join(__dirname, 'stage4-response-simulation.json'), 'utf8'));
    
    const fallbackSample = {
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'simulation',
        note: 'API调用失败，使用模拟数据'
      },
      originalRequest: realRequestData,
      simulatedResponse: existingSimulation.mockResponse,
      events: existingSimulation.mockResponse.events
    };

    const fallbackFile = path.join(__dirname, 'codewhisperer-fallback-sample.json');
    fs.writeFileSync(fallbackFile, JSON.stringify(fallbackSample, null, 2));
    console.log(`📋 备用样本已保存: ${fallbackFile}`);

    return {
      sampleFile: fallbackFile,
      events: existingSimulation.mockResponse.events,
      isFallback: true
    };
  }
}

// 运行捕获
if (require.main === module) {
  captureRealCodeWhispererResponse().catch(console.error);
}

module.exports = { captureRealCodeWhispererResponse };