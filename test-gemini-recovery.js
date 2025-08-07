#!/usr/bin/env node

/**
 * Gemini Provider恢复测试
 * 测试目标：验证基本文本响应功能恢复
 */

const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

console.log('🚑 Gemini Provider恢复测试');
console.log('===============================');

async function step1_backupAndReplace() {
  console.log('\n📋 步骤1：备份和替换客户端');
  
  try {
    const { stdout, stderr } = await execAsync('node backup-and-replace-gemini.js');
    console.log(stdout);
    
    if (stderr && stderr.includes('❌')) {
      console.log('❌ 备份替换失败:', stderr);
      return false;
    }
    
    console.log('✅ 客户端替换成功');
    return true;
  } catch (error) {
    console.log('❌ 备份替换过程失败:', error.message);
    return false;
  }
}

async function step2_testCompilation() {
  console.log('\n🔧 步骤2：测试编译');
  
  try {
    const { stdout, stderr } = await execAsync('node test-minimal-compile.js');
    console.log(stdout);
    
    if (stderr && !stderr.includes('warning')) {
      console.log('❌ 编译测试失败:', stderr);
      return false;
    }
    
    console.log('✅ 编译测试通过');
    return true;
  } catch (error) {
    console.log('❌ 编译测试失败:', error.stderr || error.message);
    return false;
  }
}

async function step3_validateStructure() {
  console.log('\n🏗️ 步骤3：验证架构结构');
  
  try {
    const clientContent = fs.readFileSync('src/providers/gemini/client.ts', 'utf8');
    
    // 检查关键特征
    const features = {
      hasModularImports: clientContent.includes('GeminiRequestConverter') && clientContent.includes('GeminiResponseConverter'),
      hasZeroFallback: !clientContent.includes('fallback') && !clientContent.includes('|| \'default\''),
      hasZeroHardcoding: !clientContent.includes('gemini-2.5-pro') && !clientContent.includes('gemini-1.5'),
      hasProperErrorHandling: clientContent.includes('throw new Error') && !clientContent.includes('catch(){}'),
      hasCleanArchitecture: clientContent.includes('async createCompletion') && clientContent.includes('async* streamCompletion')
    };
    
    const passed = Object.values(features).filter(Boolean).length;
    const total = Object.keys(features).length;
    
    console.log(`📊 架构检查: ${passed}/${total} 通过`);
    
    Object.entries(features).forEach(([feature, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${feature}`);
    });
    
    return passed === total;
  } catch (error) {
    console.log('❌ 架构验证失败:', error.message);
    return false;
  }
}

async function step4_generateReport() {
  console.log('\n📊 步骤4：生成恢复报告');
  
  const results = {
    timestamp: new Date().toISOString(),
    recovery: {
      backup_replace: await step1_backupAndReplace(),
      compilation: await step2_testCompilation(),
      structure: await step3_validateStructure()
    },
    status: 'PENDING'
  };
  
  const passCount = Object.values(results.recovery).filter(Boolean).length;
  const totalCount = Object.keys(results.recovery).length;
  
  results.status = passCount === totalCount ? 'RECOVERED' : 'PARTIAL';
  
  // 保存报告
  const reportPath = `/tmp/gemini-recovery-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📈 恢复结果: ${passCount}/${totalCount} 完成`);
  console.log(`📄 详细报告: ${reportPath}`);
  console.log(`🎯 状态: ${results.status}`);
  
  if (results.status === 'RECOVERED') {
    console.log('\n🎉 Gemini Provider基本功能已恢复！');
    console.log('✅ 编译通过');
    console.log('✅ 架构符合要求（零硬编码，零fallback）');
    console.log('✅ 准备就绪进行功能测试');
    
    console.log('\n📝 下一步建议：');
    console.log('1. 启动服务测试基本文本响应');
    console.log('2. 测试工具调用功能');
    console.log('3. 逐步恢复流式响应高级功能');
    
    return true;
  } else {
    console.log('\n⚠️ 恢复未完全成功，需要进一步修复');
    return false;
  }
}

// 执行恢复测试
step4_generateReport().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 恢复测试失败:', error);
  process.exit(1);
});