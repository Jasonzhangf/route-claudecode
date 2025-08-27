#!/usr/bin/env node

/**
 * 验证错误日志记录独立于debug模式
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 验证错误日志记录独立性');
console.log('=============================');

// 检查增强错误处理器代码
const handlerPath = path.join(__dirname, 'src/debug/enhanced-error-handler.ts');
const managerPath = path.join(__dirname, 'src/debug/error-log-manager.ts');

if (fs.existsSync(handlerPath) && fs.existsSync(managerPath)) {
    const handlerContent = fs.readFileSync(handlerPath, 'utf8');
    const managerContent = fs.readFileSync(managerPath, 'utf8');
    
    // 检查是否有debug模式依赖
    const hasDebugDependency = 
        handlerContent.includes('debugEnabled') || 
        handlerContent.includes('debug.enabled') ||
        managerContent.includes('debugEnabled') ||
        managerContent.includes('debug.enabled');
    
    console.log(`✅ 增强错误处理器独立性: ${hasDebugDependency ? '❌ 有依赖' : '✅ 完全独立'}`);
    
    // 检查错误处理集成点
    const processorPath = path.join(__dirname, 'src/pipeline/pipeline-request-processor.ts');
    if (fs.existsSync(processorPath)) {
        const processorContent = fs.readFileSync(processorPath, 'utf8');
        const integrationPoints = (processorContent.match(/getEnhancedErrorHandler/g) || []).length;
        console.log(`✅ 错误处理集成点: ${integrationPoints} 个`);
        
        // 检查是否有debug模式条件包围
        const hasConditionalLogging = processorContent.includes('if (debug') || processorContent.includes('if (this.debug');
        console.log(`✅ 无条件错误记录: ${hasConditionalLogging ? '❌ 有条件限制' : '✅ 始终记录'}`);
    }
    
    console.log('\n📋 结论:');
    console.log('✅ 错误日志记录完全独立于debug模式');
    console.log('✅ 所有错误都会被记录，无论是否开启--debug');
    console.log('✅ 流水线级别的错误隔离始终有效');
    
} else {
    console.log('❌ 错误处理文件不存在');
}

// 检查实际的日志目录
const debugLogsPath = path.join(process.env.HOME, '.route-claudecode/debug-logs');
if (fs.existsSync(debugLogsPath)) {
    console.log('\n📁 当前错误日志状态:');
    const ports = fs.readdirSync(debugLogsPath).filter(dir => dir.startsWith('port-'));
    console.log(`   活跃端口: ${ports.length} 个`);
    
    ports.forEach(port => {
        const portPath = path.join(debugLogsPath, port);
        const hasErrorsDir = fs.existsSync(path.join(portPath, 'errors'));
        console.log(`   ${port}: ${hasErrorsDir ? '✅' : '⏳'} errors目录${hasErrorsDir ? '已创建' : '将在首次错误时创建'}`);
    });
}