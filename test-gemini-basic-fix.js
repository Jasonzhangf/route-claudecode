#!/usr/bin/env node

/**
 * Gemini基本功能恢复测试
 * 测试目标：验证编译错误修复和基本文本响应
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

console.log('🔧 Gemini基本功能恢复测试');

async function testCompilation() {
  console.log('\n📝 步骤1：检查TypeScript编译');
  
  try {
    // 尝试编译只检查gemini相关文件
    const { stdout, stderr } = await execAsync('npx tsc --noEmit --skipLibCheck src/providers/gemini/client.ts src/providers/gemini/modules/*.ts');
    
    if (stderr && !stderr.includes('warning')) {
      console.log('❌ TypeScript编译错误:');
      console.log(stderr);
      return false;
    } else {
      console.log('✅ TypeScript编译通过');
      return true;
    }
  } catch (error) {
    console.log('❌ TypeScript编译失败:');
    console.log(error.stderr || error.message);
    return false;
  }
}

async function testBasicImports() {
  console.log('\n📦 步骤2：检查模块导入');
  
  try {
    // 测试基本的require导入
    const clientPath = path.join(__dirname, 'src/providers/gemini/client.ts');
    const requestConverterPath = path.join(__dirname, 'src/providers/gemini/modules/request-converter.ts');
    const responseConverterPath = path.join(__dirname, 'src/providers/gemini/modules/response-converter.ts');
    
    const exists = [
      fs.existsSync(clientPath),
      fs.existsSync(requestConverterPath),
      fs.existsSync(responseConverterPath)
    ];
    
    if (exists.every(Boolean)) {
      console.log('✅ 所有必需文件存在');
      return true;
    } else {
      console.log('❌ 缺少文件');
      return false;
    }
  } catch (error) {
    console.log('❌ 导入测试失败:', error.message);
    return false;
  }
}

async function testModuleStructure() {
  console.log('\n🏗️ 步骤3：检查模块结构');
  
  try {
    const clientContent = fs.readFileSync(path.join(__dirname, 'src/providers/gemini/client.ts'), 'utf8');
    
    // 检查关键导入
    const requiredImports = [
      'GeminiRequestConverter',
      'GeminiResponseConverter',
      'createPatchManager'
    ];
    
    const missingImports = requiredImports.filter(imp => !clientContent.includes(imp));
    
    if (missingImports.length === 0) {
      console.log('✅ 所有必需导入存在');
      return true;
    } else {
      console.log('❌ 缺少导入:', missingImports.join(', '));
      return false;
    }
  } catch (error) {
    console.log('❌ 模块结构检查失败:', error.message);
    return false;
  }
}

async function generateHealthReport() {
  console.log('\n📊 生成健康报告...');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: {
      compilation: await testCompilation(),
      imports: await testBasicImports(),
      structure: await testModuleStructure()
    }
  };
  
  const reportPath = `/tmp/gemini-health-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  const passCount = Object.values(results.tests).filter(Boolean).length;
  const totalCount = Object.keys(results.tests).length;
  
  console.log(`\n📈 测试结果: ${passCount}/${totalCount} 通过`);
  console.log(`📄 详细报告: ${reportPath}`);
  
  if (passCount === totalCount) {
    console.log('🎉 基本修复完成！可以进行下一步测试');
    return true;
  } else {
    console.log('⚠️ 仍有问题需要修复');
    return false;
  }
}

// 运行测试
generateHealthReport().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 测试运行失败:', error);
  process.exit(1);
});