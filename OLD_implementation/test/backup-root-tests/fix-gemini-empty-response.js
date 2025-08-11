#!/usr/bin/env node

/**
 * Gemini空响应问题修复脚本
 * 实施P0优先级修复：空响应处理改进和调试日志增强
 * 项目所有者：Jason Zhang
 */

const fs = require('fs');
const path = require('path');

const GEMINI_CLIENT_PATH = './src/providers/gemini/client.ts';

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function backupFile(filePath) {
  const backupPath = filePath + '.backup-' + Date.now();
  fs.copyFileSync(filePath, backupPath);
  log(`✅ Created backup: ${backupPath}`);
  return backupPath;
}

function applyFix1_ImproveEmptyResponseHandling() {
  log('🔧 Fix 1: 改进空响应处理');
  
  const content = fs.readFileSync(GEMINI_CLIENT_PATH, 'utf8');
  
  // 查找当前的空响应处理代码
  const oldPattern = /\/\/ If no content found, add empty text block\s*\n\s*if \(content\.length === 0\) \{\s*\n\s*content\.push\(\{\s*\n\s*type: 'text',\s*\n\s*text: ''\s*\n\s*\}\);\s*\n\s*\}/;
  
  const newCode = `    // If no content found, add helpful default response instead of empty text
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: 'I apologize, but I cannot provide a response at the moment. This may be due to content filtering, API limitations, or quota restrictions. Please try rephrasing your question or try again later.'
      });
    }`;
  
  if (oldPattern.test(content)) {
    const updatedContent = content.replace(oldPattern, newCode);
    fs.writeFileSync(GEMINI_CLIENT_PATH, updatedContent);
    log('✅ Fix 1 applied: 改进了空响应默认文本');
    return true;
  } else {
    log('⚠️ Fix 1 skipped: 未找到目标代码模式，可能已经修复或代码结构已变更');
    return false;
  }
}

function applyFix2_EnhanceDebuggingLogs() {
  log('🔧 Fix 2: 增强调试日志');
  
  const content = fs.readFileSync(GEMINI_CLIENT_PATH, 'utf8');
  
  // 查找convertFromGeminiFormat方法开始位置
  const methodStart = 'private convertFromGeminiFormat(geminiResponse: any, originalRequest: BaseRequest): BaseResponse {';
  const insertAfter = 'const parts = candidate?.content?.parts || [];';
  
  if (content.includes(methodStart) && content.includes(insertAfter)) {
    const debugCode = `
    
    // 🔧 Enhanced debugging for empty response diagnosis
    logger.debug('Converting Gemini response to Anthropic format', {
      candidatesCount: geminiResponse.candidates?.length || 0,
      partsCount: parts.length,
      finishReason: candidate?.finishReason,
      hasUsageMetadata: !!geminiResponse.usageMetadata,
      safetyRatings: candidate?.safetyRatings,
      requestId: originalRequest.metadata?.requestId || 'unknown'
    });`;
    
    const updatedContent = content.replace(insertAfter, insertAfter + debugCode);
    
    // 添加转换完成日志
    const beforeReturn = 'return {';
    const returnDebugCode = `
    
    // 🔧 Log conversion results for debugging
    logger.debug('Gemini response conversion completed', {
      contentBlocks: content.length,
      textBlocks: content.filter(c => c.type === 'text').length,
      toolBlocks: content.filter(c => c.type === 'tool_use').length,
      isEmpty: content.length === 1 && content[0].type === 'text' && (!content[0].text || content[0].text.trim() === ''),
      requestId: originalRequest.metadata?.requestId || 'unknown'
    });
    
    `;
    
    const finalContent = updatedContent.replace(beforeReturn, returnDebugCode + beforeReturn);
    fs.writeFileSync(GEMINI_CLIENT_PATH, finalContent);
    log('✅ Fix 2 applied: 增强了调试日志');
    return true;
  } else {
    log('⚠️ Fix 2 skipped: 未找到目标方法，可能代码结构已变更');
    return false;
  }
}

function applyFix3_AddRawResponseCapture() {
  log('🔧 Fix 3: 添加原始响应数据捕获');
  
  const content = fs.readFileSync(GEMINI_CLIENT_PATH, 'utf8');
  
  // 在createCompletion方法中添加原始响应捕获
  const targetLine = 'const geminiResponse = await response.json();';
  
  if (content.includes(targetLine)) {
    const debugCaptureCode = `const geminiResponse = await response.json();
    
    // 🔧 Capture raw response for debugging empty response issues
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      try {
        const debugFile = \`/tmp/gemini-raw-response-\${Date.now()}-\${requestId}.json\`;
        require('fs').writeFileSync(debugFile, JSON.stringify({
          request: geminiRequest,
          response: geminiResponse,
          timestamp: new Date().toISOString(),
          requestId
        }, null, 2));
        logger.debug('Raw Gemini response captured for debugging', { debugFile });
      } catch (err) {
        logger.warn('Failed to capture raw response', { error: err.message });
      }
    }`;
    
    const updatedContent = content.replace(targetLine, debugCaptureCode);
    fs.writeFileSync(GEMINI_CLIENT_PATH, updatedContent);
    log('✅ Fix 3 applied: 添加了原始响应数据捕获');
    return true;
  } else {
    log('⚠️ Fix 3 skipped: 未找到目标代码行');
    return false;
  }
}

function applyFix4_ContentSafetyDetection() {
  log('🔧 Fix 4: 添加Content Safety检测');
  
  const content = fs.readFileSync(GEMINI_CLIENT_PATH, 'utf8');
  
  // 在mapFinishReason方法之后添加新方法
  const insertAfter = 'return reasonMap[finishReason || \'OTHER\'] || \'end_turn\';';
  
  if (content.includes(insertAfter)) {
    const safetyDetectionCode = `
  }

  /**
   * Detect if response was blocked by Content Safety
   */
  private detectContentSafetyBlock(geminiResponse: any): { blocked: boolean, reason?: string } {
    const candidate = geminiResponse.candidates?.[0];
    
    // Check finish reason
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION') {
      return { blocked: true, reason: candidate.finishReason };
    }
    
    // Check safety ratings
    const blockedRatings = candidate?.safetyRatings?.filter(rating => rating.blocked === true);
    if (blockedRatings?.length > 0) {
      return { 
        blocked: true, 
        reason: 'SAFETY_RATINGS',
        details: blockedRatings.map(r => r.category).join(', ')
      };
    }
    
    return { blocked: false };`;
    
    const updatedContent = content.replace(insertAfter, insertAfter + safetyDetectionCode);
    fs.writeFileSync(GEMINI_CLIENT_PATH, updatedContent);
    log('✅ Fix 4 applied: 添加了Content Safety检测方法');
    return true;
  } else {
    log('⚠️ Fix 4 skipped: 未找到插入位置');
    return false;
  }
}

function main() {
  log('🚀 开始执行Gemini空响应问题修复');
  
  // 检查文件是否存在
  if (!fs.existsSync(GEMINI_CLIENT_PATH)) {
    log(`❌ 错误: 找不到文件 ${GEMINI_CLIENT_PATH}`);
    process.exit(1);
  }
  
  // 创建备份
  const backupPath = backupFile(GEMINI_CLIENT_PATH);
  
  try {
    let appliedFixes = 0;
    
    // 应用所有修复
    if (applyFix1_ImproveEmptyResponseHandling()) appliedFixes++;
    if (applyFix2_EnhanceDebuggingLogs()) appliedFixes++;
    if (applyFix3_AddRawResponseCapture()) appliedFixes++;
    if (applyFix4_ContentSafetyDetection()) appliedFixes++;
    
    log(`🎉 修复完成! 成功应用 ${appliedFixes}/4 个修复`);
    
    if (appliedFixes > 0) {
      log('📋 下一步操作:');
      log('1. 运行 npm run build 重新构建项目');
      log('2. 重启 Claude Code Router 服务器');
      log('3. 运行系统测试验证修复效果');
      log('4. 如果出现问题，可以从备份恢复: ' + backupPath);
    }
    
    // 生成修复报告
    const report = {
      timestamp: new Date().toISOString(),
      appliedFixes,
      backupFile: backupPath,
      fixes: [
        { name: 'ImproveEmptyResponseHandling', applied: appliedFixes >= 1 },
        { name: 'EnhanceDebuggingLogs', applied: appliedFixes >= 2 },
        { name: 'AddRawResponseCapture', applied: appliedFixes >= 3 },
        { name: 'ContentSafetyDetection', applied: appliedFixes >= 4 }
      ]
    };
    
    fs.writeFileSync('./gemini-fix-report.json', JSON.stringify(report, null, 2));
    log('📄 修复报告已保存: ./gemini-fix-report.json');
    
  } catch (error) {
    log(`❌ 修复过程中出现错误: ${error.message}`);
    log('🔄 正在从备份恢复文件...');
    fs.copyFileSync(backupPath, GEMINI_CLIENT_PATH);
    log('✅ 文件已从备份恢复');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}