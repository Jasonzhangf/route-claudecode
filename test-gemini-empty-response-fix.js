#!/usr/bin/env node

/**
 * Gemini空响应问题修复测试
 * 测试用例：验证和修复gemini返回空文本的问题
 * 项目所有者：Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const CONFIG_PATH = path.join(process.env.HOME, '.route-claude-code', 'config-router.json');
const LOG_FILE = `/tmp/test-gemini-empty-fix-${Date.now()}.log`;

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}${data ? '\nData: ' + JSON.stringify(data, null, 2) : ''}`;
  console.log(logEntry);
  fs.appendFileSync(LOG_FILE, logEntry + '\n');
}

async function testGeminiEmptyResponse() {
  log('🧪 开始Gemini空响应问题修复测试');
  
  try {
    // 1. 检查配置文件
    if (!fs.existsSync(CONFIG_PATH)) {
      throw new Error(`配置文件不存在: ${CONFIG_PATH}`);
    }
    
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    log('✅ 配置文件加载成功');
    
    // 2. 找到gemini相关路由
    const geminiRoutes = [];
    for (const [category, routing] of Object.entries(config.routing || {})) {
      if (routing.provider && routing.provider.includes('gemini')) {
        geminiRoutes.push({ category, ...routing });
      }
    }
    
    if (geminiRoutes.length === 0) {
      throw new Error('未找到gemini相关路由配置');
    }
    
    log('✅ 找到gemini路由配置', { routes: geminiRoutes });
    
    // 3. 测试空响应场景
    const testRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: '你好，请回复一句话'
        }
      ],
      max_tokens: 100,
      stream: false
    };
    
    log('🚀 发送测试请求到Claude Code Router', testRequest);
    
    // 4. 发送到本地路由器
    const response = await fetch('http://localhost:3456/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key'
      },
      body: JSON.stringify(testRequest)
    });
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      log('❌ 响应不是有效JSON', { responseText });
      throw new Error('响应格式错误');
    }
    
    log('📥 收到路由器响应', {
      status: response.status,
      statusText: response.statusText,
      data: responseData
    });
    
    // 5. 分析响应内容
    if (response.status !== 200) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }
    
    // 6. 检查是否是空响应问题
    const content = responseData.content || [];
    const textBlocks = content.filter(block => block.type === 'text');
    const hasEmptyText = textBlocks.some(block => !block.text || block.text.trim() === '');
    
    if (hasEmptyText) {
      log('🔍 检测到空文本响应问题', {
        contentBlocks: content.length,
        textBlocks: textBlocks.length,
        emptyBlocks: textBlocks.filter(b => !b.text || b.text.trim() === '').length
      });
      
      // 7. 生成修复建议
      log('💡 生成修复建议:');
      log('1. 检查Gemini API密钥是否有效');
      log('2. 检查Gemini API配置是否正确');
      log('3. 考虑在convertFromGeminiFormat中添加默认响应');
      log('4. 检查Gemini API的content-safety设置');
      
      return {
        success: false,
        issue: 'empty_response',
        details: 'Gemini返回空文本响应',
        suggestions: [
          'Check Gemini API key validity',
          'Verify Gemini API configuration', 
          'Add default response in convertFromGeminiFormat',
          'Check Gemini content safety settings'
        ]
      };
    } else {
      log('✅ 响应内容正常', {
        contentLength: textBlocks.reduce((sum, b) => sum + (b.text?.length || 0), 0),
        textBlocks: textBlocks.length
      });
      
      return {
        success: true,
        issue: null,
        details: 'Gemini响应正常',
        responseLength: textBlocks.reduce((sum, b) => sum + (b.text?.length || 0), 0)
      };
    }
    
  } catch (error) {
    log('❌ 测试执行失败', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      issue: 'test_error',
      details: error.message
    };
  }
}

async function proposeGeminiFix() {
  log('🔧 生成Gemini空响应修复方案');
  
  const geminiClientPath = '/Users/fanzhang/Documents/github/claude-code-router/src/providers/gemini/client.ts';
  
  if (!fs.existsSync(geminiClientPath)) {
    log('❌ Gemini客户端文件不存在', { path: geminiClientPath });
    return;
  }
  
  // 读取当前gemini client代码
  const currentCode = fs.readFileSync(geminiClientPath, 'utf8');
  
  // 检查当前的空响应处理
  if (currentCode.includes('If no content found, add empty text block')) {
    log('🔍 发现现有的空响应处理逻辑');
    
    // 建议改进的空响应处理
    const improvedHandling = `
    // If no content found, add helpful default response instead of empty text
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: 'I apologize, but I cannot provide a response at the moment. Please try rephrasing your question or try again later.'
      });
    }`;
    
    log('💡 建议的修复代码:', { improvedHandling });
    
    // 检查是否有API key问题
    if (currentCode.includes('getCurrentApiKey')) {
      log('🔍 系统使用API密钥轮换');
      log('💡 建议检查API密钥状态和配额');
    }
    
  } else {
    log('⚠️ 未找到空响应处理逻辑，需要添加');
  }
}

async function main() {
  log('🚀 Gemini空响应问题修复测试开始');
  log('📝 日志文件:', LOG_FILE);
  
  try {
    // 1. 执行空响应测试
    const testResult = await testGeminiEmptyResponse();
    
    // 2. 根据测试结果提供修复建议
    if (!testResult.success && testResult.issue === 'empty_response') {
      await proposeGeminiFix();
    }
    
    // 3. 生成测试报告
    const report = {
      timestamp: new Date().toISOString(),
      testResult,
      logFile: LOG_FILE,
      recommendations: testResult.success ? ['No action needed'] : [
        'Implement improved empty response handling',
        'Check Gemini API key configuration',
        'Add content safety bypass if appropriate',
        'Consider fallback to other providers'
      ]
    };
    
    log('📋 测试完成', report);
    
    // 保存测试报告
    const reportFile = `/tmp/gemini-empty-response-fix-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    log('📄 测试报告已保存:', reportFile);
    
  } catch (error) {
    log('❌ 主流程执行失败', {
      error: error.message,
      stack: error.stack
    });
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testGeminiEmptyResponse, proposeGeminiFix };