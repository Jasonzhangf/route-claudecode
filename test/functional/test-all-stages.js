#!/usr/bin/env node
/**
 * 运行所有阶段测试脚本
 * 完整的流水线测试：从Claude Code请求到最终响应
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Claude Code Router 完整流水线测试');
console.log('=====================================\n');

const stages = [
  {
    name: 'Stage 1: 输入处理',
    script: 'test-stage1-input-processing.js',
    description: '测试Anthropic输入格式解析和BaseRequest转换'
  },
  {
    name: 'Stage 2: 路由处理',
    script: 'test-stage2-routing.js', 
    description: '测试模型路由逻辑和provider选择'
  },
  {
    name: 'Stage 3: CodeWhisperer转换',
    script: 'test-stage3-codewhisperer-conversion.js',
    description: '测试BaseRequest到CodeWhisperer格式的转换'
  },
  {
    name: 'Stage 4: 响应模拟',
    script: 'test-stage4-response-simulation.js',
    description: '模拟CodeWhisperer二进制响应和解析'
  },
  {
    name: 'Stage 5: 服务器集成',
    script: 'test-stage5-server-integration.js',
    description: '测试完整的服务器响应流程'
  }
];

// 检查是否有捕获的Claude Code请求数据
const capturedDataDir = path.join(__dirname, 'captured-data');
const hasClaudeRequest = fs.existsSync(capturedDataDir) && 
                        fs.readdirSync(capturedDataDir).some(file => file.startsWith('claude-request'));

if (!hasClaudeRequest) {
  console.log('❌ 找不到捕获的Claude Code请求数据');
  console.log('💡 请先运行拦截器捕获真实请求:');
  console.log('   1. node test/basic-intercept.js');
  console.log('   2. 在另一个终端: export ANTHROPIC_BASE_URL="http://127.0.0.1:3456" && claude "hello test"');
  process.exit(1);
}

let currentStage = 0;
const results = [];

function runStage(stageIndex) {
  if (stageIndex >= stages.length) {
    // 所有阶段完成，显示总结
    showSummary();
    return;
  }
  
  const stage = stages[stageIndex];
  const scriptPath = path.join(__dirname, stage.script);
  
  if (!fs.existsSync(scriptPath)) {
    console.log(`❌ 找不到测试脚本: ${stage.script}`);
    results.push({ stage: stage.name, success: false, error: 'Script not found' });
    runStage(stageIndex + 1);
    return;
  }
  
  console.log(`\n🧪 运行 ${stage.name}`);
  console.log(`📝 ${stage.description}`);
  console.log(`🔄 执行: ${stage.script}`);
  console.log('─'.repeat(50));
  
  const startTime = Date.now();
  
  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  child.on('close', (code) => {
    const duration = Date.now() - startTime;
    
    if (code === 0) {
      console.log('─'.repeat(50));
      console.log(`✅ ${stage.name} 完成 (${duration}ms)`);
      results.push({ 
        stage: stage.name, 
        success: true, 
        duration: duration,
        script: stage.script 
      });
    } else {
      console.log('─'.repeat(50));
      console.log(`❌ ${stage.name} 失败 (退出码: ${code})`);
      results.push({ 
        stage: stage.name, 
        success: false, 
        duration: duration,
        exitCode: code,
        script: stage.script 
      });
    }
    
    // 继续下一个阶段
    runStage(stageIndex + 1);
  });
  
  child.on('error', (error) => {
    console.log('─'.repeat(50));
    console.log(`❌ ${stage.name} 执行错误: ${error.message}`);
    results.push({ 
      stage: stage.name, 
      success: false, 
      error: error.message,
      script: stage.script 
    });
    
    // 继续下一个阶段
    runStage(stageIndex + 1);
  });
}

function showSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结报告');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n总测试数: ${results.length}`);
  console.log(`✅ 成功: ${successful.length}`);
  console.log(`❌ 失败: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ 成功的阶段:');
    successful.forEach(result => {
      console.log(`   • ${result.stage} (${result.duration}ms)`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ 失败的阶段:');
    failed.forEach(result => {
      console.log(`   • ${result.stage}`);
      if (result.exitCode) {
        console.log(`     退出码: ${result.exitCode}`);
      }
      if (result.error) {
        console.log(`     错误: ${result.error}`);
      }
    });
  }
  
  // 检查输出文件
  console.log('\n📁 生成的文件:');
  const outputFiles = [
    'stage1-base-request.json',
    'stage2-routing-result.json', 
    'stage3-codewhisperer-request.json',
    'stage4-response-simulation.json',
    'stage4-mock-binary-response.bin',
    'stage5-server-integration.json',
    'stage5-sse-output.txt',
    'stage5-final-response.json'
  ];
  
  outputFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`   ✅ ${file} (${stats.size} 字节)`);
    } else {
      console.log(`   ❌ ${file} (未生成)`);
    }
  });
  
  // 分析问题
  if (results.length === stages.length && successful.length === stages.length) {
    console.log('\n🎉 所有测试通过！Claude Code Router流水线工作正常。');
    console.log('\n🔍 问题分析:');
    console.log('   基于测试结果，流水线的每个阶段都能正确处理数据转换。');
    console.log('   如果实际路由器仍然返回空响应，可能是以下原因:');
    console.log('   1. CodeWhisperer API认证问题（token无效或过期）');
    console.log('   2. 二进制响应解析逻辑与demo2实现不一致');
    console.log('   3. SSE事件转换过程中丢失数据');
    console.log('   4. 网络请求或超时问题');
    console.log('\n💡 建议下一步:');
    console.log('   1. 检查实际的CodeWhisperer API响应（保存原始二进制数据）');
    console.log('   2. 对比我们的解析器与demo2的Go版本');
    console.log('   3. 添加更详细的debug日志到路由器');
  } else {
    console.log('\n⚠️  部分测试失败，需要修复后再分析实际问题。');
  }
  
  // 保存测试报告
  const report = {
    timestamp: new Date().toISOString(),
    totalStages: results.length,
    successful: successful.length,
    failed: failed.length,
    results: results,
    outputFiles: outputFiles.map(file => ({
      name: file,
      exists: fs.existsSync(path.join(__dirname, file)),
      size: fs.existsSync(path.join(__dirname, file)) ? fs.statSync(path.join(__dirname, file)).size : 0
    }))
  };
  
  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);
  console.log('\n' + '='.repeat(60));
}

// 开始运行测试
console.log('🎯 开始运行所有阶段测试...');
console.log(`📋 共 ${stages.length} 个阶段待执行\n`);

runStage(0);