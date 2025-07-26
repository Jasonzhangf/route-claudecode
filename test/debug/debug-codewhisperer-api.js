#!/usr/bin/env node

/**
 * CodeWhisperer API调试脚本
 * 检查实际API响应，保存原始二进制数据
 */

const fs = require('fs');
const path = require('path');

async function debugCodeWhispererAPI() {
  console.log('🔍 CodeWhisperer API调试开始...');

  try {
    // 1. 读取实际CodeWhisperer配置
    const configPath = path.join(process.env.HOME, '.claude-code-router', 'config-router.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('配置文件不存在: ' + configPath);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ 配置文件加载成功');

    // 2. 导入CodeWhisperer客户端
    const { CodeWhispererClient } = require('./dist/providers/codewhisperer/client');
    const { CodeWhispererConverter } = require('./dist/providers/codewhisperer/converter');
    const { CodeWhispererAuth } = require('./dist/providers/codewhisperer/auth');

    // 3. 初始化认证
    console.log('🔑 初始化CodeWhisperer认证...');
    const auth = new CodeWhispererAuth();
    const token = await auth.getToken();
    console.log('✅ Token获取成功:', token.substring(0, 20) + '...');

    // 4. 创建测试请求
    const testRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message for debugging CodeWhisperer API.'
        }
      ],
      max_tokens: 1000,
      stream: true
    };

    console.log('📋 测试请求创建完成');

    // 5. 转换为CodeWhisperer格式
    const converter = new CodeWhispererConverter();
    const codewhispererRequest = converter.convertToCodeWhisperer(testRequest);
    
    console.log('🔄 请求格式转换完成');
    console.log('CodeWhisperer请求preview:', JSON.stringify(codewhispererRequest, null, 2).substring(0, 500) + '...');

    // 6. 发送实际API请求
    console.log('🚀 发送CodeWhisperer API请求...');
    const client = new CodeWhispererClient(token);
    
    // 创建调试日志文件
    const debugDir = path.join(__dirname, 'debug-output');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const responseFile = path.join(debugDir, `codewhisperer-response-${timestamp}.bin`);
    const logFile = path.join(debugDir, `codewhisperer-log-${timestamp}.txt`);

    let logContent = '';
    function log(message) {
      console.log(message);
      logContent += message + '\n';
    }

    log('📡 开始API调用...');
    const startTime = Date.now();

    try {
      // 使用客户端发送请求并捕获原始响应
      const response = await client.sendRequest(codewhispererRequest);
      
      log(`⏱️ API调用耗时: ${Date.now() - startTime}ms`);
      log(`📊 响应状态: ${response.status}`);
      log(`📋 响应头: ${JSON.stringify(response.headers, null, 2)}`);

      // 保存原始二进制响应
      if (response.data) {
        fs.writeFileSync(responseFile, response.data);
        log(`💾 原始响应已保存: ${responseFile} (${response.data.length} bytes)`);
      }

      // 尝试解析响应
      log('🔍 开始解析响应...');
      const { CodeWhispererParser } = require('./dist/providers/codewhisperer/parser');
      const parser = new CodeWhispererParser();
      
      const events = parser.parseSSEResponse(response.data);
      log(`📨 解析出 ${events.length} 个事件`);

      events.forEach((event, index) => {
        log(`事件 ${index + 1}: ${event.event} - ${JSON.stringify(event.data).substring(0, 100)}...`);
      });

      // 验证最终响应构建
      const finalResponse = parser.buildFinalResponse(events);
      log('🎯 最终响应构建完成:');
      log(JSON.stringify(finalResponse, null, 2));

    } catch (apiError) {
      log(`❌ API调用失败: ${apiError.message}`);
      log(`错误详情: ${JSON.stringify(apiError, null, 2)}`);
    }

    // 保存调试日志
    fs.writeFileSync(logFile, logContent);
    log(`📄 调试日志已保存: ${logFile}`);

    console.log('\n🎉 CodeWhisperer API调试完成!');
    console.log(`查看详细日志: ${logFile}`);
    if (fs.existsSync(responseFile)) {
      console.log(`查看原始响应: ${responseFile}`);
    }

  } catch (error) {
    console.error('❌ 调试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行调试
if (require.main === module) {
  debugCodeWhispererAPI().catch(console.error);
}

module.exports = { debugCodeWhispererAPI };